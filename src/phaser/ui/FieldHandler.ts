import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import { GameStatus, GameStatusHandler } from "./GameStatusHandler";
import { ShieldAreaControls, ShieldAreaHandler } from "./ShieldAreaHandler";
import { EnergyBarHandler, EnergyCounts } from "./EnergyBarHandler";
import { SlotDisplayHandler } from "./SlotDisplayHandler";
import { SlotOwner, SlotPositionMap, SlotViewModel, SlotCardView } from "./SlotTypes";

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
  private shieldArea: ShieldAreaHandler;
  private baseControls: ShieldAreaControls;
  private energyBarOpponent: EnergyBarHandler;
  private energyBarPlayer: EnergyBarHandler;
  private statusVisible = true;
  private energyVisible = true;
  private energyAnchors: {
    opponent?: { x: number; y: number; width: number; isOpponent: boolean };
    player?: { x: number; y: number; width: number; isOpponent: boolean };
  } = {};
  private slotDisplay: SlotDisplayHandler;
  private boardSlotPositions: SlotPositionMap = { player: {}, opponent: {} };
  private slotOrder = {
    opponent: ["slot4", "slot5", "slot6", "slot1", "slot2", "slot3"],
    player: ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"],
  };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.field = JSON.parse(JSON.stringify(FieldHandler.DEFAULT_CONFIG));
    this.gameStatusOpponent = new GameStatusHandler(scene);
    this.gameStatusPlayer = new GameStatusHandler(scene);
    this.shieldArea = new ShieldAreaHandler(scene, palette, drawHelpers);
    this.baseControls = this.shieldArea;
    this.energyBarOpponent = new EnergyBarHandler(scene, drawHelpers);
    this.energyBarPlayer = new EnergyBarHandler(scene, drawHelpers);
    this.slotDisplay = new SlotDisplayHandler(scene, palette, drawHelpers);
  }

  draw(offset: Offset) {
    this.boardSlotPositions = { player: {}, opponent: {} };
    this.drawFieldSide(this.field.side.opponent, offset, true);
    this.drawFieldSide(this.field.side.player, offset, false);
  }

  setStatusVisible(visible: boolean) {
    this.statusVisible = visible;
    this.gameStatusOpponent.setVisible(visible);
    this.gameStatusPlayer.setVisible(visible);
  }

  fadeInStatus() {
    this.statusVisible = true;
    this.gameStatusOpponent.setVisible(true);
    this.gameStatusPlayer.setVisible(true);
  }

  setEnergyVisible(visible: boolean) {
    this.energyVisible = visible;
    this.energyBarOpponent.setVisible(visible);
    this.energyBarPlayer.setVisible(visible);
  }

  fadeInEnergy() {
    this.energyVisible = true;
    this.energyBarOpponent.setVisible(true);
    this.energyBarPlayer.setVisible(true);
  }

  getEnergyControls() {
    return {
      setVisible: (visible: boolean) => this.setEnergyVisible(visible),
      fadeIn: () => this.fadeInEnergy(),
      update: (isOpponent: boolean, status: GameStatus) => this.updateEnergyArea(isOpponent, status),
    };
  }

  getStatusControls() {
    return {
      setVisible: (visible: boolean) => this.setStatusVisible(visible),
      fadeIn: () => this.fadeInStatus(),
    };
  }

  getSlotControls() {
    return {
      setSlots: (slots: SlotViewModel[]) => this.slotDisplay.render(slots, { positions: this.boardSlotPositions }),
      clearSlots: () => this.slotDisplay.clear(),
      setSlotClickHandler: (handler?: (slot: SlotViewModel) => void) => this.slotDisplay.setSlotClickHandler(handler),
      setPlayAnimations: (enabled: boolean) => this.slotDisplay.setPlayAnimations(enabled),
      setSelectedSlot: (owner?: SlotOwner, slotId?: string) =>
        this.slotDisplay.setSelectedSlot(owner && slotId ? `${owner}-${slotId}` : undefined),
      playCardAnimation: (
        slot: SlotViewModel,
        card?: SlotCardView,
        startOverride?: { x: number; y: number; isOpponent?: boolean },
        endOverride?: { x: number; y: number; isOpponent?: boolean },
      ) => this.slotDisplay.playCardAnimation(slot, card, startOverride, endOverride),
      getSlotAreaCenter: (owner: SlotOwner) => this.slotDisplay.getSlotAreaCenter(owner),
      getBoardSlotPositions: () => this.boardSlotPositions,
      markStatAnimationPending: (slotKey: string) => this.slotDisplay.markStatAnimationPending(slotKey),
      releaseStatAnimation: (slotKey: string) => this.slotDisplay.releaseStatAnimation(slotKey),
      playStatPulse: (slotKey: string, delta: number) => this.slotDisplay.playStatPulse(slotKey, delta),
      setSlotClickEnabled: (enabled: boolean) => this.slotDisplay.setSlotClickEnabled(enabled),
      setSlotVisible: (owner: SlotOwner, slotId: string, visible: boolean) =>
        this.slotDisplay.setSlotVisible(owner, slotId, visible),
      createSlotSprite: (slot: SlotViewModel, size: { w: number; h: number }) =>
        this.slotDisplay.createSlotSprite(slot, size),
    };
  }

  getBaseControls(): ShieldAreaControls {
    return this.baseControls;
  }

  private drawFieldSide(sideConfig: FieldConfig["side"]["opponent"], offset: Offset, isOpponent: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, columnGap, energy } = this.field;
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
        const orderIndex = r * cols + c;
        const orderList = isOpponent ? this.slotOrder.opponent : this.slotOrder.player;
        const slotId = orderList[orderIndex] || `slot${orderIndex + 1}`;
        const bucket = isOpponent ? this.boardSlotPositions.opponent : this.boardSlotPositions.player;
        bucket[slotId] = { id: slotId, x, y, w: slot, h: slot, isOpponent };
        this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: slot,
          height: slot,
          radius: 6,
          fillColor: "#ffffff",
          fillAlpha: 0.35,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.8,
          strokeWidth: 2,
        });
        // Overlay rect on top of slot to indicate a stack area.
        this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: 60,
          height: 60,
          radius: 4,
          fillColor: "#f5f5f5",
          fillAlpha: 0,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.6,
          strokeWidth: 1,
        });
        //this.scene.add.text(x, y, "slot", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
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

    this.shieldArea.drawStack({
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
    const energyKey = isOpponent ? "opponent" : "player";
    this.energyAnchors[energyKey] = { x: energyX, y: energyY, width: gridTotalW, isOpponent };
    const energyBar = isOpponent ? this.energyBarOpponent : this.energyBarPlayer;
    energyBar.drawBar(energyX, energyY, energy, gridTotalW, isOpponent, { active: 0, rested: 0, extra: 0 });
    energyBar.setVisible(this.energyVisible);
    const statusHandler = isOpponent ? this.gameStatusOpponent : this.gameStatusPlayer;
    statusHandler.draw(energyX, energyY, gridTotalW, isOpponent, {
      shield: this.shieldArea.getShieldCount(isOpponent),
      active: 0,
      rested: 0,
      extra: 0,
    });
    statusHandler.setVisible(this.statusVisible);
  }

  updateEnergyArea(isOpponent: boolean, status: GameStatus) {
    const key = isOpponent ? "opponent" : "player";
    const anchor = this.energyAnchors[key];
    if (!anchor) return;
    const merged: GameStatus = {
      shield: status.shield ?? this.shieldArea.getShieldCount(isOpponent),
      active: status.active ?? 0,
      rested: status.rested ?? 0,
      extra: status.extra ?? 0,
    };
    const energyBar = isOpponent ? this.energyBarOpponent : this.energyBarPlayer;
    const statusHandler = isOpponent ? this.gameStatusOpponent : this.gameStatusPlayer;
    const counts: EnergyCounts = {
      active: merged.active,
      rested: merged.rested,
      extra: merged.extra,
    };
    energyBar.redrawWithCounts(counts);
    energyBar.setVisible(this.energyVisible);
    statusHandler.draw(anchor.x, anchor.y, anchor.width, isOpponent, merged);
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
    }if(label === 'trash') {
      this.drawTrashBox(x, y, w, h, label);
    }else {
      this.drawCardBox(x, y, w, h, label);
    }
  }
  private drawTrashBox(x: number, y: number, w: number, h: number, label: string) {
    this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 8,
      fillColor: "#ffffff",
      fillAlpha: 0.3,
      strokeColor: this.palette.ink,
      strokeAlpha: 1,
      strokeWidth: 2,
    });
    if (label) {
      this.scene.add.text(x, y, label, { fontSize: "13px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
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
