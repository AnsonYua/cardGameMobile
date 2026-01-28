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
  getActivatedEffectState,
  getSlotCard,
  hasPairableUnit,
} from "./actionEligibility";
import { createLogger } from "../utils/logger";

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
  // Optional: call after scenario injection; when `fromScenario` is true we reuse any cached payload if present.
  async updateGameStatus(
    gameId?: string,
    playerId?: string,
    opts: { fromScenario?: boolean; silent?: boolean; statusPayload?: GameStatusResponse | null } = {},
  ) {
    if (!gameId || !playerId) return this.getSnapshot();
    const snapshotNow = () => this.getSnapshot();
    const fromScenario = opts.fromScenario === true;
    const silent = opts.silent === true || fromScenario;
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
      this.logStatusPoll(gameId, playerId, response);
      this.logStatusQueues(response);

      // Prefer explicit status fields, otherwise fall back to the entire payload.
      // If the backend omits a status (common during polling), keep the last known status so UI (header) doesn't revert.
      // Only fall back to the full response if it's a string; otherwise use the previous status.
      const derivedStatus = this.deriveStatus(response, previousGameEnv.status);
      const nextGameEnv = {
        phase: this.getPhase(response),
        battle: this.getBattle(response),
        status: derivedStatus,
      };

      this.previousRaw = previousGameEnv.raw;
      this.lastRaw = response;
      this.pendingBattleTransition = { prevBattle: previousGameEnv.battle, nextBattle: nextGameEnv.battle };

      this.contextStore.update({ lastStatus: nextGameEnv.status });
      this.events.emit(ENGINE_EVENTS.STATUS, snapshotNow());
      this.log.debug("update game status", snapshotNow());

      if (silent) {
        // Scenario loads should update UI without animations.
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, snapshotNow());
      } else if (previousGameEnv.phase !== GamePhase.Redraw && nextGameEnv.phase === GamePhase.Redraw) {
        // Mark status as loading resources while fetching textures, then emit redraw after load.
        this.contextStore.update({ lastStatus: GameStatus.LoadingResources });
        this.events.emit(ENGINE_EVENTS.STATUS, snapshotNow());
        await this.fetchGameResources(gameId, playerId, response);
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

  private logStatusPoll(gameId: string, playerId: string, response: GameStatusResponse) {
    this.log.debug("status poll", {
      gameId,
      playerId,
      phase: response?.gameEnv?.phase,
      version: response?.gameEnv?.version,
    });
  }

  private logStatusQueues(response: GameStatusResponse) {
    const processingQueue = response?.gameEnv?.processingQueue ?? [];
    const notificationQueue = response?.gameEnv?.notificationQueue ?? [];
    const processingTypes = Array.isArray(processingQueue) ? processingQueue.map((item) => item?.type ?? "unknown") : [];
    const notificationTypes = Array.isArray(notificationQueue)
      ? notificationQueue.map((item) => item?.type ?? "unknown")
      : [];
    this.log.debug("status payload", {
      currentPlayer: response?.gameEnv?.currentPlayer,
      processingQueue: processingTypes,
      notificationQueue: notificationTypes,
      processingTypesText: processingTypes.join(","),
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
      const cardType = (selection.cardType || "").toLowerCase();
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
        descriptors.push({
          id: "playCommandFromHand",
          label: "Play Card",
          enabled: canPlay && hasTimingWindow,
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
      const slotCard = getSlotCard(selection, this.lastRaw, ctx.playerId);
      const slotCardType = (slotCard?.cardData?.cardType || "").toLowerCase();
      if (slotCardType === "unit" || slotCardType === "base") {
        const raw = this.lastRaw as any;
        const playerId = this.contextStore.get().playerId;
        const effectState = getActivatedEffectState(slotCard, raw, playerId);
        if (effectState?.effectId) {
          descriptors.push({
            id: "activateEffect",
            label: "Activate Effect",
            enabled: effectState.enabled,
            primary: true,
          });
        }
      }
      if (descriptors.length) {
        descriptors.push({
          id: "cancelSelection",
          label: "Cancel",
          enabled: true,
        });
      }
      return descriptors;
    }

    if (source === "base" && selection?.kind === "base") {
      const raw = this.lastRaw as any;
      const playerId = this.contextStore.get().playerId;
      if (selection.side === "player" && raw && playerId) {
        const baseCard = findBaseCard(raw, playerId);
        const effectState = getActivatedEffectState(baseCard, raw, playerId);
        if (effectState?.effectId) {
          descriptors.push({
            id: "activateEffect",
            label: "Active Effect",
            enabled: effectState.enabled,
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

  async loadGameResources(gameId: string, playerId: string, statusPayload?: GameStatusResponse) {
    return this.fetchGameResources(gameId, playerId, statusPayload ?? this.lastRaw ?? {});
  }

  private async fetchGameResources(gameId: string, playerId: string, statusPayload: GameStatusResponse) {
    try {
      const resources = await this.match.getGameResource(gameId, playerId);
      const loadResult = await this.resourceLoader.loadFromGameStatus(resources, this.match.getApiBaseUrl());
      this.events.emit(ENGINE_EVENTS.GAME_RESOURCE, { gameId, playerId, resources, loadResult, statusPayload });
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
    }
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

    this.actions.register("inspectBase", async (ctx: ActionContext) => {
      this.log.debug("Base action triggered", ctx.selection);
    });

    this.actions.register("activateEffect", async (ctx: ActionContext) => {
      const sel = ctx.selection;
      if (!sel || !ctx.gameId || !ctx.playerId) return;
      if (sel.kind === "base") {
        const raw = this.lastRaw as any;
        const baseCard = findBaseCard(raw, ctx.playerId);
        const effectState = getActivatedEffectState(baseCard, raw, ctx.playerId);
        if (!baseCard || !effectState?.effectId) return;
        const carduid =
          baseCard?.carduid ?? baseCard?.cardUid ?? baseCard?.uid ?? baseCard?.id ?? baseCard?.cardId;
        if (!carduid) return;
        try {
          await this.api.playerAction({
            playerId: ctx.playerId,
            gameId: ctx.gameId,
            actionType: "activateCardAbility",
            carduid,
            effectId: effectState.effectId,
          });
          await ctx.refreshStatus?.();
          this.clearSelection();
        } catch (err) {
          void err;
        }
        return;
      }
      if (sel.kind === "slot") {
        this.log.debug("Active effect slot selection placeholder");
        this.clearSelection();
      }
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
      if (sel.fromPilotDesignation) {
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
