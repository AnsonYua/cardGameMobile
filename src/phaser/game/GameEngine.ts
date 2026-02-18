import Phaser from "phaser";
import { MatchStateMachine } from "./MatchStateMachine";
import { GameContextStore } from "./GameContextStore";
import { ENGINE_EVENTS } from "./EngineEvents";
import { GamePhase, GameStatusResponse } from "./GameTypes";
import { GameStatus } from "./GameSessionService";
import { CardResourceLoader } from "./CardResourceLoader";
import { SelectionStore, SelectionTarget } from "./SelectionStore";
import { ActionRegistry, ActionContext, ActionDescriptor } from "./ActionRegistry";
import { ApiManager } from "../api/ApiManager";
import type { CommandFlowController } from "../controllers/CommandFlowController";
import type { UnitFlowController } from "../controllers/UnitFlowController";
import { findBaseCard } from "../utils/CardLookup";
import {
  canPlaySelectedHandCard,
  commandHasTimingWindow,
  getActivatedEffectOptions,
  getSlotCards,
  hasPairableUnit,
} from "./actionEligibility";
import { isBattleActionStep, isBattleStateConsistent } from "./battleUtils";
import { createLogger } from "../utils/logger";
import { hasPilotDesignationRule } from "../utils/pilotDesignation";

export type GameStatusSnapshot = {
  status: any;
  raw: GameStatusResponse | null;
  previousRaw: GameStatusResponse | null;
};

export type ActionSource = "hand" | "slot" | "base" | "neutral";

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private readonly log = createLogger("GameEngine");
  private lastRaw: GameStatusResponse | null = null;
  private previousRaw: GameStatusResponse | null = null;
  private pendingBattleTransition?: { prevBattle: any; nextBattle: any };
  private resourceLoader: CardResourceLoader;
  private resourceLoadInFlight = false;
  private allowEnvScanFallbackDefault = false;
  private lastPreloadedSnapshotKey: string | null = null;
  private selection = new SelectionStore();
  private actions = new ActionRegistry();
  private api: ApiManager;
  private pilotTargetUid?: string;
  private commandFlow?: CommandFlowController;
  private unitFlow?: UnitFlowController;

  constructor(scene: Phaser.Scene, private match: MatchStateMachine, private contextStore: GameContextStore) {
    this.resourceLoader = new CardResourceLoader(scene);
    this.api = new ApiManager(this.match.getApiBaseUrl());
    this.registerDefaultActions();
    this.registerBattleTransitionListeners();
  }

  setAllowEnvScanFallbackDefault(enabled: boolean) {
    this.allowEnvScanFallbackDefault = enabled === true;
  }
  // Optional: call after scenario injection; when `fromScenario` is true we reuse any cached payload if present.
  async updateGameStatus(
    gameId?: string,
    playerId?: string,
    opts: {
      fromScenario?: boolean;
      silent?: boolean;
      statusPayload?: GameStatusResponse | null;
      allowEnvScanFallback?: boolean;
    } = {},
  ) {
    if (!gameId || !playerId) return this.getSnapshot();
    const snapshotNow = () => this.getSnapshot();
    const fromScenario = opts.fromScenario === true;
    const silent = opts.silent === true || fromScenario;
    const allowEnvScanFallback =
      opts.allowEnvScanFallback === undefined
        ? this.allowEnvScanFallbackDefault
        : opts.allowEnvScanFallback === true;
    const previousGameEnv = {
      phase: this.getPhase(this.lastRaw),
      battle: this.getBattle(this.lastRaw),
      status: this.contextStore.get().lastStatus,
      raw: this.lastRaw,
    };
    try {
      const response = await this.resolveStatusPayload(gameId, playerId, {
        fromScenario,
        forcedPayload: opts.statusPayload ?? null,
      });
      const normalizedResponse = this.normalizeBattleState(response);
      this.logStatusPoll(gameId, playerId, normalizedResponse);
      this.logStatusQueues(normalizedResponse);

      // Prefer explicit status fields, otherwise fall back to the entire payload.
      // If the backend omits a status (common during polling), keep the last known status so UI (header) doesn't revert.
      // Only fall back to the full response if it's a string; otherwise use the previous status.
      const derivedStatus = this.deriveStatus(normalizedResponse, previousGameEnv.status);
      const nextGameEnv = {
        phase: this.getPhase(normalizedResponse),
        battle: this.getBattle(normalizedResponse),
        status: derivedStatus,
      };
      const entersRedrawPhase = previousGameEnv.phase !== GamePhase.Redraw && nextGameEnv.phase === GamePhase.Redraw;

      // Proactively preload bundle on new snapshots so visible cards are already in texture cache.
      // Redraw phase has its own loading/status flow below, so skip duplicate preload here.
      if (!entersRedrawPhase) {
        await this.preloadResourcesForSnapshot(gameId, playerId, normalizedResponse, previousGameEnv.raw, {
          allowEnvScanFallback,
        });
      }

      this.previousRaw = previousGameEnv.raw;
      this.lastRaw = normalizedResponse;
      this.pendingBattleTransition = { prevBattle: previousGameEnv.battle, nextBattle: nextGameEnv.battle };

      this.contextStore.update({ lastStatus: nextGameEnv.status });
      this.events.emit(ENGINE_EVENTS.STATUS, snapshotNow());
      this.log.debug("update game status", snapshotNow());

      if (silent) {
        // Scenario loads should update UI without animations.
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, snapshotNow());
      } else if (entersRedrawPhase) {
        // Mark status as loading resources while fetching textures, then emit redraw after load.
        this.contextStore.update({ lastStatus: GameStatus.LoadingResources });
        this.events.emit(ENGINE_EVENTS.STATUS, snapshotNow());
        const didLoad = await this.fetchGameResources(gameId, playerId, normalizedResponse, {
          allowEnvScanFallback,
        });
        if (didLoad) {
          const preloadKey = this.buildResourceSnapshotKey(normalizedResponse);
          if (preloadKey) this.lastPreloadedSnapshotKey = preloadKey;
        }
        this.contextStore.update({ lastStatus: nextGameEnv.status });
        this.events.emit(ENGINE_EVENTS.STATUS, snapshotNow());
        this.events.emit(ENGINE_EVENTS.PHASE_REDRAW, snapshotNow());
      } else {
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE, snapshotNow());
      }
      const enteredMainPhase = !this.isMainPhase(previousGameEnv.phase) && this.isMainPhase(nextGameEnv.phase);
      if (enteredMainPhase) {
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_ENTER, snapshotNow());
        this.contextStore.update({ lastStatus: "Main Step" });
      }

      return snapshotNow();
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
      throw err;
    }
  }

  private getPhase(payload: any): any {
    return payload?.gameEnv?.phase ?? payload?.phase ?? null;
  }

  private async resolveStatusPayload(
    gameId: string,
    playerId: string,
    opts: { fromScenario: boolean; forcedPayload: GameStatusResponse | null },
  ): Promise<GameStatusResponse> {
    if (opts.forcedPayload) return opts.forcedPayload;
    if (opts.fromScenario && this.lastRaw) return this.lastRaw;
    return this.match.getGameStatus(gameId, playerId);
  }

  private deriveStatus(response: GameStatusResponse, previousStatus: any) {
    const fallback = typeof response === "string" ? response : previousStatus;
    return response?.status ?? response?.gameStatus ?? fallback;
  }

  private normalizeBattleState(response: GameStatusResponse): GameStatusResponse {
    if (!response || typeof response !== "object") return response;
    const battle = this.getBattle(response);
    if (!battle) return response;
    if (isBattleStateConsistent(response)) return response;
    this.log.debug("normalize stale currentBattle", {
      attackerCarduid: battle?.attackerCarduid ?? battle?.attackerUnitUid,
      status: battle?.status,
    });
    const gameEnv = (response as any)?.gameEnv;
    if (!gameEnv || typeof gameEnv !== "object") return response;
    return {
      ...(response as any),
      gameEnv: {
        ...gameEnv,
        currentBattle: null,
        currentbattle: null,
      },
    } as GameStatusResponse;
  }

  private logStatusPoll(gameId: string, playerId: string, response: GameStatusResponse) {
    this.log.debug("status poll", {
      gameId,
      playerId,
      phase: response?.gameEnv?.phase,
      version: response?.gameEnv?.version,
    });
  }

  private logStatusQueues(response: GameStatusResponse) {
    const notificationQueue = response?.gameEnv?.notificationQueue ?? [];
    const notificationTypes = Array.isArray(notificationQueue)
      ? notificationQueue.map((item) => item?.type ?? "unknown")
      : [];
    this.log.debug("status payload", {
      currentPlayer: response?.gameEnv?.currentPlayer,
      notificationQueue: notificationTypes,
      notificationTypesText: notificationTypes.join(","),
    });
  }

  getSnapshot(): GameStatusSnapshot {
    const ctx = this.contextStore.get();
    return { status: ctx.lastStatus, raw: this.lastRaw, previousRaw: this.previousRaw };
  }

  getContext() {
    return this.contextStore.get();
  }

  select(target: SelectionTarget) {
    this.selection.select(target);
  }

  clearSelection() {
    this.selection.clear();
  }

  setPilotTarget(uid?: string) {
    this.pilotTargetUid = uid || undefined;
  }

  getSelection() {
    return this.selection.get();
  }

  setFlowControllers(flows: { commandFlow?: CommandFlowController; unitFlow?: UnitFlowController }) {
    this.commandFlow = flows.commandFlow;
    this.unitFlow = flows.unitFlow;
  }

  getAvailableActions(source: ActionSource = "neutral"): ActionDescriptor[] {
    const ctx = this.buildActionContext();
    const selection = ctx.selection;
    const descriptors: ActionDescriptor[] = [];

    if (source === "hand" && selection?.kind === "hand") {
      const raw: any = this.lastRaw as any;
      const player = raw?.gameEnv?.players?.[ctx.playerId || ""];
      const hand = player?.deck?.hand ?? [];
      const handCard = Array.isArray(hand)
        ? hand.find((card: any) => {
            const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
            return uid === selection.uid;
          })
        : undefined;
      const cardData = handCard?.cardData ?? {};
      const derivedType = (cardData?.cardType || "").toString();
      const cardType = (derivedType || selection.cardType || "").toLowerCase();
      const fromPilotDesignation = selection.fromPilotDesignation === true || hasPilotDesignationRule(cardData);
      const canRun = !!ctx.gameId && !!ctx.playerId && !!selection.uid;
      const canPlay = canRun && canPlaySelectedHandCard(selection, this.lastRaw, ctx.playerId);
      if (cardType === "base") {
        descriptors.push({
          id: "playBaseFromHand",
          label: "Play Card",
          enabled: canPlay,
          primary: true,
        });
      } else if (cardType === "unit") {
        descriptors.push({
          id: "playUnitFromHand",
          label: "Play Card",
          enabled: canPlay,
          primary: true,
        });
      } else if (cardType === "pilot") {
        const hasPairable = hasPairableUnit(this.lastRaw, ctx.playerId);
        descriptors.push({
          id: "playPilotFromHand",
          label: "Play Card",
          enabled: canPlay && hasPairable,
          primary: true,
        });
      } else if (cardType === "command") {
        const phase = (this.lastRaw as any)?.gameEnv?.phase;
        const hasTimingWindow = commandHasTimingWindow(selection, this.lastRaw, ctx.playerId, phase);
        const isPilotDesignation = fromPilotDesignation;
        const phaseUpper = (phase ?? "").toString().toUpperCase();
        const canPilotDuringMain = phaseUpper === "MAIN_PHASE" && hasPairableUnit(this.lastRaw, ctx.playerId);
        const enabled = canPlay && (hasTimingWindow || (isPilotDesignation && canPilotDuringMain));
        descriptors.push({
          id: "playCommandFromHand",
          label: "Play Card",
          enabled,
          primary: true,
        });
      }


      // Cancel/clear selection is available when anything is selected.
      descriptors.push({
        id: "cancelSelection",
        label: "Cancel",
        enabled: !!selection,
      });

      return descriptors;
    }

    if (source === "slot" && selection?.kind === "slot") {
      const raw = this.lastRaw as any;
      const playerId = this.contextStore.get().playerId;
      const slotCards = getSlotCards(selection, raw, playerId);
      const options = [
        ...(slotCards?.unit ? getActivatedEffectOptions(slotCards.unit, raw, playerId) : []),
        ...(slotCards?.pilot ? getActivatedEffectOptions(slotCards.pilot, raw, playerId) : []),
      ];
      if (options.length) {
        descriptors.push({
          id: "activateEffect",
          label: "Activate Effect",
          enabled: true,
          primary: true,
        });
      }
      descriptors.push({
        id: "cancelSelection",
        label: "Cancel",
        enabled: true,
      });
      return descriptors;
    }

    if (source === "base" && selection?.kind === "base") {
      const raw = this.lastRaw as any;
      const playerId = this.contextStore.get().playerId;
      if (selection.side === "player" && raw && playerId) {
        const baseCard = findBaseCard(raw, playerId);
        const options = getActivatedEffectOptions(baseCard, raw, playerId);
        if (options.length) {
          descriptors.push({
            id: "activateEffect",
            label: "Activate Effect",
            enabled: true,
            primary: true,
          });
        }
      }
      descriptors.push({
        id: "cancelSelection",
        label: "Cancel",
        enabled: true,
      });
      return descriptors;
    }

    // End turn as default primary
    descriptors.push({
      id: "endTurn",
      label: "End Turn",
      enabled: true,
      primary: !descriptors.some((d) => d.primary),
    });
    return descriptors;
  }

  async runAction(id: string) {
    const handler = this.actions.get(id);
    if (!handler) return;
    const ctx = this.buildActionContext();
    return handler(ctx);
  }

  async loadGameResources(
    gameId: string,
    playerId: string,
    statusPayload?: GameStatusResponse | null,
    opts: { allowEnvScanFallback?: boolean } = {},
  ) {
    const allowEnvScanFallback =
      opts.allowEnvScanFallback === undefined
        ? this.allowEnvScanFallbackDefault
        : opts.allowEnvScanFallback === true;
    return this.fetchGameResources(gameId, playerId, statusPayload ?? this.lastRaw ?? {}, { allowEnvScanFallback });
  }

  private buildResourceSnapshotKey(response: GameStatusResponse | null | undefined): string | null {
    if (!response) return null;
    const version = (response as any)?.gameEnv?.version;
    if (version !== undefined && version !== null) return `version:${String(version)}`;
    const lastEventId = (response as any)?.gameEnv?.lastEventId;
    if (lastEventId !== undefined && lastEventId !== null) return `event:${String(lastEventId)}`;
    return null;
  }

  private async preloadResourcesForSnapshot(
    gameId: string,
    playerId: string,
    response: GameStatusResponse,
    previousRaw: GameStatusResponse | null,
    opts: { allowEnvScanFallback?: boolean } = {},
  ) {
    const token = (response as any)?.resourceBundleToken || (previousRaw as any)?.resourceBundleToken;
    if (!token) return;
    const currentKey = this.buildResourceSnapshotKey(response);
    const previousKey = this.buildResourceSnapshotKey(previousRaw);
    const isFirstSnapshot = !previousRaw;
    const keyChanged = currentKey ? currentKey !== previousKey : false;
    const alreadyPreloaded = currentKey ? this.lastPreloadedSnapshotKey === currentKey : false;
    if (!isFirstSnapshot && !keyChanged && !currentKey) return;
    if (alreadyPreloaded) return;

    const didLoad = await this.fetchGameResources(gameId, playerId, response, opts);
    if (didLoad && currentKey) {
      this.lastPreloadedSnapshotKey = currentKey;
    }
  }

  private async fetchGameResources(
    gameId: string,
    playerId: string,
    statusPayload: GameStatusResponse,
    opts: { allowEnvScanFallback?: boolean } = {},
  ): Promise<boolean> {
    try {
      if (this.resourceLoadInFlight) return false;
      if (!this.shouldFetchCombinedResourceBundle(statusPayload)) {
        this.log.debug("skip resource bundle fetch (phase not ready)", {
          gameId,
          playerId,
          phase: this.getPhase(statusPayload),
        });
        return false;
      }
      const token = (statusPayload as any)?.resourceBundleToken || (this.lastRaw as any)?.resourceBundleToken;
      if (!token) {
        this.log.debug("skip resource bundle fetch (missing resourceBundleToken)", { gameId, playerId });
        return false;
      }
      this.resourceLoadInFlight = true;
      const bundle = await this.match.getGameResourceBundle(token, {
        includePreviews: true,
        includeBothDecks: true,
        allowEnvScanFallback: opts.allowEnvScanFallback === true,
      });
      const loadResult = await this.resourceLoader.loadFromResourceBundle(bundle);
      this.events.emit(ENGINE_EVENTS.GAME_RESOURCE, { gameId, playerId, resources: { bundled: true }, loadResult, statusPayload });
      return true;

    } catch (err) {
      const status = (err as any)?.status;
      const pending = (err as any)?.data?.pending === true;
      if (status === 409 && pending) {
        this.log.debug("skip resource bundle fetch (deck pending)", { gameId, playerId });
        return false;
      }
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
      return false;
    } finally {
      this.resourceLoadInFlight = false;
    }
  }

  private shouldFetchCombinedResourceBundle(statusPayload: GameStatusResponse): boolean {
    const phase = String(this.getPhase(statusPayload) || "").toUpperCase();
    const blockedPhases = new Set(["WAITING_FOR_PLAYERS", "DECIDE_FIRST_PLAYER_PHASE"]);
    if (blockedPhases.has(phase)) return false;
    const env: any = statusPayload?.gameEnv || {};
    const players = env?.players && typeof env.players === "object" ? Object.keys(env.players).length : 0;
    if (players >= 2) return true;
    return !!env.playerId_1 && !!env.playerId_2;
  }

  private buildActionContext(): ActionContext {
    const ctx = this.contextStore.get();
    return {
      selection: this.selection.get(),
      gameId: ctx.gameId,
      playerId: ctx.playerId,
      runPlayCard: (payload) => this.api.playCard(payload as any),
      runEndTurn: (payload) => this.api.endTurn(payload as any),
      refreshStatus: () => this.updateGameStatus(ctx.gameId ?? undefined, ctx.playerId ?? undefined),
      pilotTargetUid: this.pilotTargetUid,
      clearSelection: () => this.clearSelection(),
      setPilotTarget: (uid?: string) => this.setPilotTarget(uid),
      //refreshStatus: () => this.test(),
    };
  }

  async test(){

  }

  private getBattle(payload: any) {
    return payload?.gameEnv?.currentBattle ?? payload?.gameEnv?.currentbattle ?? null;
  }

  private handleBattleTransition(prevBattle: any, nextBattle: any) {
    const prevActive = !!prevBattle;
    const nextActive = !!nextBattle;
    const nextStatus = (nextBattle?.status || "").toString().toUpperCase();
    const prevStatus = (prevBattle?.status || "").toString().toUpperCase();
    // Emit battle state change only when it actually changes to avoid UI resets on every poll.
    if (prevActive !== nextActive || prevStatus !== nextStatus) {
      this.events.emit(ENGINE_EVENTS.BATTLE_STATE_CHANGED, { active: nextActive, status: nextStatus });
    }
    if (!prevActive && nextActive && nextStatus === "ACTION_STEP") {
      // Surface a clear status change so UI can label the action step state.
      this.contextStore.update({ lastStatus: "Action Step" });
      this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
    }
    if (prevActive && !nextActive) {
      // When battle ends, ask UI to recompute buttons (e.g., restore End Turn).
      this.contextStore.update({ lastStatus: "Main Step" });
      this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE, this.getSnapshot());
    }
  }

  private registerBattleTransitionListeners() {
    const handler = () => this.processPendingBattleTransition();
    this.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE, handler);
    this.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, handler);
    this.events.on(ENGINE_EVENTS.PHASE_REDRAW, handler);
  }

  private processPendingBattleTransition() {
    if (!this.pendingBattleTransition) return;
    const { prevBattle, nextBattle } = this.pendingBattleTransition;
    this.pendingBattleTransition = undefined;
    this.handleBattleTransition(prevBattle, nextBattle);
  }
  private registerDefaultActions() {
    // Play base from hand
    this.actions.register("playBaseFromHand", async (ctx: ActionContext) => {
      
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "base") return;
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return;
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "base" },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
      
    });

    // Cancel
    this.actions.register("cancelSelection", async () => {
      this.clearSelection();
    });

    // Placeholder attack actions
    this.actions.register("attackUnit", async () => {
      this.log.debug("Attack Unit (placeholder)");
    });
    this.actions.register("attackShieldArea", async () => {
      this.log.debug("Attack Shield Area (placeholder)");
    });

    this.actions.register("slotAction", async (ctx: ActionContext) => {
      this.log.debug("Slot action triggered", ctx.selection);
    });

    this.actions.register("playUnitFromHand", async (ctx: ActionContext) => {
      if (this.unitFlow) return this.unitFlow.handlePlayUnit(ctx);
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "unit") return;
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return;
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "unit" },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
    });

    this.actions.register("playPilotFromHand", async (ctx: ActionContext) => {
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "pilot") return false;
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return false;
      if (!ctx.pilotTargetUid) {
        // Ask UI to show pilot target dialog; skip refresh for now.
        this.events.emit(ENGINE_EVENTS.PILOT_TARGET_DIALOG, { selection: sel });
        return false;
      }
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "pilot", targetUnit: ctx.pilotTargetUid },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
      this.pilotTargetUid = undefined;
      return true;
    });

    this.actions.register("playCommandFromHand", async (ctx: ActionContext) => {
      this.log.debug("play log from command");
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "command") return;
      if (this.commandFlow) return this.commandFlow.handlePlayCommand(ctx);
      if (sel.fromPilotDesignation && !isBattleActionStep(this.lastRaw)) {
        this.events.emit(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, { selection: sel });
        return;
      }
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return;
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "command" },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
    });

    this.actions.register("playPilotDesignationAsPilot", async (ctx: ActionContext) => {
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || !sel.fromPilotDesignation) {
        this.log.debug("no selecteds");
        return;
      }
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard){
        this.log.debug("no gameId, playerId, runPlayCard");
        return;
      }
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "pilot", targetUnit: ctx.pilotTargetUid },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
      this.pilotTargetUid = undefined;
    });

    this.actions.register("playPilotDesignationAsCommand", async (ctx: ActionContext) => {
      const sel = ctx.selection;
      if (!sel || sel.kind !== "hand" || !sel.fromPilotDesignation) return;
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return;
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: { type: "PlayCard", carduid: sel.uid, playAs: "command" },
      });
      await ctx.refreshStatus?.();
      this.clearSelection();
    });

    // End turn placeholder
    this.actions.register("endTurn", async (ctx: ActionContext) => {
      if (!ctx.gameId || !ctx.playerId || !ctx.runEndTurn) return;
      await ctx.runEndTurn({ gameId: ctx.gameId, playerId: ctx.playerId });
      await ctx.refreshStatus?.();
      ctx.clearSelection?.();
    });
  }

  private isMainPhase(phase: GamePhase | string | null | undefined) {
    return (phase ?? "").toString().toUpperCase() === "MAIN_PHASE";
  }
}
