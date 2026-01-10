import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";
import { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import { ShieldAreaStatus } from "./ui/ShieldAreaHandler";
import { ApiManager } from "./api/ApiManager";
import { GameSessionService, GameStatus, GameMode } from "./game/GameSessionService";
import { MatchStateMachine } from "./game/MatchStateMachine";
import { GameEngine, type GameStatusSnapshot, type ActionSource } from "./game/GameEngine";
import type { GameStatusResponse } from "./game/GameTypes";
import { ActionDispatcher } from "./controllers/ActionDispatcher";
import { GameContextStore } from "./game/GameContextStore";
import { parseSessionParams } from "./game/SessionParams";
import { ENGINE_EVENTS } from "./game/EngineEvents";
import { DebugControls } from "./controllers/DebugControls";
import { TurnStateController } from "./game/TurnStateController";
import { HandPresenter } from "./ui/HandPresenter";
import { SlotPresenter } from "./ui/SlotPresenter";
import type { SlotViewModel, SlotOwner } from "./ui/SlotTypes";
import { PilotTargetDialog } from "./ui/PilotTargetDialog";
import { PilotDesignationDialog } from "./ui/PilotDesignationDialog";
import { EffectTargetDialog } from "./ui/EffectTargetDialog";
import { TrashAreaDialog } from "./ui/TrashAreaDialog";
import { DrawPopupDialog } from "./ui/DrawPopupDialog";
import { PhaseChangeDialog } from "./ui/PhaseChangeDialog";
import { MulliganDialog } from "./ui/MulliganDialog";
import { PilotFlowController } from "./controllers/PilotFlowController";
import { CommandFlowController } from "./controllers/CommandFlowController";
import { UnitFlowController } from "./controllers/UnitFlowController";
import { createSelectionActionController } from "./controllers/SelectionActionControllerFactory";
import type { SelectionActionController } from "./controllers/SelectionActionController";
import { EffectTargetController } from "./controllers/EffectTargetController";
import type { AnimationQueue } from "./animations/AnimationQueue";
import type { SlotAnimationRenderController } from "./animations/SlotAnimationRenderController";
import { createAnimationPipeline } from "./controllers/AnimationPipeline";
import { type TargetAnchorProviders } from "./utils/AttackResolver";
import { OverlayController } from "./controllers/OverlayController";
import { getNotificationQueue } from "./utils/NotificationUtils";
import { findBaseCard, findCardByUid } from "./utils/CardLookup";

const colors = {
  bg: "#ffffff",
  board: "#1a1d26",
  slot: "#2a2d38",
  accent: "#d0d5e0",
  pill: "#2f3342",
  text: "#f5f6fb",
ink: "#0f1118",
};

export class BoardScene extends Phaser.Scene {
  constructor() {
    super("BoardScene");
  }

  preload() {
    this.load.image("deckBack", "/cardback.png");
    this.load.image("baseCard", "/ex-base.png");
    this.load.image("playmat", "/playmart.png");
  }

  private offset = { x: 0, y: 0 };
  private ui: BoardUI | null = null;
  private shuffleManager: ShuffleAnimationManager | null = null;
  private playerBaseStatus: ShieldAreaStatus = "normal";
  private playerShieldCount = 6;
  private offlineFallback = false;
  private baseControls: ReturnType<BoardUI["getBaseControls"]> | null = null;
  private trashControls: ReturnType<BoardUI["getTrashControls"]> | null = null;
  private energyControls: ReturnType<BoardUI["getEnergyControls"]> | null = null;
  private statusControls: ReturnType<BoardUI["getStatusControls"]> | null = null;
  private handControls: ReturnType<BoardUI["getHandControls"]> | null = null;
  private actionControls: ReturnType<BoardUI["getActionControls"]> | null = null;
  private api = new ApiManager();
  private session = new GameSessionService(this.api);
  private match = new MatchStateMachine(this.session);
  private contextStore = new GameContextStore();
  private engine = new GameEngine(this, this.match, this.contextStore);
  private gameContext = this.contextStore.get();
  private handPresenter = new HandPresenter();
  private slotPresenter = new SlotPresenter();
  private turnController = new TurnStateController();

  private headerControls: ReturnType<BoardUI["getHeaderControls"]> | null = null;
  private actionDispatcher = new ActionDispatcher();
  private debugControls?: DebugControls;
  private loadingText?: Phaser.GameObjects.Text;
  private slotControls: ReturnType<BoardUI["getSlotControls"]> | null = null;
  private selectionAction?: SelectionActionController;
  private effectTargetController?: EffectTargetController;
  private pilotTargetDialogUi?: PilotTargetDialog;
  private pilotDesignationDialogUi?: PilotDesignationDialog;
  private effectTargetDialogUi?: EffectTargetDialog;
  private trashAreaDialogUi?: TrashAreaDialog;
  private drawPopupDialogUi?: DrawPopupDialog;
  private phaseChangeDialogUi?: PhaseChangeDialog;
  private mulliganDialogUi?: MulliganDialog;
  private pilotFlow?: PilotFlowController;
  private commandFlow?: CommandFlowController;
  private unitFlow?: UnitFlowController;
  private overlay?: OverlayController;
  private animationQueue?: AnimationQueue;
  private slotAnimationRender?: SlotAnimationRenderController;
  private startGameAnimating = false;
  private startGameCompleted = false;

  create() {
    // Center everything based on the actual viewport, not just BASE_W/H.
    const cam = this.cameras.main;
    this.offset.x = cam.centerX - BASE_W / 2;
    this.offset.y = cam.centerY - BASE_H / 2;
    console.log("offset y ", cam.centerY)



    this.cameras.main.setBackgroundColor(colors.bg);
    this.ui = new BoardUI(this, {
      ink: colors.ink,
      slot: colors.slot,
      accent: colors.accent,
      text: colors.text,
      bg: colors.bg,
    });
    this.shuffleManager = new ShuffleAnimationManager(this, this.offset, {
      getSlotPositions: () => this.slotControls?.getBoardSlotPositions?.(),
    });
    this.baseControls = this.ui.getBaseControls();
    this.trashControls = this.ui.getTrashControls();
    this.energyControls = this.ui.getEnergyControls();
    this.statusControls = this.ui.getStatusControls();
    this.handControls = this.ui.getHandControls();
    this.slotControls = this.ui.getSlotControls();
    this.drawPopupDialogUi = new DrawPopupDialog(this);
    this.phaseChangeDialogUi = new PhaseChangeDialog(this);
    this.mulliganDialogUi = new MulliganDialog(this);
    const animationPipeline = createAnimationPipeline({
      scene: this,
      slotControls: this.slotControls,
      handControls: this.handControls,
      drawPopupDialog: this.drawPopupDialogUi,
      mulliganDialog: this.mulliganDialogUi,
      phaseChangeDialog: this.phaseChangeDialogUi,
      startGame: () => this.startGame(),
      startReady: async (isRedraw) => {
        const gameId = this.gameContext.gameId;
        const playerId = this.gameContext.playerId;
        if (!gameId || !playerId) {
          console.warn("[startReady] missing gameId/playerId", { gameId, playerId });
          return;
        }
        await this.api.startReady({ gameId, playerId, isRedraw });
        await this.engine.updateGameStatus(gameId, playerId);
      },
      resolveSlotOwnerByPlayer: this.resolveSlotOwnerByPlayer.bind(this),
      getTargetAnchorProviders: () => this.getTargetAnchorProviders(),
      getSlotsFromRaw: (data) => this.slotPresenter.toSlots(data, this.gameContext.playerId),
    });
    this.animationQueue = animationPipeline.animationQueue;
    this.slotAnimationRender = animationPipeline.slotAnimationRender;
    this.animationQueue.setOnIdle(() => this.handleAnimationQueueIdle());
    this.animationQueue.setOnEventStart((event, ctx) => {
      const slots = this.slotAnimationRender?.handleEventStart(
        event,
        this.slotPresenter.toSlots(ctx.currentRaw ?? ctx.previousRaw, this.gameContext.playerId),
      );
      if (slots) {
        this.renderSlots(slots);
      }
    });
    this.animationQueue.setOnEventEnd((event, ctx) => {
      const slots = this.slotAnimationRender?.handleEventEnd(event, ctx);
      if (slots) {
        this.renderSlots(slots);
      }
      if (this.shouldRefreshHandForEvent(event)) {
        this.updateHandArea({ skipAnimation: true });
        this.handControls?.scrollToEnd?.(true);
      }
    });
    this.headerControls = this.ui.getHeaderControls();
    this.actionControls = this.ui.getActionControls();
    this.debugControls = new DebugControls(this, this.match, this.engine, this.gameContext);
    this.engine.events.on(ENGINE_EVENTS.BATTLE_STATE_CHANGED, (payload: { active: boolean; status: string }) => {
      const status = (payload.status || "").toUpperCase();
      if (payload.active && status === "ACTION_STEP") {
        this.headerControls?.setStatusFromEngine?.("Action Step", { offlineFallback: this.offlineFallback });
      }
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE, (snapshot: GameStatusSnapshot) => {
      this.mainPhaseUpdate(false, snapshot);
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, (snapshot: GameStatusSnapshot) => {
      this.mainPhaseUpdate(true, snapshot);
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_ENTER, () => {
      this.selectionAction?.refreshActions("neutral");
    });
    this.engine.events.on(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, () => {
      this.pilotFlow?.showPilotDesignationDialog();
    });
    this.engine.events.on(ENGINE_EVENTS.PILOT_TARGET_DIALOG, () => {
      this.pilotFlow?.showPilotTargetDialog("playPilotFromHand");
    });
    this.engine.events.on(ENGINE_EVENTS.GAME_RESOURCE, (payload: any) => {
      console.log("Game resources fetched", payload?.resources);
    });
    this.engine.events.on(ENGINE_EVENTS.LOADING_START, () => this.showLoading());
    this.engine.events.on(ENGINE_EVENTS.LOADING_END, () => this.hideLoading());
    this.pilotTargetDialogUi = new PilotTargetDialog(
      this,
      (slot, size) => this.slotControls?.createSlotSprite?.(slot, size),
    );
    this.pilotDesignationDialogUi = new PilotDesignationDialog(this);
    this.effectTargetDialogUi = new EffectTargetDialog(
      this,
      (slot, size) => this.slotControls?.createSlotSprite?.(slot, size),
    );
    this.trashAreaDialogUi = new TrashAreaDialog(this);
    this.effectTargetController = new EffectTargetController({
      dialog: this.effectTargetDialogUi,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      engine: this.engine,
      api: this.api,
      scene: this,
      getSlotAreaCenter: (owner) => this.slotControls?.getSlotAreaCenter?.(owner),
    });
    this.selectionAction = createSelectionActionController({
      engine: this.engine,
      api: this.api,
      slotPresenter: this.slotPresenter,
      handPresenter: this.handPresenter,
      handControls: this.handControls,
      slotControls: this.slotControls,
      actionControls: this.actionControls,
      effectTargetController: this.effectTargetController,
      gameContext: this.gameContext,
      refreshPhase: (skipFade) => this.refreshPhase(skipFade),
      showOverlay: (message, slot) => {
        if (!this.overlay) {
          this.overlay = new OverlayController(this);
        }
        const positions = this.slotControls?.getBoardSlotPositions?.();
        const target = slot ? positions?.[slot.owner]?.[slot.slotId] : undefined;
        const fallback = slot ? this.slotControls?.getSlotAreaCenter?.(slot.owner) : undefined;
        const x = target?.x ?? fallback?.x ?? this.scale.width * 0.5;
        const y = target?.y ?? fallback?.y ?? this.scale.height * 0.5;
        this.overlay.show(message, x, y);
        this.time.delayedCall(2000, () => this.overlay?.hide());
      },
    });
    this.pilotFlow = new PilotFlowController({
      scene: this,
      engine: this.engine,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      pilotTargetDialog: this.pilotTargetDialogUi,
      pilotDesignationDialog: this.pilotDesignationDialogUi,
      runActionThenRefresh: this.runActionThenRefresh.bind(this),
    });
    this.commandFlow = new CommandFlowController(this.engine);
    this.unitFlow = new UnitFlowController();
    this.engine.setFlowControllers({ commandFlow: this.commandFlow, unitFlow: this.unitFlow });
    this.debugControls.exposeTestHooks(this.buildTestHooks());

    this.setupActions();
    this.wireUiHandlers();
    this.ui.drawAll(this.offset);
    this.hideDefaultUI();

    // Kick off game session on load (host flow placeholder).
    this.initSession();
  }

  private buildTestHooks() {
    const selectHandCard = (uid?: string) => {
      if (!uid) return false;
      const snapshot = this.engine.getSnapshot();
      const raw = snapshot.raw as any;
      if (!raw) return false;
      const cards = this.handPresenter.toHandCards(raw, this.gameContext.playerId);
      const target = cards.find((c) => c.uid === uid);
      if (!target) return false;
      this.selectionAction?.handleHandCardSelected(target);
      return true;
    };
    const clickPrimaryAction = async (source: ActionSource = "hand") => {
      const actions = this.engine.getAvailableActions(source);
      const primary = actions.find((a) => a.primary) || actions[0];
      if (!primary) return false;
      await this.runActionThenRefresh(primary.id, source);
      return true;
    };
    const runAction = async (id: string, source: ActionSource = "neutral") => {
      await this.runActionThenRefresh(id, source);
      return true;
    };
    const selectEffectTarget = async (targetIndex = 0) => {
      const selected = await this.effectTargetDialogUi?.selectTarget(targetIndex);
      if (selected) {
        await this.effectTargetDialogUi?.hide();
        return true;
      }
      console.warn("Effect target dialog is not open; cannot select target");
      return false;
    };
    const selectPilotTarget = async (targetIndex = 0) => {
      // Drive the real dialog callback; avoid snapshot/fallback logic to mirror UI flow.
      const selectedInDialog = await this.pilotTargetDialogUi?.selectTarget(targetIndex);
      if (selectedInDialog) {
        await this.pilotTargetDialogUi?.hide();
        return true;
      }
      console.warn("Pilot target dialog is not open; cannot select target");
      return false;
    };
    const choosePilotDesignationPilot = async () => {
      this.pilotFlow?.showPilotTargetDialog("playPilotDesignationAsPilot");
      return true;
    };
    const choosePilotDesignationCommand = async () => {
      await this.runActionThenRefresh("playPilotDesignationAsCommand", "neutral");
      return true;
    };
    const hooks = {
      selectHandCard,
      clickPrimaryAction,
      runAction,
      selectEffectTarget,
      selectPilotTarget,
      choosePilotDesignationPilot,
      choosePilotDesignationCommand,
    };
    return hooks;
  }
   
  public async startGame(): Promise<void> {
    this.session.markInMatch();
    this.startGameCompleted = false;
    this.startGameAnimating = true;
    this.hideDefaultUI();
    const promise = this.shuffleManager?.play();

    try {
      if (promise && typeof promise.then === "function") {
        await promise;
        this.startGameAnimating = false;
        this.startGameCompleted = true;
        this.showDefaultUI();
        this.refreshPhase(false);
        console.log("Shuffle animation finished");
      } else {
        this.startGameAnimating = false;
        this.startGameCompleted = true;
        this.showDefaultUI();
        this.refreshPhase(false);
      }
    } finally {
      this.startGameAnimating = false;
    }
  }

  public mainPhaseUpdate(skipAnimation = true, snapshot?: GameStatusSnapshot) {
    if (snapshot) {
      this.gameContext.lastStatus = snapshot.status;
    }
    this.refreshPhase(skipAnimation);
  }

  private refreshPhase(skipAnimation: boolean) {
    const raw = this.engine.getSnapshot().raw as any;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    console.log("[refreshPhase] skipAnimation", skipAnimation, "battle?", battle);
    this.updateHeaderPhaseStatus(raw);
    this.updateMainPhaseUI(raw, skipAnimation);
    if (raw) {
      void this.effectTargetController?.syncFromSnapshot(raw);
    }
  }

  private updateMainPhaseUI(raw: any, skipAnimation: boolean) {
    this.updateHeaderOpponentHand(raw);
    this.updateEnergyStatus(raw);
    this.showUI(!skipAnimation);
    const deferHand = this.shouldDeferHandUpdate(raw, skipAnimation);
    this.updateHandArea({ skipAnimation, deferForAnimation: deferHand });
    this.updateSlots({ animate: !skipAnimation });
    this.updateBaseAndShield();
    this.refreshActionBarState(raw);
  }

  // Placeholder helpers so the flow is explicit; wire up to real UI show/hide logic later.
  private hideDefaultUI() {
    this.hideUI();
  }

  private showDefaultUI() {
    this.showUI(true);
  }

  // Directly control UI chrome visibility; base/shield rendering is handled separately.
  private showUI(fade: boolean) {
    const energy = this.energyControls;
    const status = this.statusControls;
    const hand = this.handControls;
    const actions = this.actionControls;

    energy?.setVisible(true);
    status?.setVisible(true);
    hand?.setVisible(true);
    actions?.setVisible(true);

    if (fade) {
      energy?.fadeIn();
      status?.fadeIn();
      hand?.fadeIn();
      //actions?.fadeIn?.();
    }
  }

  private hideUI() {
    const base = this.baseControls;
    const energy = this.energyControls;
    const status = this.statusControls;
    const hand = this.handControls;
    const actions = this.actionControls;
    base?.setBaseTowerVisible(true, false);
    base?.setBaseTowerVisible(false, false);
    energy?.setVisible(false);
    status?.setVisible(false);
    hand?.setVisible(false);
    actions?.setVisible(true);
  }

  private updateHeaderOpponentHand(raw: any) {
    const players = raw?.gameEnv?.players || {};
    const playerIds = Object.keys(players);
    const selfId =
      (this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : undefined) ||
      playerIds[0];
    const opponentId = playerIds.find((id) => id !== selfId) || playerIds[0] || "playerId_1";
    const opponent = players?.[opponentId] || {};
    const hand = opponent?.deck?.hand;
    const handUids = opponent?.deck?.handUids;
    let opponentHand: number | string = "-";
    if (typeof hand?.length === "number") {
      opponentHand = hand.length;
    } else if (Array.isArray(hand)) {
      opponentHand = hand.length;
    } else if (hand && typeof hand === "object") {
      opponentHand = Object.keys(hand).length;
    } else if (Array.isArray(handUids)) {
      opponentHand = handUids.length;
    }
    this.ui?.updateHeader({ opponentHand });
  }

  private updateEnergyStatus(raw: any) {
    const players = raw?.gameEnv?.players || {};
    const ids = Object.keys(players);
    if (!ids.length) return;
    const selfId = (this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : undefined) || ids[0];
    const opponentId = ids.find((id) => id !== selfId) || ids[0];
    const summarize = (player: any) => {
      const zones = player?.zones || player?.zone || {};
      const shieldArea = zones.shieldArea || player?.shieldArea || [];
      const energyArea = zones.energyArea || player?.energyArea || [];
      const shield = Array.isArray(shieldArea) ? shieldArea.length : 0;
      const energies = Array.isArray(energyArea) ? energyArea : [];
      const active = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === false).length;
      const rested = energies.filter((e) => e && e.isRested === true && e.isExtraEnergy === false).length;
      const extra = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === true).length;
      return { shield, active, rested, extra };
    };
    const selfStatus = summarize(players[selfId]);
    const oppStatus = summarize(players[opponentId]);
    this.energyControls?.update?.(false, selfStatus);
    this.energyControls?.update?.(true, oppStatus);
  }

  private updateHandArea(opts: { skipAnimation?: boolean; deferForAnimation?: boolean } = {}) {
    if (opts.deferForAnimation) return;
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    
    if (this.shouldHideHandForStartGame(raw)) {
      this.handControls?.setVisible(false);
      return;
    }
    this.updateHeaderOpponentHand(raw);
    this.updateEnergyStatus(raw);
    const playerId = this.gameContext.playerId;
    const cards = this.handPresenter.toHandCards(raw, playerId);
    if (!cards.length) return;
    const selectedUid = this.selectionAction?.getSelectedHandCard()?.uid;
    this.handControls?.setHand(cards, { preserveSelectionUid: selectedUid });
    this.handControls?.setVisible(true);
    if (!opts.skipAnimation) {
      this.handControls?.fadeIn();
    }
  }

  private shouldDeferHandUpdate(raw: any, skipAnimation: boolean) {
    if (skipAnimation) return false;
    if (!this.animationQueue) return false;
    const playerId = this.gameContext.playerId;
    if (!playerId) return false;
    const notifications = getNotificationQueue(raw);
    if (!notifications.length) return false;
    return notifications.some((note) => {
      if (!note?.id) return false;
      const type = (note.type || "").toUpperCase();
      if (type === "INIT_HAND") {
        return note.payload?.playerId === playerId && !this.animationQueue?.isProcessed(note.id);
      }
      if (type !== "CARD_DRAWN" && type !== "CARD_ADDED_TO_HAND") return false;
      if (note.payload?.playerId !== playerId) return false;
      return !this.animationQueue?.isProcessed(note.id);
    });
  }

  private shouldHideHandForStartGame(raw: any) {
    if (this.startGameAnimating) return true;
    const notifications = getNotificationQueue(raw);
    if (!notifications.length) return false;
    const playerId = this.gameContext.playerId;
    if (!playerId) return false;
    return notifications.some((note) => {
      if (!note?.id) return false;
      const type = (note.type || "").toUpperCase();
      if (type !== "INIT_HAND") return false;
      if (note.payload?.playerId !== playerId) return false;
      return !this.startGameCompleted;
    });
  }

  private shouldRefreshHandForEvent(event: { type?: string; payload?: any }) {
    if (!event) return false;
    const type = (event.type || "").toUpperCase();
    if (type !== "CARD_DRAWN" && type !== "CARD_ADDED_TO_HAND") return false;
    const playerId = event.payload?.playerId;
    return !!playerId && playerId === this.gameContext.playerId;
  }

  private updateSlots(opts: { animate?: boolean } = {}) {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    const previousRaw = snapshot.previousRaw as any;
    const playerId = this.gameContext.playerId;
    const currentSlots = this.slotPresenter.toSlots(raw, playerId);
    const allowAnimations = opts.animate ?? true;

    const notificationQueue = getNotificationQueue(raw);
    const boardSlotPositions = this.slotControls?.getBoardSlotPositions?.();
    const cardLookup = {
      findBaseCard: (playerId?: string) => findBaseCard(raw, playerId),
      findCardByUid: (cardUid?: string) => findCardByUid(raw, cardUid),
    };
    const events = this.animationQueue?.buildEvents(notificationQueue) ?? [];
    const ctx = {
      notificationQueue,
      slots: currentSlots,
      boardSlotPositions,
      allowAnimations,
      currentPlayerId: this.gameContext.playerId,
      resolveSlotOwnerByPlayer: this.resolveSlotOwnerByPlayer.bind(this),
      cardLookup,
      getRenderSlots: () => this.slotAnimationRender?.getRenderSlots(currentSlots) ?? currentSlots,
      previousRaw,
      currentRaw: raw,
    };

    const queueRunning = this.animationQueue?.isRunning() ?? false;
    const hasNewEvents = events.length > 0;

    if (allowAnimations && hasNewEvents && !queueRunning) {
      // eslint-disable-next-line no-console
      console.log("[BoardScene] updateSlots startBatch", { eventCount: events.length });
      const previousSlots = this.slotPresenter.toSlots(previousRaw ?? raw, playerId);
      const initialSlots = this.slotAnimationRender?.startBatch(events, previousSlots, currentSlots) ?? currentSlots;
      this.renderSlots(initialSlots);
      this.animationQueue?.enqueue(events, ctx);
      return;
    }

    if (allowAnimations && queueRunning) {
      // eslint-disable-next-line no-console
      console.log("[BoardScene] updateSlots skip render (queue running)");
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[BoardScene] updateSlots render current", { hasNewEvents, queueRunning });
    this.renderSlots(currentSlots);
  }

  private updateHeaderPhaseStatus(raw: any) {
    const phase = raw?.gameEnv?.phase;
    if (phase) {
      this.headerControls?.setStatusFromEngine?.(phase, { offlineFallback: this.offlineFallback });
    }
  }

  private refreshActionBarState(raw: any) {
    const playerId = this.gameContext.playerId;
    const isSelfTurn = this.turnController.update(raw, playerId);
    this.selectionAction?.updateActionBarForPhase(raw, { isSelfTurn });
  }

  private getTargetAnchorProviders(): TargetAnchorProviders {
    return {
      getBaseAnchor: (isOpponent) => this.baseControls?.getBaseAnchor(isOpponent),
      getShieldAnchor: (isOpponent) => this.baseControls?.getShieldTopAnchor(isOpponent),
    };
  }

  private resolveSlotOwnerByPlayer(playerId?: string): SlotOwner | undefined {
    if (!playerId) return undefined;
    if (playerId === this.gameContext.playerId) {
      return "player";
    }
    return "opponent";
  }

  private renderSlots(slots: SlotViewModel[]) {
    // eslint-disable-next-line no-console
    console.log("[BoardScene] setSlots", { count: slots.length });
    this.slotControls?.setSlots(slots);
  }


  private handleAnimationQueueIdle() {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    const playerId = this.gameContext.playerId;
    const slots = this.slotPresenter.toSlots(raw, playerId);
    this.slotAnimationRender?.clear();
    this.renderSlots(slots);
  }

  private async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    await this.selectionAction?.runActionThenRefresh(actionId, actionSource);
  }

  private updateBaseAndShield() {
    console.log("show base")
    const snapshot = this.engine.getSnapshot();
    const raw: any = snapshot.raw;
    const players = raw?.gameEnv?.players;
    if (!players) return;

    const allIds = Object.keys(players);
    const selfId = this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : allIds[0];
    const otherId = allIds.find((id) => id !== selfId);
    console.log("selfId ", selfId , " ",otherId);
    const applySide = (playerId: string | undefined, isOpponent: boolean) => {
      if (!playerId || !players[playerId]) return;
      const side = players[playerId];
      const zones = side.zones || side.zone || {};
      const shieldArea = zones.shieldArea || side.shieldArea;
      const baseArr = zones.base || side.base;
      const shieldCount = Array.isArray(shieldArea) ? shieldArea.length : 0;
      const baseCard = Array.isArray(baseArr) ? baseArr[0] : null;
      const hasBase = Boolean(baseCard);
      const ap = baseCard?.fieldCardValue?.totalAP ?? 0;
      const hp = baseCard?.fieldCardValue?.totalHP ?? 0;
      const rested = baseCard?.isRested ?? baseCard?.fieldCardValue?.isRested ?? false;
      // eslint-disable-next-line no-console
      console.log("[Base] status", { isOpponent, cardId: baseCard?.cardId, rested });
      this.baseControls?.setShieldCount(isOpponent, shieldCount);
      if (hasBase) {
        this.baseControls?.setBaseTexture?.(isOpponent, baseCard?.cardId);
        this.baseControls?.setBaseBadgeLabel(isOpponent, `${ap}|${hp}`);
        this.baseControls?.setBaseStatus(isOpponent, rested ? "rested" : "normal");
        this.baseControls?.setBaseTowerVisible(isOpponent, true);
        this.baseControls?.setBaseVisible(isOpponent, true);
        // Base play animations are disabled for now; NotificationAnimationController owns entry effects.
        this.baseControls?.setBasePreviewData?.(isOpponent, baseCard, { allowAnimation: false });
      } else {
        // Hide only the base visuals; keep shields visible. Disable preview.
        this.baseControls?.setBaseTowerVisible(isOpponent, true);
        this.baseControls?.setBaseVisible(isOpponent, false);
        this.baseControls?.setBasePreviewData?.(isOpponent, null, { allowAnimation: false });
      }
    };

    applySide(selfId, false);
    applySide(otherId, true);
  }

  private showLoading() {
    if (this.loadingText) {
      this.loadingText.setVisible(true);
      return;
    }
    const cam = this.cameras.main;
    this.loadingText = this.add
      .text(cam.centerX, cam.centerY, "Loading...", {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(2000);
  }

  private hideLoading() {
    this.loadingText?.setVisible(false);
  }

  // Centralize UI wiring/drawing to reduce call scattering in create().
  private wireUiHandlers() {
    this.ui?.setActionHandler((index) => this.actionDispatcher.dispatch(index));
    this.handControls?.setCardClickHandler?.((card) => this.selectionAction?.handleHandCardSelected(card));
    this.slotControls?.setSlotClickHandler?.((slot) => this.selectionAction?.handleSlotCardSelected(slot));
    this.baseControls?.setBaseClickHandler?.((payload) => this.selectionAction?.handleBaseCardSelected(payload));
    this.trashControls?.setTrashClickHandler?.((owner) => this.showTrashArea(owner));
    this.headerControls?.setAvatarHandler(() => this.debugControls?.show());
  }

  private showTrashArea(_owner: "opponent" | "player") {
    const raw = this.engine.getSnapshot().raw as any;
    const currentPlayer = raw?.gameEnv?.currentPlayer || this.gameContext.playerId;
    const players = raw?.gameEnv?.players || {};
    const trash = players?.[currentPlayer]?.zones?.trashArea || [];
    this.baseControls?.setBaseInputEnabled?.(false);
    this.trashAreaDialogUi?.show({
      cards: trash,
      header: "Trash Area",
      onClose: () => {
        this.baseControls?.setBaseInputEnabled?.(true);
      },
    });
  }
  private async initSession() {
    try {
      this.offlineFallback = false;
      const parsed = parseSessionParams(window.location.search);
      const mode = parsed.mode;
      const gameId = parsed.gameId;
      const playerIdParam = parsed.playerId;
      const playerNameParam = parsed.playerName;

      if (!mode) throw new Error("Invalid mode");

      this.contextStore.update({ mode });
      if (playerIdParam) this.contextStore.update({ playerId: playerIdParam });
      if (gameId) this.contextStore.update({ gameId });

      if (mode === GameMode.Join) {
        if (!gameId) {
          throw new Error("Missing game id for join mode");
        }
        // Default join identity aligns with backend sample if none provided.
        const joinId = playerIdParam || "playerId_1";
        const joinName = playerNameParam || "Demo Opponent";
        this.contextStore.update({ playerId: joinId, playerName: joinName });
        await this.match.joinRoom(gameId, joinId, joinName);
        const resolvedPlayerId = this.gameContext.playerId || joinId;
        const statusPayload = (await this.match.getGameStatus(gameId, resolvedPlayerId)) as GameStatusResponse;
        await this.engine.loadGameResources(gameId, resolvedPlayerId, statusPayload);
        await this.engine.updateGameStatus(gameId, resolvedPlayerId, {
          fromScenario: true,
          silent: true,
          statusPayload,
        });
      } else {
        const hostName = playerNameParam || this.gameContext.playerName || "Demo Player";
        this.contextStore.update({ playerName: hostName });
        await this.match.startAsHost(this.gameContext.playerId, { playerName: hostName });
        // Capture gameId from the match state after hosting is created.
        const state = this.match.getState();
        if (state.gameId) {
          this.contextStore.update({ gameId: state.gameId });
        }
      }
    } catch (err) {
      console.error("Session init failed", err);
      const params = new URLSearchParams(window.location.search);
      const fallbackGameId =
        this.gameContext.mode === GameMode.Join
          ? params.get("gameId") || params.get("roomid") || "join-local"
          : `demo-${Date.now()}`;
      // Fallback to a local ready state so the UI remains usable even if API/host is unreachable.
      this.offlineFallback = true;
      this.gameContext.gameId = fallbackGameId;
      this.headerControls?.setStatusFromEngine?.(GameStatus.Ready, { offlineFallback: true });
      // Keep UI clean; log error only.
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      console.warn("Using offline fallback:", msg);
    }
  }

  private setupActions() {
    const baseControls = this.baseControls;
    this.actionDispatcher.register(0, () => {
      const promise = this.shuffleManager?.play();
      promise?.then(() =>{
        this.showDefaultUI();
      });
    });
    this.actionDispatcher.register(1, () => {
      if (!baseControls) return;
      this.playerBaseStatus = this.playerBaseStatus === "rested" ? "normal" : "rested";
      baseControls.setBaseStatus(true, this.playerBaseStatus);
      baseControls.setBaseBadgeLabel(true, this.playerBaseStatus === "rested" ? "2|3" : "0|3");
    });
    this.actionDispatcher.register(2, () => {
      if (!baseControls) return;
      baseControls.setBaseStatus(true, "normal");
      baseControls.setBaseBadgeLabel(true, "0|0");
    });
    this.actionDispatcher.register(3, () => {
      if (!baseControls) return;
      this.playerShieldCount = (this.playerShieldCount + 1) % 7;
      baseControls.setShieldCount(true, this.playerShieldCount);
      baseControls.setBaseBadgeLabel(true, `${this.playerShieldCount}|6`);
    });
    this.actionDispatcher.register(9, () => this.startGame());
  }



}
