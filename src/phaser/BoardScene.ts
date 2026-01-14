import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import type { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import type { BoardUI } from "./ui/BoardUI";
import { ShieldAreaStatus } from "./ui/ShieldAreaHandler";
import { ApiManager } from "./api/ApiManager";
import { GameSessionService, GameStatus } from "./game/GameSessionService";
import { MatchStateMachine } from "./game/MatchStateMachine";
import { GameEngine, type GameStatusSnapshot, type ActionSource } from "./game/GameEngine";
import { ActionDispatcher } from "./controllers/ActionDispatcher";
import { GameContextStore } from "./game/GameContextStore";
import { DebugControls } from "./controllers/DebugControls";
import { TurnStateController } from "./game/TurnStateController";
import { HandPresenter } from "./ui/HandPresenter";
import { SlotPresenter } from "./ui/SlotPresenter";
import type { SlotViewModel, SlotOwner } from "./ui/SlotTypes";
import type { PilotTargetDialog } from "./ui/PilotTargetDialog";
import type { PilotDesignationDialog } from "./ui/PilotDesignationDialog";
import type { EffectTargetDialog } from "./ui/EffectTargetDialog";
import type { TrashAreaDialog } from "./ui/TrashAreaDialog";
import type { DrawPopupDialog } from "./ui/DrawPopupDialog";
import type { PhaseChangeDialog } from "./ui/PhaseChangeDialog";
import type { MulliganDialog } from "./ui/MulliganDialog";
import type { ChooseFirstPlayerDialog } from "./ui/ChooseFirstPlayerDialog";
import type { TurnOrderStatusDialog } from "./ui/TurnOrderStatusDialog";
import type { CoinFlipOverlay } from "./ui/CoinFlipOverlay";
import { PilotFlowController } from "./controllers/PilotFlowController";
import { CommandFlowController } from "./controllers/CommandFlowController";
import { UnitFlowController } from "./controllers/UnitFlowController";
import { createSelectionActionController } from "./controllers/SelectionActionControllerFactory";
import type { SelectionActionController } from "./controllers/SelectionActionController";
import { EffectTargetController } from "./controllers/EffectTargetController";
import type { AnimationQueue } from "./animations/AnimationQueue";
import type { SlotAnimationRenderController } from "./animations/SlotAnimationRenderController";
import type { BaseShieldAnimationRenderController } from "./animations/BaseShieldAnimationRenderController";
import { setupAnimationPipeline } from "./scene/boardAnimationSetup";
import { type TargetAnchorProviders } from "./utils/AttackResolver";
import { OverlayController } from "./controllers/OverlayController";
import { getNotificationQueue } from "./utils/NotificationUtils";
import { findBaseCard, findCardByUid } from "./utils/CardLookup";
import { DialogCoordinator } from "./controllers/DialogCoordinator";
import { SessionController } from "./controllers/SessionController";
import { setupBoardUi, type BoardUiControls } from "./scene/boardUiSetup";
import { setupBoardDialogs } from "./scene/boardDialogSetup";
import { BOARD_THEME } from "./scene/boardTheme";
import { wireBoardUiHandlers } from "./scene/boardSceneUiBindings";
import { buildBoardSceneTestHooks } from "./scene/boardSceneTestHooks";
import { bindBoardSceneEvents } from "./scene/boardSceneEventBindings";
import { registerBoardSceneActions } from "./scene/boardSceneActionBindings";
import type { TurnTimerController } from "./controllers/TurnTimerController";
import { createTurnTimerBindings } from "./scene/boardTimerBindings";

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
  private baseControls: BoardUiControls["baseControls"] | null = null;
  private trashControls: BoardUiControls["trashControls"] | null = null;
  private energyControls: BoardUiControls["energyControls"] | null = null;
  private statusControls: BoardUiControls["statusControls"] | null = null;
  private handControls: BoardUiControls["handControls"] | null = null;
  private actionControls: BoardUiControls["actionControls"] | null = null;
  private api = new ApiManager();
  private session = new GameSessionService(this.api);
  private match = new MatchStateMachine(this.session);
  private contextStore = new GameContextStore();
  private engine = new GameEngine(this, this.match, this.contextStore);
  private gameContext = this.contextStore.get();
  private handPresenter = new HandPresenter();
  private slotPresenter = new SlotPresenter();
  private turnController = new TurnStateController();

  private headerControls: BoardUiControls["headerControls"] | null = null;
  private actionDispatcher = new ActionDispatcher();
  private debugControls?: DebugControls;
  private loadingText?: Phaser.GameObjects.Text;
  private slotControls: BoardUiControls["slotControls"] | null = null;
  private selectionAction?: SelectionActionController;
  private effectTargetController?: EffectTargetController;
  private pilotTargetDialogUi?: PilotTargetDialog;
  private pilotDesignationDialogUi?: PilotDesignationDialog;
  private effectTargetDialogUi?: EffectTargetDialog;
  private trashAreaDialogUi?: TrashAreaDialog;
  private drawPopupDialogUi?: DrawPopupDialog;
  private phaseChangeDialogUi?: PhaseChangeDialog;
  private mulliganDialogUi?: MulliganDialog;
  private chooseFirstPlayerDialogUi?: ChooseFirstPlayerDialog;
  private turnOrderStatusDialogUi?: TurnOrderStatusDialog;
  private coinFlipOverlayUi?: CoinFlipOverlay;
  private waitingOpponentDialogUi?: TurnOrderStatusDialog;
  private mulliganWaitingDialogUi?: TurnOrderStatusDialog;
  private dialogCoordinator = new DialogCoordinator(this.match, this.contextStore);
  private sessionController?: SessionController;
  private pilotFlow?: PilotFlowController;
  private commandFlow?: CommandFlowController;
  private unitFlow?: UnitFlowController;
  private overlay?: OverlayController;
  private animationQueue?: AnimationQueue;
  private slotAnimationRender?: SlotAnimationRenderController;
  private baseShieldAnimationRender?: BaseShieldAnimationRenderController;
  private startGameAnimating = false;
  private startGameCompleted = false;
  private turnStartDrawPopupActive = false;
  private awaitingTurnStartDraw = false;
  private lastCurrentPlayerId?: string;
  private turnTimer?: TurnTimerController;
  private updateTurnTimerFromSnapshot?: (raw: any) => void;

  create() {
    // Center everything based on the actual viewport, not just BASE_W/H.
    const cam = this.cameras.main;
    this.offset.x = cam.centerX - BASE_W / 2;
    this.offset.y = cam.centerY - BASE_H / 2;
    this.cameras.main.setBackgroundColor(BOARD_THEME.bg);

    const { ui, shuffleManager, controls } = setupBoardUi(this, this.offset, BOARD_THEME);
    this.ui = ui;
    this.shuffleManager = shuffleManager;
    this.baseControls = controls.baseControls;
    this.trashControls = controls.trashControls;
    this.energyControls = controls.energyControls;
    this.statusControls = controls.statusControls;
    this.handControls = controls.handControls;
    this.actionControls = controls.actionControls;
    this.headerControls = controls.headerControls;
    this.slotControls = controls.slotControls;

    const timerBindings = createTurnTimerBindings(this, this.headerControls);
    this.turnTimer = timerBindings.timer;
    this.updateTurnTimerFromSnapshot = (raw) => {
      timerBindings.update(raw, {
        playerId: this.gameContext.playerId,
        isShuffleAnimating: this.startGameAnimating,
        onExpire: () => void this.runActionThenRefresh("endTurn", "neutral"),
      });
    };

    const dialogs = setupBoardDialogs(
      this,
      this.dialogCoordinator,
      (slot, size) => this.slotControls?.createSlotSprite?.(slot, size),
      this.turnTimer,
    );
    this.drawPopupDialogUi = dialogs.drawPopupDialog;
    this.phaseChangeDialogUi = dialogs.phaseChangeDialog;
    this.mulliganDialogUi = dialogs.mulliganDialog;
    this.chooseFirstPlayerDialogUi = dialogs.chooseFirstPlayerDialog;
    this.turnOrderStatusDialogUi = dialogs.turnOrderStatusDialog;
    this.coinFlipOverlayUi = dialogs.coinFlipOverlay;
    this.waitingOpponentDialogUi = dialogs.waitingOpponentDialog;
    this.mulliganWaitingDialogUi = dialogs.mulliganWaitingDialog;
    this.pilotTargetDialogUi = dialogs.pilotTargetDialog;
    this.pilotDesignationDialogUi = dialogs.pilotDesignationDialog;
    this.effectTargetDialogUi = dialogs.effectTargetDialog;
    this.trashAreaDialogUi = dialogs.trashAreaDialog;

    const { animationQueue, slotAnimationRender, baseShieldAnimationRender } = setupAnimationPipeline({
      scene: this,
      controls,
      dialogs: {
        drawPopupDialog: dialogs.drawPopupDialog,
        mulliganDialog: dialogs.mulliganDialog,
        chooseFirstPlayerDialog: dialogs.chooseFirstPlayerDialog,
        turnOrderStatusDialog: dialogs.turnOrderStatusDialog,
        waitingOpponentDialog: dialogs.waitingOpponentDialog,
        mulliganWaitingDialog: dialogs.mulliganWaitingDialog,
        coinFlipOverlay: dialogs.coinFlipOverlay,
        phaseChangeDialog: dialogs.phaseChangeDialog,
      },
      api: this.api,
      engine: this.engine,
      dialogCoordinator: this.dialogCoordinator,
      gameContext: this.gameContext,
      slotPresenter: this.slotPresenter,
      resolveSlotOwnerByPlayer: this.resolveSlotOwnerByPlayer.bind(this),
      getTargetAnchorProviders: () => this.getTargetAnchorProviders(),
      startGame: () => this.startGame(),
      renderSlots: (slots) => this.renderSlots(slots),
      renderBaseAndShield: (raw) => this.updateBaseAndShield(raw),
      updateHandArea: (opts) => this.updateHandArea(opts),
      shouldRefreshHandForEvent: (event) => this.shouldRefreshHandForEvent(event),
      handleAnimationQueueIdle: () => this.handleAnimationQueueIdle(),
      onTurnStartDrawPopupStart: () => {
        this.turnStartDrawPopupActive = true;
        this.awaitingTurnStartDraw = true;
        this.turnTimer?.setEnabled(false);
      },
      onTurnStartDrawPopupEnd: () => {
        this.turnStartDrawPopupActive = false;
        this.awaitingTurnStartDraw = false;
        const snapshot = this.engine.getSnapshot();
        const raw = snapshot.raw as any;
        if (raw) {
          this.updateTurnTimer(raw);
        } else {
          this.turnTimer?.setEnabled(true);
        }
      },
    });
    this.animationQueue = animationQueue;
    this.slotAnimationRender = slotAnimationRender;
    this.baseShieldAnimationRender = baseShieldAnimationRender;
    this.debugControls = new DebugControls(this, this.match, this.engine, this.gameContext);
    this.sessionController = new SessionController({
      match: this.match,
      engine: this.engine,
      contextStore: this.contextStore,
      debugControls: this.debugControls,
      onOfflineFallback: (gameId, message) => {
        this.offlineFallback = true;
        this.headerControls?.setStatusFromEngine?.(GameStatus.Ready, { offlineFallback: true });
        console.warn("Using offline fallback:", message, { gameId });
      },
    });
    this.effectTargetController = new EffectTargetController({
      dialog: dialogs.effectTargetDialog,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      engine: this.engine,
      api: this.api,
      scene: this,
      onPlayerAction: () => this.turnTimer?.reset(),
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
      onPlayerAction: () => this.turnTimer?.reset(),
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
      pilotTargetDialog: dialogs.pilotTargetDialog,
      pilotDesignationDialog: dialogs.pilotDesignationDialog,
      runActionThenRefresh: this.runActionThenRefresh.bind(this),
    });
    this.commandFlow = new CommandFlowController(this.engine);
    this.unitFlow = new UnitFlowController();
    this.engine.setFlowControllers({ commandFlow: this.commandFlow, unitFlow: this.unitFlow });
    bindBoardSceneEvents({
      engine: this.engine,
      match: this.match,
      dialogCoordinator: this.dialogCoordinator,
      headerControls: this.headerControls,
      offlineFallback: this.offlineFallback,
      pilotFlow: this.pilotFlow,
      selectionAction: this.selectionAction,
      onMainPhaseUpdate: (silent, snapshot) => this.mainPhaseUpdate(silent, snapshot),
      onShowLoading: () => this.showLoading(),
      onHideLoading: () => this.hideLoading(),
    });
    this.debugControls.exposeTestHooks(
      buildBoardSceneTestHooks({
        engineSnapshot: () => this.engine.getSnapshot(),
        engineGetAvailableActions: (source) => this.engine.getAvailableActions(source),
        handPresenter: this.handPresenter,
        playerId: this.gameContext.playerId,
        selectionAction: this.selectionAction,
        runActionThenRefresh: this.runActionThenRefresh.bind(this),
        effectTargetDialog: this.effectTargetDialogUi,
        pilotTargetDialog: this.pilotTargetDialogUi,
        pilotFlow: this.pilotFlow,
      }),
    );

    registerBoardSceneActions({
      actionDispatcher: this.actionDispatcher,
      shuffleManager: this.shuffleManager,
      baseControls: this.baseControls,
      playerBaseStatus: this.playerBaseStatus,
      setPlayerBaseStatus: (status) => {
        this.playerBaseStatus = status;
      },
      playerShieldCount: this.playerShieldCount,
      setPlayerShieldCount: (count) => {
        this.playerShieldCount = count;
      },
      showDefaultUI: () => this.showDefaultUI(),
      startGame: () => this.startGame(),
    });
    wireBoardUiHandlers({
      controls,
      actionDispatcher: this.actionDispatcher,
      selectionAction: this.selectionAction,
      showTrashArea: this.showTrashArea.bind(this),
      showDebugControls: () => this.debugControls?.show(),
    });
    this.ui.drawAll(this.offset);
    this.hideDefaultUI();

    // Kick off game session on load (host flow placeholder).
    this.initSession();
  }

  public async startGame(): Promise<void> {
    this.session.markInMatch();
    this.startGameCompleted = false;
    this.startGameAnimating = true;
    this.turnTimer?.setEnabled(false);
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
    this.updateTurnTimer(raw);
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
      this.baseShieldAnimationRender?.startBatch(events, previousRaw ?? raw, raw);
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
    const phase = raw?.gameEnv?.phase ?? raw?.phase;
    if (phase) {
      this.headerControls?.setStatusFromEngine?.(phase, { offlineFallback: this.offlineFallback });
    }
    this.updateHeaderTurnStatus(raw);
  }

  private updateHeaderTurnStatus(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
    if (!currentPlayer) {
      this.headerControls?.setTurnText?.("Turn: -");
      return;
    }
    const isSelf = currentPlayer === this.gameContext.playerId;
    const text = `Turn: ${isSelf ? "Your Turn" : "Opponent"}`;
    const color = isSelf ? "#6fd66f" : "#ff6b6b";
    this.headerControls?.setTurnText?.(text, color);
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
    this.baseShieldAnimationRender?.clear();
    this.renderSlots(slots);
    this.updateBaseAndShield(raw);
  }

  private async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    await this.selectionAction?.runActionThenRefresh(actionId, actionSource);
  }

  private updateBaseAndShield(rawOverride?: any) {
    const raw: any = rawOverride ?? this.engine.getSnapshot().raw;
    if (!raw?.gameEnv?.players) return;
    const renderStates = this.baseShieldAnimationRender?.getRenderStates(raw) ?? {
      player: null,
      opponent: null,
    };
    const applyState = (state: any, isOpponent: boolean) => {
      const shieldCount = state?.shieldCount ?? 0;
      const baseCard = state?.baseCard ?? null;
      const hasBase = Boolean(baseCard);
      const ap = state?.ap ?? 0;
      const hp = state?.hp ?? 0;
      const rested = state?.rested ?? false;
      const baseCardId =
        baseCard?.cardId ?? baseCard?.id ?? (typeof baseCard === "string" ? baseCard : undefined);
      this.baseControls?.setShieldCount(isOpponent, shieldCount);
      if (hasBase) {
        this.baseControls?.setBaseTexture?.(isOpponent, baseCardId);
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

    applyState(renderStates.player, false);
    applyState(renderStates.opponent, true);
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

  private updateTurnTimer(raw: any) {
    this.updateTurnStartGate(raw);
    if (this.turnStartDrawPopupActive) {
      this.turnTimer?.setEnabled(false);
      return;
    }
    if (this.awaitingTurnStartDraw) {
      this.turnTimer?.setEnabled(false);
      return;
    }
    if (this.shouldDelayTurnTimerForTurnStartDraw(raw)) {
      this.turnTimer?.setEnabled(false);
      return;
    }
    this.updateTurnTimerFromSnapshot?.(raw);
  }

  private updateTurnStartGate(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
    const selfId = this.gameContext.playerId;
    if (!currentPlayer || !selfId) {
      this.lastCurrentPlayerId = currentPlayer;
      return;
    }
    if (currentPlayer !== this.lastCurrentPlayerId) {
      if (currentPlayer === selfId) {
        this.awaitingTurnStartDraw = true;
      } else {
        this.awaitingTurnStartDraw = false;
        this.turnStartDrawPopupActive = false;
      }
    }
    this.lastCurrentPlayerId = currentPlayer;
  }

  private shouldDelayTurnTimerForTurnStartDraw(raw: any) {
    const playerId = this.gameContext.playerId;
    if (!playerId) return false;
    const notifications = getNotificationQueue(raw);
    if (!notifications.length) return false;
    return notifications.some((note) => {
      if (!note?.id) return false;
      const type = (note.type || "").toUpperCase();
      if (type !== "CARD_DRAWN") return false;
      if (note.payload?.playerId !== playerId) return false;
      const drawContext = (note.payload?.drawContext ?? "").toString().toLowerCase();
      if (drawContext !== "turn_start") return false;
      return !this.animationQueue?.isProcessed(note.id);
    });
  }

  private async initSession() {
    this.offlineFallback = false;
    this.dialogCoordinator.resetSession();
    await this.sessionController?.initSession(window.location.search);
  }

}
