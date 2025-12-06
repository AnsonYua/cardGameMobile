import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";
import { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import { DrawHelpers } from "./ui/HeaderHandler";
import { BaseStatus } from "./ui/BaseShieldHandler";
import { ApiManager } from "./api/ApiManager";
import { GameSessionService, GameStatus, GameMode } from "./game/GameSessionService";
import { MatchStateMachine, MatchState } from "./game/MatchStateMachine";
import { ActionDispatcher } from "./controllers/ActionDispatcher";
import { TestButtonPopup } from "./ui/TestButtonPopup";

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
  private api = new ApiManager();
  private session = new GameSessionService(this.api);
  private match = new MatchStateMachine(this.session);
  private gameStatus: GameStatus = GameStatus.Idle;
  private gameMode: GameMode = GameMode.Host;
  private gameId: string | null = null;
  private playerId = "playerId_1";
  private playerName = "Demo Player";
  private headerControls: ReturnType<BoardUI["getHeaderControls"]> | null = null;
  private actionDispatcher = new ActionDispatcher();
  private uiVisible = true;
  private errorText?: Phaser.GameObjects.Text;
  private popup?: TestButtonPopup;

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
    this.headerControls = this.ui.getHeaderControls();
    this.match.events.on("status", (state: MatchState) => this.onMatchStatus(state));
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
    if (this.gameStatus !== GameStatus.Ready && this.gameStatus !== GameStatus.InMatch) {
      console.log("Not ready to start match yet");
      return;
    }
    this.session.markInMatch();
    this.gameStatus = GameStatus.InMatch;
    this.hideDefaultUI();
    const promise = this.shuffleManager?.play();
    promise
      ?.then(() => {
        this.showDefaultUI();
        this.showHandCards();
      })
      .then(() => console.log("Shuffle animation finished"));
  }

  // Placeholder helpers so the flow is explicit; wire up to real UI show/hide logic later.
  private hideDefaultUI() {
    // Aggregate hide so future changes stay centralized; avoid scattering visibility calls.
    this.baseControls?.setBaseTowerVisible(true, false);
    this.baseControls?.setBaseTowerVisible(false, false);
    this.energyControls?.setVisible(false);
    this.statusControls?.setVisible(false);
    this.handControls?.setVisible(false);
    console.log("hide default UI (placeholder)");
  }

  private showDefaultUI() {
    this.baseControls?.setBaseTowerVisible(true, true);
    this.baseControls?.setBaseTowerVisible(false, true);
    this.energyControls?.setVisible(true);
    this.statusControls?.setVisible(true);
    this.handControls?.setVisible(true);
    this.energyControls?.fadeIn();
    this.statusControls?.fadeIn();
    this.handControls?.fadeIn();
    console.log("show default UI (placeholder)");
  }

  private showHandCards() {
    console.log("show hand cards (placeholder)");
  }

  // Centralize UI wiring/drawing to reduce call scattering in create().
  private wireUiHandlers() {
    this.ui?.setActionHandler((index) => this.actionDispatcher.dispatch(index));
    this.headerControls?.setButtonHandler(() => this.startGame());
    this.headerControls?.setAvatarHandler(() => this.showPopup());
  }

  private async initSession() {
    try {
      this.offlineFallback = false;
      const params = new URLSearchParams(window.location.search);
      const rawMode = params.get("mode");
      if (!rawMode) {
        throw new Error("Missing mode");
      }
      const mode = rawMode === "join" ? GameMode.Join : rawMode === "host" ? GameMode.Host : undefined;
      if (!mode) {
        throw new Error("Invalid mode");
      }
      const roomParam = params.get("gameId") || params.get("roomid");
      const playerIdParam = params.get("playerId") || params.get("playerid");
      const playerNameParam = params.get("playerName") || params.get("playername");
      if (playerIdParam) this.playerId = playerIdParam;
      this.gameMode = mode;
      if (mode === GameMode.Join) {
        if (!roomParam) {
          throw new Error("Missing game id for join mode");
        }
        const joinName = playerNameParam || "Demo Opponent";
        this.playerName = joinName;
        this.gameStatus = GameStatus.CreatingRoom;
        await this.match.joinRoom(roomParam, this.playerId, joinName);
      } else {
        const hostName = playerNameParam || this.playerName || "Demo Player";
        this.playerName = hostName;
        this.gameStatus = GameStatus.CreatingRoom;
        await this.match.startAsHost(this.playerId, { playerName: hostName });
      }
    } catch (err) {
      console.error("Session init failed", err);
      const params = new URLSearchParams(window.location.search);
      const fallbackGameId =
        this.gameMode === GameMode.Join
          ? params.get("gameId") || params.get("roomid") || "join-local"
          : `demo-${Date.now()}`;
      // Fallback to a local ready state so the UI remains usable even if API/host is unreachable.
      this.offlineFallback = true;
      this.gameStatus = GameStatus.Ready;
      this.onMatchStatus({ status: GameStatus.Ready, gameId: fallbackGameId, mode: this.gameMode });
      // Keep UI clean; log error only.
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      console.warn("Using offline fallback:", msg);
    }
  }

  private onMatchStatus(state: MatchState) {
    this.gameStatus = state.status;
    this.gameId = state.gameId;
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

  private showPopup() {
    if (!this.popup) {
      this.popup = new TestButtonPopup(this);
    }
    this.popup.show(
      Array.from({ length: 6 }, () => ({
        label: "Test button1",
        onClick: () => console.log("Test button clicked"),
      })),
      this.gameId ?? "N/A",
    );
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
}
