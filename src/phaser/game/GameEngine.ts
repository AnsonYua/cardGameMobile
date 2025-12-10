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

export type GameStatusSnapshot = {
  status: any;
  raw: GameStatusResponse | null;
};

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private lastRaw: GameStatusResponse | null = null;
  private resourceLoader: CardResourceLoader;
  private selection = new SelectionStore();
  private actions = new ActionRegistry();
  private api: ApiManager;

  constructor(private scene: Phaser.Scene, private match: MatchStateMachine, private contextStore: GameContextStore) {
    this.resourceLoader = new CardResourceLoader(scene);
    this.api = new ApiManager(this.match.getApiBaseUrl());
    this.registerDefaultActions();
  }
  // Optional: call after scenario injection; when `fromScenario` is true we reuse any cached payload if present.
  async updateGameStatus(gameId?: string, playerId?: string, fromScenario = false) {
    if (!gameId || !playerId) return this.getSnapshot();
    const previousPhase = this.lastRaw?.gameEnv?.phase ?? this.lastRaw?.phase ?? null;
    try {
      const response: GameStatusResponse = fromScenario && this.lastRaw
        ? this.lastRaw
        : await this.match.getGameStatus(gameId, playerId);
      // Prefer explicit status fields, otherwise fall back to the entire payload.
      const derivedStatus = response?.status ?? response?.gameStatus ?? response;
      const nextPhase = response?.gameEnv?.phase ?? response?.phase ?? null;
      this.lastRaw = response;
      this.contextStore.update({ lastStatus: derivedStatus });
      this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
      if (fromScenario === true) {
        this.events.emit(ENGINE_EVENTS.MAIN_PHASE_UPDATE, this.getSnapshot());
      } else if (previousPhase !== GamePhase.Redraw && nextPhase === GamePhase.Redraw) {
        // Mark status as loading resources while fetching textures, then emit redraw after load.
        this.contextStore.update({ lastStatus: GameStatus.LoadingResources });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        await this.fetchGameResources(gameId, playerId, response);
        this.contextStore.update({ lastStatus: derivedStatus });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        this.events.emit(ENGINE_EVENTS.PHASE_REDRAW, this.getSnapshot());
      }

      return this.getSnapshot();
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
      throw err;
    }
  }

  getSnapshot(): GameStatusSnapshot {
    const ctx = this.contextStore.get();
    return { status: ctx.lastStatus, raw: this.lastRaw };
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

  getSelection() {
    return this.selection.get();
  }

  getAvailableActions(): ActionDescriptor[] {
    const ctx = this.buildActionContext();
    const selection = ctx.selection;
    const descriptors: ActionDescriptor[] = [];
    // Play base from hand
    const canPlayBase =
      selection?.kind === "hand" &&
      (selection.cardType || "").toLowerCase() === "base" &&
      !!ctx.gameId &&
      !!ctx.playerId &&
      !!selection.uid;
    descriptors.push({
      id: "playBaseFromHand",
      label: "Play Card",
      enabled: !!canPlayBase,
    });
    // Cancel/clear selection
    descriptors.push({
      id: "cancelSelection",
      label: "Cancel",
      enabled: !!selection,
    });
    // End turn as default primary
    descriptors.push({
      id: "endTurn",
      label: "End Turn",
      enabled: true,
      primary: true,
    });
    return descriptors;
  }

  async runAction(id: string) {
    const handler = this.actions.get(id);
    if (!handler) return;
    const ctx = this.buildActionContext();
    await handler(ctx);
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
      refreshStatus: () => this.updateGameStatus(ctx.gameId ?? undefined, ctx.playerId ?? undefined),
      //refreshStatus: () => this.test(),
    };
  }

  async test(){

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

    // End turn placeholder
    this.actions.register("endTurn", async () => {
      console.log("End Turn triggered (stub)");
    });
  }
}
