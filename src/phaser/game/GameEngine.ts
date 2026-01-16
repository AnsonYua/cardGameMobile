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

export type GameStatusSnapshot = {
  status: any;
  raw: GameStatusResponse | null;
  previousRaw: GameStatusResponse | null;
};

export type ActionSource = "hand" | "slot" | "base" | "neutral";

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
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
    const fromScenario = opts.fromScenario === true;
    const silent = opts.silent === true || fromScenario;
    const previousPhase = this.lastRaw?.gameEnv?.phase ?? this.lastRaw?.phase ?? null;
    const previousBattle = this.getBattle(this.lastRaw);
    const previousStatus = this.contextStore.get().lastStatus;
    try {
      const forcedPayload = opts.statusPayload ?? null;
      const response: GameStatusResponse = forcedPayload
        ? forcedPayload
        : fromScenario && this.lastRaw
        ? this.lastRaw
        : await this.match.getGameStatus(gameId, playerId);
      // eslint-disable-next-line no-console
      console.log("[GameEngine] status poll", {
        gameId,
        playerId,
        phase: response?.gameEnv?.phase,
        version: response?.gameEnv?.version,
      });
      // Prefer explicit status fields, otherwise fall back to the entire payload.
      // If the backend omits a status (common during polling), keep the last known status so UI (header) doesn't revert.
      // Only fall back to the full response if it's a string; otherwise use the previous status.
      const fallback = typeof response === "string" ? response : previousStatus;
      const derivedStatus = response?.status ?? response?.gameStatus ?? fallback;
      const nextPhase = response?.gameEnv?.phase ?? response?.phase ?? null;
      this.previousRaw = this.lastRaw;
      this.lastRaw = response;
      const nextBattle = this.getBattle(this.lastRaw);
      this.pendingBattleTransition = { prevBattle: previousBattle, nextBattle };
      this.contextStore.update({ lastStatus: derivedStatus });
      this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
      console.log("update game status ",JSON.stringify(this.getSnapshot()))
      if (silent) {
        // Scenario loads should update UI without animations.
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, this.getSnapshot());
      } else if (previousPhase !== GamePhase.Redraw && nextPhase === GamePhase.Redraw) {
        // Mark status as loading resources while fetching textures, then emit redraw after load.
        this.contextStore.update({ lastStatus: GameStatus.LoadingResources });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        await this.fetchGameResources(gameId, playerId, response);
        this.contextStore.update({ lastStatus: derivedStatus });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        this.events.emit(ENGINE_EVENTS.PHASE_REDRAW, this.getSnapshot());
      } else {
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE, this.getSnapshot());
      }
      /*
      if lastStatus is not mainPhase and new status is mainPhase 
       trigger this.refreshActions("neutral"); in BoardScene
      */
      const enteredMainPhase = !this.isMainPhase(previousPhase) && this.isMainPhase(nextPhase);
      if (enteredMainPhase) {
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_ENTER, this.getSnapshot());
        this.contextStore.update({ lastStatus: "Main Step" });
      }

      return this.getSnapshot();
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
      throw err;
    }
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
      const canPlay = canRun && this.canPlaySelectedHandCard(selection);
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
        descriptors.push({
          id: "playPilotFromHand",
          label: "Play Card",
          enabled: canPlay,
          primary: true,
        });
      } else if (cardType === "command") {
        descriptors.push({
          id: "playCommandFromHand",
          label: "Play Card",
          enabled: canPlay,
          primary: true,
        });
      }


      // Cancel/clear selection is available when anything is selected.
      descriptors.push({
        id: "cancelSelection",
        label: "Cancel",
        enabled: !!selection,
      });

      return descriptors
    }

    if (source === "slot" && selection?.kind === "slot") {
      descriptors.push({
        id: "slotAction",
        label: "Use Slot",
        enabled: true,
        primary: true,
      });
    }

    if (source === "base" && selection?.kind === "base") {
      const raw = this.lastRaw as any;
      const playerId = this.contextStore.get().playerId;
      if (selection.side === "player" && raw && playerId) {
        const baseCard = findBaseCard(raw, playerId);
        const effectState = this.getActivatedEffectState(baseCard, raw, playerId);
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

  private canPlaySelectedHandCard(selection: SelectionTarget) {
    if (selection.kind !== "hand") return false;
    const raw = this.lastRaw as any;
    const playerId = this.contextStore.get().playerId;
    const player = raw?.gameEnv?.players?.[playerId];
    if (!player) return true;
    const hand = player?.deck?.hand ?? [];
    const target = Array.isArray(hand)
      ? hand.find((card: any) => {
          const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
          return uid === selection.uid;
        })
      : undefined;
    if (!target) return true;
    const cardData = target?.cardData ?? {};
    const cardType = (cardData.cardType || selection.cardType || "").toLowerCase();
    const isEnergy = cardType === "energy";
    if (isEnergy) return true;

    const { totalEnergy, availableEnergy } = this.getEnergyState(player);
    const requiredLevel = Number(cardData.level ?? 0);
    const requiredCost = Number(cardData.cost ?? 0);
    const level = Number.isNaN(requiredLevel) ? 0 : requiredLevel;
    const cost = Number.isNaN(requiredCost) ? 0 : requiredCost;
    if (totalEnergy < level) return false;
    if (availableEnergy < cost) return false;
    return true;
  }

  async test(){

  }

  private getEnergyState(player: any) {
    const energyArea = player?.zones?.energyArea ?? player?.energyArea ?? [];
    const totalEnergy = Array.isArray(energyArea) ? energyArea.length : 0;
    const availableEnergy = Array.isArray(energyArea)
      ? energyArea.filter((entry: any) => entry && entry.isRested === false).length
      : 0;
    return { totalEnergy, availableEnergy };
  }

  private getActivatedEffectRule(cardData?: any) {
    const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    return rules.find((rule) => {
      if ((rule?.type || "").toString().toLowerCase() !== "activated") return false;
      const windows = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
      return windows.some((window: string) => window.toString().toUpperCase() === "MAIN_PHASE");
    });
  }

  private getActivatedEffectState(baseCard: any, raw: any, playerId: string) {
    if (!baseCard || !raw || !playerId) return undefined;
    const effectRule = this.getActivatedEffectRule(baseCard?.cardData);
    if (!effectRule?.effectId) return undefined;
    const player = raw?.gameEnv?.players?.[playerId];
    const { availableEnergy } = this.getEnergyState(player);
    const required = Number(effectRule?.cost?.resource ?? 0);
    const requiredEnergy = Number.isFinite(required) ? required : 0;
    const currentTurn = raw?.gameEnv?.currentTurn;
    const lastUsed = baseCard?.effectUsage?.[effectRule.effectId]?.lastUsedTurn;
    const oncePerTurn = effectRule?.cost?.oncePerTurn === true;
    const alreadyUsed = oncePerTurn && currentTurn !== undefined && lastUsed === currentTurn;
    const isMainPhase = raw?.gameEnv?.phase === "MAIN_PHASE";
    const isSelfTurn = raw?.gameEnv?.currentPlayer === playerId;
    return {
      effectId: effectRule.effectId,
      enabled: isMainPhase && isSelfTurn && availableEnergy >= requiredEnergy && !alreadyUsed,
    };
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
      console.log("Attack Unit (placeholder)");
    });
    this.actions.register("attackShieldArea", async () => {
      console.log("Attack Shield Area (placeholder)");
    });

    this.actions.register("slotAction", async (ctx: ActionContext) => {
      console.log("Slot action triggered", ctx.selection);
    });

    this.actions.register("inspectBase", async (ctx: ActionContext) => {
      console.log("Base action triggered", ctx.selection);
    });

    this.actions.register("activateEffect", async (ctx: ActionContext) => {
      const sel = ctx.selection;
      if (!sel || !ctx.gameId || !ctx.playerId) return;
      if (sel.kind === "base") {
        const raw = this.lastRaw as any;
        const baseCard = findBaseCard(raw, ctx.playerId);
        const effectState = this.getActivatedEffectState(baseCard, raw, ctx.playerId);
        if (!baseCard || !effectState?.effectId) return;
        const carduid =
          baseCard?.carduid ?? baseCard?.cardUid ?? baseCard?.uid ?? baseCard?.id ?? baseCard?.cardId;
        if (!carduid) return;
        try {
          await this.api.playerAction({
            playerId: ctx.playerId,
            gameId: ctx.gameId,
            actionType: "activateBaseAbility",
            carduid,
            effectId: effectState.effectId,
          });
          await ctx.refreshStatus?.();
          this.clearSelection();
        } catch (err) {
          console.warn("activateBaseAbility failed", err);
        }
        return;
      }
      if (sel.kind === "slot") {
        console.log("Active effect slot selection placeholder");
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
      console.log("play log from command")
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
        console.log("no selecteds")
        return;
      }
      if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard){
        console.log("no gameId , playerId , runPlayCard")
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
