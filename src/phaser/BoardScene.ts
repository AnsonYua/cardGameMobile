import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";
import { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import { DrawHelpers } from "./ui/HeaderHandler";
import { BaseStatus } from "./ui/BaseShieldHandler";

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
  private baseControls: ReturnType<BoardUI["getBaseControls"]> | null = null;
  private energyControls: ReturnType<BoardUI["getEnergyControls"]> | null = null;
  private statusControls: ReturnType<BoardUI["getStatusControls"]> | null = null;
  private handControls: ReturnType<BoardUI["getHandControls"]> | null = null;
  private uiVisible = true;

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
    const baseControls = this.baseControls;
    this.ui.setActionHandler((index) => {
      if (index === 0) {
        const promise = this.shuffleManager?.play();
        promise?.then(() => console.log("Shuffle animation finished"));
      } else if (index === 1) {
        this.playerBaseStatus = this.playerBaseStatus === "rested" ? "normal" : "rested";
        baseControls.setBaseStatus(true, this.playerBaseStatus);
        baseControls.setBaseBadgeLabel(true, this.playerBaseStatus === "rested" ? "2|3" : "0|3");
      } else if (index == 2) {
        baseControls.setBaseStatus(true, "normal");
        baseControls.setBaseBadgeLabel(true, "0|0");
      } else if (index === 3) {
        // Cycle player shield count to demo dynamic stack redraw.
        this.playerShieldCount = (this.playerShieldCount + 1) % 7;
        baseControls.setShieldCount(true, this.playerShieldCount);
        baseControls.setBaseBadgeLabel(true, `${this.playerShieldCount}|6`);
      }else if(index ===9){
        this.startGame()
      }
    });
    this.ui.drawFrame(this.offset);
    this.ui.drawHeader(this.offset);
    this.ui.drawField(this.offset);
    this.ui.drawActions(this.offset);
    this.ui.drawHand(this.offset);

    this.hideDefaultUI();
  }
   
  public startGame(){
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
}
