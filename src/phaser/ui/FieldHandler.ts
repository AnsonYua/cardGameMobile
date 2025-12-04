import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import { GameStatusHandler } from "./GameStatusHandler";
import { BaseControls, BaseShieldHandler } from "./BaseShieldHandler";
import { EnergyBarHandler } from "./EnergyBarHandler";

export type FieldConfig = {
  slot: number;
  gap: number;
  cols: number;
  rows: number;
  deckW: number;
  deckH: number;
  towerWidth: number;
  energy: {
    count: number;
    perRow: number;
    rows: number;
    radius: number;
    gap: number;
    rowGap: number;
    offsetFromSlots: number;
    fillColor: string;
    emptyColor: string;
    offsetX: {
      opponent: number;
      player: number;
    };
    offsetY: {
      opponent: number;
      player: number;
    };
  };
  side: {
    opponent: {
      centerX: number;
      originY: number;
      towerOffsetX: number;
      towerOffsetY: number;
      baseCenterX: number;
      shieldCenterX: number;
      baseCenterY: number;
      shieldCenterY: number;
      deckTrashOffsetY: number;
    };
    player: {
      centerX: number;
      originY: number;
      towerOffsetX: number;
      towerOffsetY: number;
      baseCenterX: number;
      shieldCenterX: number;
      baseCenterY: number;
      shieldCenterY: number;
      deckTrashOffsetY: number;
    };
  };
  columnGap: number;
};

export class FieldHandler {
  static readonly DEFAULT_CONFIG: FieldConfig = {
    slot: 90,
    gap: 5,
    cols: 3,
    rows: 2,
    deckW: 57,
    deckH: 80,
    towerWidth: 64,
    energy: {
      count: 12,
      perRow: 12,
      rows: 1,
      radius: 6,
      gap: 4,
      rowGap: 8,
      offsetFromSlots: 16,
      fillColor: "#18c56c",
      emptyColor: "#d94d4d",
      offsetX: { opponent: 8, player: 8 },
      offsetY: { opponent: 0, player: 0 },
    },
    side: {
      opponent: {
        centerX: BASE_W / 2,
        originY: 155,
        towerOffsetX: 0,
        towerOffsetY: 0,
        baseCenterX: 0,
        shieldCenterX: 0,
        baseCenterY: 0,
        shieldCenterY: 0,
        deckTrashOffsetY: 20,
      },
      player: {
        centerX: BASE_W / 2,
        originY: 155 + 195,
        towerOffsetX: 0,
        towerOffsetY: 60,
        baseCenterX: 0,
        shieldCenterX: 0,
        baseCenterY: 10,
        shieldCenterY: 0,
        deckTrashOffsetY: 60,
      },
    },
    columnGap: 2,
  };

  // Keep header reference to anchor top-side stacks just below it.
  private headerHeight = 82;
  private headerGap = 8;

  private field: FieldConfig;
  private gameStatusOpponent: GameStatusHandler;
  private gameStatusPlayer: GameStatusHandler;
  private baseShield: BaseShieldHandler;
  private baseControls: BaseControls;
  private energyBarOpponent: EnergyBarHandler;
  private energyBarPlayer: EnergyBarHandler;
  private statusVisible = true;
  private energyVisible = true;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.field = JSON.parse(JSON.stringify(FieldHandler.DEFAULT_CONFIG));
    this.gameStatusOpponent = new GameStatusHandler(scene, palette);
    this.gameStatusPlayer = new GameStatusHandler(scene, palette);
    this.baseShield = new BaseShieldHandler(scene, palette, drawHelpers);
    this.baseControls = this.baseShield;
    this.energyBarOpponent = new EnergyBarHandler(scene, drawHelpers);
    this.energyBarPlayer = new EnergyBarHandler(scene, drawHelpers);
  }

  draw(offset: Offset) {
    this.drawFieldSide(this.field.side.opponent, offset, true);
    this.drawFieldSide(this.field.side.player, offset, false);
  }

  setStatusVisible(visible: boolean) {
    this.statusVisible = visible;
    this.gameStatusOpponent.setVisible(visible);
    this.gameStatusPlayer.setVisible(visible);
  }

  fadeInStatus(duration = 200) {
    this.statusVisible = true;
    this.gameStatusOpponent.fadeIn(duration);
    this.gameStatusPlayer.fadeIn(duration);
  }

  setEnergyVisible(visible: boolean) {
    this.energyVisible = visible;
    this.energyBarOpponent.setVisible(visible);
    this.energyBarPlayer.setVisible(visible);
  }

  fadeInEnergy(duration = 200) {
    this.energyVisible = true;
    this.energyBarOpponent.fadeIn(duration);
    this.energyBarPlayer.fadeIn(duration);
  }

  getEnergyControls() {
    return {
      setVisible: (visible: boolean) => this.setEnergyVisible(visible),
      fadeIn: (duration?: number) => this.fadeInEnergy(duration),
    };
  }

  getStatusControls() {
    return {
      setVisible: (visible: boolean) => this.setStatusVisible(visible),
      fadeIn: (duration?: number) => this.fadeInStatus(duration),
    };
  }

  getBaseControls(): BaseControls {
    return this.baseControls;
  }

  private drawFieldSide(sideConfig: FieldConfig["side"]["opponent"], offset: Offset, isOpponent: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, towerWidth, columnGap, energy } = this.field;
    const centerX = sideConfig.centerX + offset.x;
    const originY = sideConfig.originY + offset.y;
    const sideOffsets = sideConfig;
    const gridTotalW = cols * slot + (cols - 1) * gap;
    const gridStartX = centerX - gridTotalW / 2;
    const rowY = (rowIndex: number) => originY + rowIndex * (slot + gap);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridStartX + c * (slot + gap) + slot / 2;
        const y = rowY(r);
        this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: slot,
          height: slot,
          radius: 6,
          fillColor: "#ffffff",
          fillAlpha: 1,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.8,
          strokeWidth: 2,
        });
        // Overlay rect on top of slot to indicate a stack area.
        this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: 70,
          height: 80,
          radius: 4,
          fillColor: "#f5f5f5",
          fillAlpha: 0.35,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.6,
          strokeWidth: 1,
        });
        this.scene.add.text(x, y, "slot", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
      }
    }

    const leftX = gridStartX - slot / 2 - columnGap;
    const rightX = gridStartX + gridTotalW + slot / 2 + columnGap;
    const towerX = (isOpponent ? rightX : leftX) + sideOffsets.towerOffsetX;
    const opponentBaseCenterX =
      rightX + this.field.side.opponent.towerOffsetX + this.field.side.opponent.baseCenterX;
    const playerBaseCenterX = leftX + this.field.side.player.towerOffsetX + this.field.side.player.baseCenterX;
    const pileX = isOpponent ? playerBaseCenterX : opponentBaseCenterX;
    const pileYOffset = sideOffsets.deckTrashOffsetY;

    const pileGap = 12;
    const topPileLabel = isOpponent ? "trash" : "deck";
    const bottomPileLabel = isOpponent ? "deck" : "trash";
    const topPileY = originY - deckH / 2 - pileGap / 2 + pileYOffset;
    const bottomPileY = originY + deckH / 2 + pileGap / 2 + pileYOffset;
    this.drawPile(pileX, topPileY, deckW, deckH, topPileLabel, isOpponent ? "opponent" : "player");
    this.drawPile(pileX, bottomPileY, deckW, deckH, bottomPileLabel, isOpponent ? "opponent" : "player");

    this.baseShield.drawStack({
      towerX,
      originY,
      isOpponent,
      offsets: {
        shieldCenterX: sideOffsets.shieldCenterX,
        baseCenterX: sideOffsets.baseCenterX,
        shieldCenterY: sideOffsets.shieldCenterY,
        baseCenterY: sideOffsets.baseCenterY,
        towerOffsetY: sideOffsets.towerOffsetY,
      },
      headerHeight: this.headerHeight,
      headerGap: this.headerGap,
    });

    // Energy bar: opponent above slots, player below slots.
    const energyYOffset = isOpponent ? energy.offsetY.opponent : energy.offsetY.player;
    const energyY =
      (isOpponent
        ? originY - slot / 2 - energy.offsetFromSlots
        : originY + (rows - 1) * (slot + gap) + slot / 2 + energy.offsetFromSlots) + energyYOffset;
    const energyX = centerX + (isOpponent ? energy.offsetX.opponent : energy.offsetX.player);
    const energyBar = isOpponent ? this.energyBarOpponent : this.energyBarPlayer;
    energyBar.drawBar(energyX, energyY, energy, gridTotalW, isOpponent);
    energyBar.setVisible(this.energyVisible);
    const statusHandler = isOpponent ? this.gameStatusOpponent : this.gameStatusPlayer;
    statusHandler.draw(energyX, energyY, gridTotalW, isOpponent, {
      shield: this.baseShield.getShieldCount(isOpponent),
      active: 0,
      rested: 0,
      extra: 0,
    });
    statusHandler.setVisible(this.statusVisible);
  }

  private drawPile(x: number, y: number, w: number, h: number, label: string, owner: "opponent" | "player") {
    if (label === "deck") {
      if (this.scene.textures.exists("deckBack")) {
        this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setDepth(10).setName(`deck-pile-${owner}`);
      } else {
        const deckShape = this.drawHandStyleCard(x, y, w, h, 0xb8673f);
        deckShape?.setName(`deck-pile-${owner}`);
        this.scene
          .add.text(x, y, "deck", { fontSize: "14px", fontFamily: "Arial", color: "#0f1118" })
          .setOrigin(0.5)
          .setName(`deck-pile-text-${owner}`);
      }
    } else {
      this.drawCardBox(x, y, w, h, label);
    }
  }

  private drawCardBox(x: number, y: number, w: number, h: number, label: string) {
    this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 8,
      fillColor: "#ffffff",
      fillAlpha: 1,
      strokeColor: this.palette.ink,
      strokeAlpha: 1,
      strokeWidth: 2,
    });
    if (label) {
      this.scene.add.text(x, y, label, { fontSize: "13px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    }
  }

  private drawHandStyleCard(x: number, y: number, w: number, h: number, fill: number) {
    const outer = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: fill,
      fillAlpha: 1,
      strokeColor: this.drawHelpers.toColor("#5a463a"),
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
    this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w - 12,
      height: h - 18,
      radius: 8,
      fillColor: this.drawHelpers.toColor("#d7a97d"),
      fillAlpha: 0.6,
      strokeColor: this.drawHelpers.toColor("#9b6c4b"),
      strokeAlpha: 0.7,
      strokeWidth: 2,
    });
    return outer;
  }

}
