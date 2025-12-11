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
import type { HandCardView } from "./ui/HandTypes";
import { toPreviewKey } from "./ui/HandTypes";
import type { ActionDescriptor } from "./game/ActionRegistry";

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
  private lastPhase?: string;
  private selectedHandCard?: HandCardView;
  private pilotDialog?: Phaser.GameObjects.Container;
  private pilotTargetDialog?: Phaser.GameObjects.Container;

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
    });
    this.engine.events.on(ENGINE_EVENTS.PHASE_REDRAW, () => {
      this.startGame();
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE,()=>{
      this.mainPhaseUpdate();
    })
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_ENTER, () => {
      this.refreshActions("neutral");
    });
    this.engine.events.on(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, () => {
      this.showPilotDesignationDialog();
    });
    this.engine.events.on(ENGINE_EVENTS.GAME_RESOURCE, (payload: any) => {
      console.log("Game resources fetched", payload?.resources);
    });
    this.engine.events.on(ENGINE_EVENTS.LOADING_START, () => this.showLoading());
    this.engine.events.on(ENGINE_EVENTS.LOADING_END, () => this.hideLoading());
    this.setupActions();
    this.wireUiHandlers();
    this.ui.drawAll(this.offset);
    this.hideDefaultUI();
    // Sync header with initial state before async work.
    this.onMatchStatus(this.match.getState());

    // Kick off game session on load (host flow placeholder).
    this.initSession();
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
    this.showUI(!skipFade);
    this.updateHandArea({ skipFade });
    this.updateSlots();
    this.updateBaseAndShield({ fade: !skipFade });
    this.updateActionBarForPhase();
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
    this.handControls?.setHand(cards);
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
    this.applyMainPhaseDefaults(false);
  }

  private handleEndTurn() {
    console.log("End Turn clicked");
  }

  private onHandCardSelected(card: HandCardView) {
    this.selectedHandCard = card;
    this.engine.select({
      kind: "hand",
      uid: card.uid || "",
      cardType: card.cardType,
      fromPilotDesignation: card.fromPilotDesignation,
      cardId: card.cardId,
    });
    this.refreshActions("hand");
  }

  private onSlotCardSelected(_slot: SlotViewModel) {
    this.selectedHandCard = undefined;
    this.engine.select({ kind: "slot", slotId: _slot.slotId, owner: _slot.owner });
    this.refreshActions("slot");
  }

  private onBaseCardSelected(payload?: { side: "opponent" | "player"; card?: any }) {
    this.selectedHandCard = undefined;
    if (!payload?.card) return;
    this.engine.select({ kind: "base", side: payload.side, cardId: payload.card?.cardId });
    this.refreshActions("base");
  }

  private applyMainPhaseDefaults(force = false) {
    this.selectedHandCard = undefined;
    this.engine.clearSelection();
    const raw = this.engine.getSnapshot().raw as any;
    const actions = this.actionControls;
    if (!raw || !actions) return;
    const phase = raw?.gameEnv?.phase;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const self = this.gameContext.playerId;
    const inMainPhase = phase === "MAIN_PHASE" && currentPlayer === self;
    if (!inMainPhase) {
      this.lastPhase = phase;
      return;
    }
    if (force || this.lastPhase !== "MAIN_PHASE") {
      actions.setState?.({
        descriptors: this.buildActionDescriptors([]),
      });
      this.handControls?.setHand?.(this.handPresenter.toHandCards(raw, this.gameContext.playerId)); // redraw clears highlights
    }
    this.lastPhase = phase;
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

  private refreshActions(source: ActionSource = "neutral") {
    const descriptors = this.engine.getAvailableActions(source);
    const mapped = this.buildActionDescriptors(descriptors);
    this.actionControls?.setState?.({ descriptors: mapped });
  }

  private buildActionDescriptors(descriptors: ActionDescriptor[]) {
    return descriptors.map((d) => ({
      label: d.label,
      enabled: d.enabled,
      primary: d.primary,
      onClick: async () => {
        await this.engine.runAction(d.id);
        this.mainPhaseUpdate();
        this.refreshActions("neutral");
      },
    }));
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
    this.handControls?.setCardClickHandler?.((card) => this.onHandCardSelected(card));
    this.slotControls?.setSlotClickHandler?.((slot) => this.onSlotCardSelected(slot));
    this.baseControls?.setBaseClickHandler?.((payload) => this.onBaseCardSelected(payload));
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
    this.updateHeaderStatus(state);
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

  private updateHeaderStatus(state: MatchState) {
    const label =
      state.status === GameStatus.CreatingRoom
        ? "Creating room..."
        : state.status === GameStatus.WaitingOpponent
          ? "Waiting"
          : state.status === GameStatus.Ready
            ? "Ready"
            : state.status === GameStatus.InMatch
              ? "In match"
              : "Error";
    const suffix = this.offlineFallback ? " (offline)" : "";
    this.headerControls?.setStatus(`Status: ${label}${suffix}`);
  }

  private showErrorOverlay(message: string) {
    if (this.errorText) {
      this.errorText.setText(message).setVisible(true);
      return;
    }
    this.errorText = this.add
      .text(BASE_W / 2 + this.offset.x, 50 + this.offset.y, message, {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#ffffff",
        backgroundColor: "#c0392b",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(1300);
  }

  private showPilotDesignationDialog() {
    if (this.pilotDialog) {
      this.pilotDialog.setVisible(true);
      return;
    }
    const cam = this.cameras.main;
    const overlay = this.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(2499);
    overlay.on("pointerup", () => this.hidePilotDesignationDialog());

    const dialogWidth = Math.max(320, cam.width * 0.7);
    const dialogHeight = 190;
    const dialog = this.add.container(cam.centerX, cam.centerY);

    const panel = this.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x1f6bff, 1);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    panel.lineStyle(3, 0x0e3f9c, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);

    const closeSize = 24;
    const closeButton = this.add.rectangle(dialogWidth / 2 - closeSize - 12, -dialogHeight / 2 + closeSize + 12, closeSize, closeSize, 0xffffff, 0.14);
    closeButton.setStrokeStyle(2, 0xffffff, 0.6);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerup", () => this.hidePilotDesignationDialog());
    const closeLabel = this.add.text(closeButton.x, closeButton.y, "✕", {
      fontSize: "16px",
      fontFamily: "Arial",
      color: "#f6f8ff",
      align: "center",
    }).setOrigin(0.5);

    const header = this.add.text(0, -dialogHeight / 2 + 45, "Play Card As", {
      fontSize: "22px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f6f8ff",
      align: "center",
      wordWrap: { width: dialogWidth - 80 },
    });
    header.setOrigin(0.5);

    const dialogMargin = 32;
    const buttonGap = 24;
    const availableForButtons = Math.max(160, dialogWidth - dialogMargin * 2);
    const buttonWidth = Math.min(220, (availableForButtons - buttonGap) / 2);
    const buttonHeight = 46;
    const btnY = dialogHeight / 2 - 60;

    const makeButton = (x: number, label: string, onClick: () => Promise<void> | void) => {
      const rect = this.add.rectangle(x, btnY, buttonWidth, buttonHeight, 0xf2f5ff, 1);
      rect.setStrokeStyle(2, 0xffffff, 0.9);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerup", async () => {
        await onClick();
      });

      const txt = this.add.text(x, btnY, label, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#1f3f9c",
        align: "center",
        wordWrap: { width: buttonWidth - 18 },
      });
      txt.setOrigin(0.5);
      return [rect, txt];
    };

    const offset = buttonWidth / 2 + buttonGap / 2;
    const [pilotBtn, pilotTxt] = makeButton(-offset, "Pilot", async () => {
      this.hidePilotDesignationDialog();
      this.showPilotTargetDialog();
    });
    const [commandBtn, commandTxt] = makeButton(offset, "Command", async () => {
      await this.engine.runAction("playPilotDesignationAsCommand");
      this.mainPhaseUpdate();
      this.refreshActions("neutral");
      this.hidePilotDesignationDialog();
    });

    dialog.add([panel, closeButton, closeLabel, header, pilotBtn, pilotTxt, commandBtn, commandTxt]);
    dialog.setDepth(2500);

    this.pilotDialog = this.add.container(0, 0, [overlay, dialog]).setDepth(2498);
  }

  private hidePilotDesignationDialog() {
    this.pilotDialog?.setVisible(false);
  }

  private hidePilotTargetDialog() {
    this.pilotTargetDialog?.destroy();
    this.pilotTargetDialog = undefined;
  }

  private collectPilotTargetUnits(): SlotViewModel[] {
    const snapshot = this.engine.getSnapshot();
    const raw: any = snapshot.raw;
    if (!raw) return [];
    const playerId = this.gameContext.playerId;
    const slots = this.slotPresenter.toSlots(raw, playerId);
    // Only show self slots; first 6 max.
    return slots.filter((s) => s.owner === "player").slice(0, 6);
  }

  private showPilotTargetDialog() {
    const cam = this.cameras.main;
    this.hidePilotTargetDialog();
    const overlay = this.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(2599);
    overlay.on("pointerup", () => this.hidePilotTargetDialog());

    const targets = this.collectPilotTargetUnits();
    const cols = 3;
    const rows = 2;
    const margin = 28;
    const gap = 16;
    const dialogWidth = Math.max(360, cam.width * 0.75);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardAspect = 88 / 64;
    const cardHeight = cellWidth * cardAspect;
    const cellHeight = cardHeight + 20;
    const gridHeight = rows * cellHeight + (rows - 1) * gap;
    const dialogHeight = Math.max(260, gridHeight + 120);

    const dialog = this.add.container(cam.centerX, cam.centerY);
    const panel = this.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    dialog.add(panel);

    const closeSize = 22;
    const closeButton = this.add.rectangle(dialogWidth / 2 - closeSize - 12, -dialogHeight / 2 + closeSize + 12, closeSize, closeSize, 0xffffff, 0.12);
    closeButton.setStrokeStyle(2, 0xffffff, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerup", () => this.hidePilotTargetDialog());
    const closeLabel = this.add
      .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
      .setOrigin(0.5);

    const header = this.add.text(0, -dialogHeight / 2 + 38, "Choose a Unit", {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: dialogWidth - 80 },
    }).setOrigin(0.5);

    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + 70 + cellHeight / 2;

    const toTex = (tex?: string) => (tex );
    const pilotBadge = (card?: SlotCardView) => {
      const type = (card?.cardType || card?.cardData?.cardType || '').toLowerCase();
      if (type === 'command') {
        const rules: any[] = card?.cardData?.effects?.rules || [];
        const pilotRule = rules.find((r) => r?.effectId === 'pilot_designation' || r?.effectId === 'pilotDesignation');
        const apVal = pilotRule?.parameters?.AP ?? pilotRule?.parameters?.ap ?? 0;
        const hpVal = pilotRule?.parameters?.HP ?? pilotRule?.parameters?.hp ?? 0;
        return `${apVal}|${hpVal}`;
      }
      const apVal = card?.cardData?.ap ?? 0;
      const hpVal = card?.cardData?.hp ?? 0;
      return `${apVal}|${hpVal}`;
    };
    const unitBadge = (card?: SlotCardView) => {
      const apVal = card?.cardData?.ap ?? 0;
      const hpVal = card?.cardData?.hp ?? 0;
      return `${apVal}|${hpVal}`;
    };

    const drawPreviewLike = (slot: SlotViewModel | undefined, x: number, y: number, cardW: number, cardH: number) => {
      if (!slot) return;
      const badgeW = 25;
      const badgeH = 15;
      const totalGap = 2;
      const pilotOffsetRatio = 0.2;
      const pilotCommandOffsetRatio = 0.1;
      const pilotCommandLift = 65;
      const unitYOffsetFactor = -0.4;

      let pilotOffsetY = cardH * pilotOffsetRatio;
      if ((slot.pilot?.cardType || '').toLowerCase() === 'command') {
        pilotOffsetY = cardH * pilotCommandOffsetRatio;
      }

      let slotCardEnd = -1;

      // Pilot layer
      if (slot.pilot) {
        const pilotTex = toTex(slot.pilot.textureKey);
        const pilotImg =
          pilotTex && this.textures.exists(pilotTex)
            ? this.add.image(x, y + pilotOffsetY, pilotTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
            : this.add.rectangle(x, y + pilotOffsetY, cardW, cardH, 0xcbd3df, 1).setOrigin(0.5);
        dialog.add(pilotImg);

        let badgeY = y + pilotOffsetY + cardH / 2 - badgeH / 2;
        if ((slot.pilot.cardType || '').toLowerCase() !== 'command') {
          badgeY -= pilotCommandLift;
        }
        const pilotBadgeRect = this.add.rectangle(x + cardW / 2 - badgeW / 2, badgeY, badgeW, badgeH, 0x000000, 0.9);
        const pilotBadgeText = this.add.text(pilotBadgeRect.x, pilotBadgeRect.y, pilotBadge(slot.pilot), {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        dialog.add(pilotBadgeRect);
        dialog.add(pilotBadgeText);
        slotCardEnd = badgeY;
        if ((slot.pilot.cardType || '').toLowerCase() !== 'command') {
          slotCardEnd += pilotCommandLift;
        }
      }

      // Unit layer
      if (slot.unit) {
        const unitTex = toTex(slot.unit.textureKey);
        const unitImg =
          unitTex && this.textures.exists(unitTex)
            ? this.add.image(x, y + pilotOffsetY * unitYOffsetFactor, unitTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
            : this.add.rectangle(x, y + pilotOffsetY * unitYOffsetFactor, cardW, cardH, 0xcbd3df, 0.9).setOrigin(0.5);
        dialog.add(unitImg);

        const unitBadgeRect = this.add.rectangle(
          x + cardW / 2 - badgeW / 2,
          y - pilotOffsetY * 0.4 + cardH / 2 - badgeH / 2,
          badgeW,
          badgeH,
          0x000000,
          0.9,
        );
        const unitBadgeText = this.add.text(unitBadgeRect.x, unitBadgeRect.y, unitBadge(slot.unit), {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        dialog.add(unitBadgeRect);
        dialog.add(unitBadgeText);

        if (slotCardEnd === -1) {
          slotCardEnd = y + pilotOffsetY * unitYOffsetFactor + cardH / 2 - badgeH / 2;
        }

        if (slot.fieldCardValue) {
          const totalRect = this.add.rectangle(x + cardW / 2 - badgeW / 2, slotCardEnd + badgeH + totalGap, badgeW, badgeH, 0x284cfc, 0.95);
          const totalText = this.add.text(totalRect.x, totalRect.y, `${slot.fieldCardValue.totalAP ?? 0}|${slot.fieldCardValue.totalHP ?? 0}`, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
          }).setOrigin(0.5);
          dialog.add(totalRect);
          dialog.add(totalText);
        }
      }
    };

    const maxCells = cols * rows;
    const items = targets.slice(0, maxCells);
    for (let i = 0; i < maxCells; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardWidth = cellWidth * 0.9;
      const cardHeightLocal = cardWidth * cardAspect;
      // draw frame beneath card
      const frame = this.add.rectangle(x, y, cardWidth + 12, cardHeightLocal + 12, 0x1b1e24, 0.75);
      frame.setStrokeStyle(3, 0x4caf50, 0.9);
      frame.setInteractive({ useHandCursor: !!items[i]?.unit });
      frame.on('pointerup', async () => {
        if (!items[i]?.unit) return;
        await this.engine.runAction('playPilotDesignationAsPilot');
        this.mainPhaseUpdate();
        this.refreshActions('neutral');
        this.hidePilotTargetDialog();
      });
      dialog.add(frame);

      drawPreviewLike(items[i], x, y, cardWidth, cardHeightLocal);
    }

    if (!items.length) {
      const empty = this.add.text(0, startY, 'No units available', {
        fontSize: '15px',
        fontFamily: 'Arial',
        color: '#d7d9dd',
        align: 'center',
      }).setOrigin(0.5);
      dialog.add(empty);
    }

    dialog.add([closeButton, closeLabel, header]);
    dialog.setDepth(2600);
    this.pilotTargetDialog = this.add.container(0, 0, [overlay, dialog]).setDepth(2598);
  }


}
