import Phaser from "phaser";
import { FieldConfig, FieldHandler } from "../ui/FieldHandler";
import { SlotPositionMap } from "../ui/SlotTypes";

export class ShuffleAnimationManager {
  private playerCards: Phaser.GameObjects.Image[] = [];
  private opponentCards: Phaser.GameObjects.Image[] = [];
  private config: FieldConfig = JSON.parse(JSON.stringify(FieldHandler.DEFAULT_CONFIG));
  private playerDeckSprite: Phaser.GameObjects.GameObject | null = null;
  private opponentDeckSprite: Phaser.GameObjects.GameObject | null = null;
  private slotOrder = {
    opponent: ["slot4", "slot5", "slot6", "slot1", "slot2", "slot3"],
    player: ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"],
  };
  private getSlotPositions?: () => SlotPositionMap | undefined;
  private hideDeckVisual(owner: "opponent" | "player") {
    this.scene.children.list
      .filter((c: any) => typeof c.name === "string" && (c.name === `deck-pile-${owner}` || c.name === `deck-pile-text-${owner}`))
      .forEach((c: any) => c.setVisible(false));
  }
  private showDeckVisual(owner: "opponent" | "player") {
    this.scene.children.list
      .filter((c: any) => typeof c.name === "string" && (c.name === `deck-pile-${owner}` || c.name === `deck-pile-text-${owner}`))
      .forEach((c: any) => c.setVisible(true));
  }

  constructor(
    private scene: Phaser.Scene,
    private offset: { x: number; y: number },
    opts?: { getSlotPositions?: () => SlotPositionMap | undefined },
  ) {
    this.getSlotPositions = opts?.getSlotPositions;
  }

  play(onComplete?: () => void): Promise<void> {
    let resolvePromise: () => void;
    const completion = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    this.createDeckStacks();

    let completed = 0;
    const total = 2;
    const markDone = () => {
      completed += 1;
      if (completed >= total) {
        this.cleanup();
        onComplete?.();
        resolvePromise?.();
      }
    };

    // Run both shuffles concurrently
    this.shuffleSide(true, markDone);
    this.shuffleSide(false, markDone);

    return completion;
  }

  private createDeckStacks() {
    const numCards = 50;
    this.playerCards = [];
    this.opponentCards = [];

    const playerDeck = this.getDeckStackConfig(false);
    const opponentDeck = this.getDeckStackConfig(true);

    // Hide main deck sprites while shuffle runs
    this.playerDeckSprite = this.scene.children.getByName("deck-pile-player") as Phaser.GameObjects.GameObject;
    this.opponentDeckSprite = this.scene.children.getByName("deck-pile-opponent") as Phaser.GameObjects.GameObject;
    this.playerDeckSprite?.setVisible(false);
    this.opponentDeckSprite?.setVisible(false);

    for (let i = 0; i < numCards; i++) {
      const imgKey = this.scene.textures.exists("deckBack") ? "deckBack" : undefined;
      const pCard = imgKey
        ? this.scene.add.image(playerDeck.x, playerDeck.y, imgKey)
        : (this.scene.add.rectangle(playerDeck.x, playerDeck.y, playerDeck.w, playerDeck.h, 0x5e48f0) as any);
      pCard.setDisplaySize(playerDeck.w, playerDeck.h).setDepth(100 + i);
      this.playerCards.push(pCard as Phaser.GameObjects.Image);

      const oCard = imgKey
        ? this.scene.add.image(opponentDeck.x, opponentDeck.y, imgKey)
        : (this.scene.add.rectangle(opponentDeck.x, opponentDeck.y, opponentDeck.w, opponentDeck.h, 0x5e48f0) as any);
      oCard.setDisplaySize(opponentDeck.w, opponentDeck.h).setDepth(100 + i);
      this.opponentCards.push(oCard as Phaser.GameObjects.Image);
    }
  }

  private shuffleSide(isOpponent: boolean, done: () => void) {
    const deckPos = this.getDeckStackConfig(isOpponent);
    const slots = this.getBoardSlotPositions(isOpponent);
    const cards = isOpponent ? this.opponentCards : this.playerCards;
    const deckSprite = isOpponent ? this.opponentDeckSprite : this.playerDeckSprite;
    const owner = isOpponent ? "opponent" : "player";

    // Hide deck visuals as soon as the shuffle starts.
    deckSprite?.setVisible(false);
    this.hideDeckVisual(owner);

    // Move cards from deck to slots in stacks
    const travelDuration = 450;
    const delayBetween = 120;
    cards.forEach((card, idx) => {
      const slotIndex = idx % slots.length;
      const stackLevel = Math.floor(idx / slots.length);
      const target = slots[slotIndex];
      this.scene.tweens.add({
        targets: card,
        x: target.x,
        y: target.y - stackLevel * 2,
        duration: travelDuration,
        delay: idx * delayBetween,
        ease: "Power2",
        onComplete: () => {
          if (idx === cards.length - 1) {
            // After a short pause, return all cards to deck
            this.scene.time.delayedCall(300, () => this.returnToDeck(cards, deckPos, done));
          }
        },
      });
    });
  }

  private returnToDeck(cards: Phaser.GameObjects.Image[], deckPos: { x: number; y: number }, done: () => void) {
    const duration = 450;
    const delayBetween = 100;
    // Bring top cards back first visually
    const reversed = [...cards].reverse();
    reversed.forEach((card, idx) => {
      this.scene.tweens.add({
        targets: card,
        x: deckPos.x,
        y: deckPos.y,
        rotation: 0,
        duration,
        delay: idx * delayBetween,
        ease: "Power2",
        onComplete: () => {
          // Reveal the main deck sprite once first card arrives
          if (idx === 0) {
            const deckSprite = cards === this.playerCards ? this.playerDeckSprite : this.opponentDeckSprite;
            deckSprite?.setVisible(true);
            
          }
          this.showDeckVisual(cards === this.playerCards ? "player" : "opponent");
          if (idx === reversed.length - 1) {
            done();
          }
        },
      });
    });
  }

  private getBoardSlotPositions(isOpponent: boolean) {
    const liveSlots = this.getSlotPositions?.();
    if (liveSlots) {
      const ownerKey = isOpponent ? "opponent" : "player";
      const slotMap = liveSlots[ownerKey];
      const ordered = (isOpponent ? this.slotOrder.opponent : this.slotOrder.player)
        .map((slotId) => slotMap?.[slotId])
        .filter(Boolean) as { x: number; y: number }[];
      if (ordered.length) {
        return ordered;
      }
      const fallback = Object.values(slotMap || {}).map((slot) => ({ x: slot.x, y: slot.y }));
      if (fallback.length) {
        return fallback;
      }
    }

    const { slotW, slotH, gap, cols, rows } = this.config;
    const centerX = this.config.side[isOpponent ? "opponent" : "player"].centerX + this.offset.x;
    const originY = this.config.side[isOpponent ? "opponent" : "player"].originY + this.offset.y;
    const gridTotalW = cols * slotW + (cols - 1) * gap;
    const gridStartX = centerX - gridTotalW / 2;
    const rowY = (rowIndex: number) => originY + rowIndex * (slotH + gap);

    const positions: { x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridStartX + c * (slotW + gap) + slotW / 2;
        const y = rowY(r);
        positions.push({ x, y });
      }
    }
    return positions;
  }

  private getDeckPosition(isOpponent: boolean) {
    const cfg = this.config;
    const side = cfg.side[isOpponent ? "opponent" : "player"];
    const centerX = side.centerX + this.offset.x;
    const originY = side.originY + this.offset.y;
    const gridTotalW = cfg.cols * cfg.slotW + (cfg.cols - 1) * cfg.gap;
    const gridStartX = centerX - gridTotalW / 2;
    const leftX = gridStartX - cfg.slotW / 2 - cfg.columnGap;
    const rightX = gridStartX + gridTotalW + cfg.slotW / 2 + cfg.columnGap;
    const opponentBaseCenterX = rightX + cfg.side.opponent.towerOffsetX + cfg.side.opponent.baseCenterX;
    const playerBaseCenterX = leftX + cfg.side.player.towerOffsetX + cfg.side.player.baseCenterX;
    const pileX = isOpponent ? playerBaseCenterX : opponentBaseCenterX;
    const pileYOffset = side.deckTrashOffsetY;
    const pileGap = 12;
    const deckY = isOpponent
      ? originY + cfg.deckH / 2 + pileGap / 2 + pileYOffset
      : originY - cfg.deckH / 2 - pileGap / 2 + pileYOffset;
    return { x: pileX, y: deckY };
  }

  private getDeckStackConfig(isOpponent: boolean) {
    const owner = isOpponent ? "opponent" : "player";
    const deckSprite = this.scene.children.getByName(`deck-pile-${owner}`) as Phaser.GameObjects.GameObject | null;
    if (deckSprite && "x" in deckSprite && "y" in deckSprite) {
      const w = "displayWidth" in deckSprite ? deckSprite.displayWidth : this.config.deckW;
      const h = "displayHeight" in deckSprite ? deckSprite.displayHeight : this.config.deckH;
      return { x: deckSprite.x, y: deckSprite.y, w, h };
    }
    const fallback = this.getDeckPosition(isOpponent);
    return { x: fallback.x, y: fallback.y, w: this.config.deckW, h: this.config.deckH };
  }

  private cleanup() {
    [...this.playerCards, ...this.opponentCards].forEach((c) => c.destroy());
    this.playerCards = [];
    this.opponentCards = [];
    this.playerDeckSprite = null;
    this.opponentDeckSprite = null;
  }
}
