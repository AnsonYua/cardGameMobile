import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";
import { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import { DrawHelpers } from "./ui/HeaderHandler";
import { BaseStatus } from "./ui/BaseShieldHandler";
import { ApiManager } from "./api/ApiManager";
import { GameSessionService, GameStatus, GameMode } from "./game/GameSessionService";
import { MatchStateMachine, MatchState } from "./game/MatchStateMachine";
import { GameEngine, type GameStatusSnapshot, type ActionSource } from "./game/GameEngine";
import { ActionDispatcher } from "./controllers/ActionDispatcher";
import { GameContextStore } from "./game/GameContextStore";
import { parseSessionParams } from "./game/SessionParams";
import { ENGINE_EVENTS } from "./game/EngineEvents";
import { DebugControls } from "./controllers/DebugControls";
import { HandPresenter } from "./ui/HandPresenter";
import { SlotPresenter } from "./ui/SlotPresenter";
import type { SlotViewModel, SlotCardView } from "./ui/SlotTypes";
import { toPreviewKey } from "./ui/HandTypes";
import { PilotTargetDialog } from "./ui/PilotTargetDialog";
import { PilotDesignationDialog } from "./ui/PilotDesignationDialog";
import { EffectTargetDialog } from "./ui/EffectTargetDialog";
import { PilotFlowController } from "./controllers/PilotFlowController";
import { CommandFlowController } from "./controllers/CommandFlowController";
import { UnitFlowController } from "./controllers/UnitFlowController";
import { SelectionActionController } from "./controllers/SelectionActionController";
import { EffectTargetController } from "./controllers/EffectTargetController";

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
  private playerBaseStatus: BaseStatus = "normal";
  private playerShieldCount = 6;
  private offlineFallback = false;
  private baseControls: ReturnType<BoardUI["getBaseControls"]> | null = null;
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

  private headerControls: ReturnType<BoardUI["getHeaderControls"]> | null = null;
  private actionDispatcher = new ActionDispatcher();
  private uiVisible = true;
  private errorText?: Phaser.GameObjects.Text;
  private debugControls?: DebugControls;
  private loadingText?: Phaser.GameObjects.Text;
  private slotControls: ReturnType<BoardUI["getSlotControls"]> | null = null;
  private selectionAction?: SelectionActionController;
  private effectTargetController?: EffectTargetController;
  private pilotTargetDialogUi?: PilotTargetDialog;
  private pilotDesignationDialogUi?: PilotDesignationDialog;
  private effectTargetDialogUi?: EffectTargetDialog;
  private pilotFlow?: PilotFlowController;
  private commandFlow?: CommandFlowController;
  private unitFlow?: UnitFlowController;

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
    this.shuffleManager = new ShuffleAnimationManager(this, new DrawHelpers(this), this.offset);
    this.baseControls = this.ui.getBaseControls();
    this.energyControls = this.ui.getEnergyControls();
    this.statusControls = this.ui.getStatusControls();
    this.handControls = this.ui.getHandControls();
    this.slotControls = this.ui.getSlotControls();
    this.headerControls = this.ui.getHeaderControls();
    this.actionControls = this.ui.getActionControls();
    this.debugControls = new DebugControls(this, this.match, this.engine, this.gameContext);
    this.match.events.on("status", (state: MatchState) => this.onMatchStatus(state));
    this.engine.events.on(ENGINE_EVENTS.STATUS, (snapshot: GameStatusSnapshot) => {
      this.gameContext.lastStatus = snapshot.status;
      this.headerControls?.setStatusFromEngine?.(snapshot.status, { offlineFallback: this.offlineFallback });
    });
    this.engine.events.on(ENGINE_EVENTS.PHASE_REDRAW, () => {
      this.startGame();
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE, () => {
      this.mainPhaseUpdate();
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
    this.pilotTargetDialogUi = new PilotTargetDialog(this);
    this.pilotDesignationDialogUi = new PilotDesignationDialog(this);
    this.effectTargetDialogUi = new EffectTargetDialog(this);
    this.effectTargetController = new EffectTargetController({
      dialog: this.effectTargetDialogUi,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      engine: this.engine,
      api: this.api,
    });
    this.selectionAction = new SelectionActionController({
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
    this.engine.setFlowControllers({ commandFlow: this.commandFlow, unitFlow: this.unitFlow, pilotFlow: this.pilotFlow });
    this.debugControls.exposeTestHooks(this.buildTestHooks());

    this.setupActions();
    this.wireUiHandlers();
    this.ui.drawAll(this.offset);
    this.hideDefaultUI();
    // Sync header with initial state before async work.
    this.onMatchStatus(this.match.getState());

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
    const selectPilotTarget = async (targetIndex = 0, actionId = "playPilotDesignationAsPilot") => {
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
   
  public startGame(){
    if (this.gameContext.status !== GameStatus.Ready && this.gameContext.status !== GameStatus.InMatch) {
      console.log("Not ready to start match yet");
      return;
    }
    this.session.markInMatch();
    this.gameContext.status = GameStatus.InMatch;
    this.hideDefaultUI();
    const promise = this.shuffleManager?.play();
    if (promise && typeof promise.then === "function") {
      promise
        .then(() => {
          this.showDefaultUI();
          this.updateHandArea();
          this.updateSlots();
          this.updateBaseAndShield({ fade: false });
        })
        .then(() => console.log("Shuffle animation finished"));
    } else {
      this.showDefaultUI();
      this.updateHandArea();
      this.updateSlots();
      this.updateBaseAndShield({ fade: false });
    }
  }
 
  public mainPhaseUpdate(){
    this.refreshPhase(true);
  }

  private refreshPhase(skipFade: boolean) {
    const raw = this.engine.getSnapshot().raw as any;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    console.log("[refreshPhase] skipFade", skipFade, "battle?", battle);
    this.showUI(!skipFade);
    this.updateHandArea({ skipFade });
    this.updateSlots();
    this.updateBaseAndShield({ fade: !skipFade });
    this.updateActionBarForPhase();
    if (raw) {
      void this.effectTargetController?.syncFromSnapshot(raw);
    }
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
    base?.setBaseTowerVisible(true, false, false);
    base?.setBaseTowerVisible(false, false, false);
    energy?.setVisible(false);
    status?.setVisible(false);
    hand?.setVisible(false);
    actions?.setVisible(false);
  }

  private updateHandArea(opts: { skipFade?: boolean } = {}) {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    const playerId = this.gameContext.playerId;
    const cards = this.handPresenter.toHandCards(raw, playerId);
    if (!cards.length) return;
    const selectedUid = this.selectionAction?.getSelectedHandCard()?.uid;
    this.handControls?.setHand(cards, { preserveSelectionUid: selectedUid });
    this.handControls?.setVisible(true);
    if (!opts.skipFade) {
      this.handControls?.fadeIn();
    }
  }

  private updateSlots() {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    const playerId = this.gameContext.playerId;
    const slots = this.slotPresenter.toSlots(raw, playerId);
    this.slotControls?.setSlots(slots);
  }

  private updateActionBarForPhase() {
    this.selectionAction?.updateActionBarForPhase();
  }

  private async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    await this.selectionAction?.runActionThenRefresh(actionId, actionSource);
  }

  private handleEndTurn() {
    console.log("End Turn clicked");
  }

  private updateBaseAndShield(opts: { fade?: boolean } = {}) {
    const fade = opts.fade ?? true;
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
      const rested = baseCard?.fieldCardValue?.isRested ?? false;
      this.baseControls?.setShieldCount(isOpponent, shieldCount);
      if (hasBase) {
        this.baseControls?.setBaseTexture?.(isOpponent, baseCard?.cardId);
        this.baseControls?.setBaseBadgeLabel(isOpponent, `${ap}|${hp}`);
        this.baseControls?.setBaseStatus(isOpponent, rested ? "rested" : "normal");
        this.baseControls?.setBaseTowerVisible(isOpponent, true, fade);
        this.baseControls?.setBaseVisible(isOpponent, true);
        this.baseControls?.setBasePreviewData?.(isOpponent, baseCard);
      } else {
        // Hide only the base visuals; keep shields visible. Disable preview.
        this.baseControls?.setBaseTowerVisible(isOpponent, true, fade);
        this.baseControls?.setBaseVisible(isOpponent, false);
        this.baseControls?.setBasePreviewData?.(isOpponent, null);
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
    this.headerControls?.setButtonHandler(() => this.startGame());
    this.headerControls?.setAvatarHandler(() => this.debugControls?.show());
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
        const joinId = playerIdParam || "playerId_2";
        const joinName = playerNameParam || "Demo Opponent";
        this.contextStore.update({ playerId: joinId, playerName: joinName, status: GameStatus.CreatingRoom });
        await this.match.joinRoom(gameId, joinId, joinName);
        await this.engine.updateGameStatus(gameId, joinId);
      } else {
        const hostName = playerNameParam || this.gameContext.playerName || "Demo Player";
        this.contextStore.update({ playerName: hostName, status: GameStatus.CreatingRoom });
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
      this.gameContext.status = GameStatus.Ready;
      this.onMatchStatus({ status: GameStatus.Ready, gameId: fallbackGameId, mode: this.gameContext.mode });
      // Keep UI clean; log error only.
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      console.warn("Using offline fallback:", msg);
    }
  }
  private onMatchStatus(state: MatchState) {
    this.gameContext.status = state.status;
    this.gameContext.gameId = state.gameId;
    this.gameContext.mode = state.mode;
    // Use shared header formatter so match lifecycle statuses render consistently.
    this.headerControls?.setStatusFromEngine?.(state.status, { offlineFallback: this.offlineFallback });
    const showButton = state.status === GameStatus.Ready || state.status === GameStatus.InMatch;
    this.ui?.setHeaderButtonVisible(showButton);
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
