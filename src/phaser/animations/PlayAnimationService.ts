import Phaser from "phaser";
import type { SlotViewModel, SlotPositionMap, SlotCardView, SlotOwner } from "../ui/SlotTypes";

export type AnimationJob = {
  owner: SlotOwner;
  slotId: string;
  card?: SlotCardView;
  start?: { x: number; y: number; isOpponent?: boolean };
  end?: { x: number; y: number; isOpponent?: boolean };
};

/**
 * Centralizes play-card animation decisions for slots so rendering code stays lean.
 */
export class PlayAnimationService {
  constructor(private scene: Phaser.Scene) {}

  computeSlotEntryJobs(
    prevSlots: SlotViewModel[],
    nextSlots: SlotViewModel[],
    positions: SlotPositionMap | undefined,
    opts: { allowAnimations: boolean } = { allowAnimations: true },
  ): AnimationJob[] {
    if (!opts.allowAnimations || !positions) return [];
    const jobs: AnimationJob[] = [];
    const prevByKey = new Map<string, SlotViewModel>();
    prevSlots.forEach((s) => prevByKey.set(this.toKey(s), s));
    nextSlots.forEach((slot) => {
      const key = this.toKey(slot);
      const prev = prevByKey.get(key);
      const hadCard = !!(prev && (prev.unit || prev.pilot));
      const hasCard = !!(slot.unit || slot.pilot);
      const pilotAdded = !prev?.pilot && !!slot.pilot;
      const pos = positions[slot.owner]?.[slot.slotId];
      if (!pos) return;

      const isCommand = this.isCommandCard(slot.unit || slot.pilot);
      const handStart = this.getHandOrigin(slot.owner);

      if (!hadCard && hasCard && !isCommand) {
        jobs.push({
          owner: slot.owner,
          slotId: slot.slotId,
          card: slot.unit || slot.pilot,
          start: handStart,
          end: { x: pos.x, y: pos.y, isOpponent: pos.isOpponent },
        });
      } else if (pilotAdded && !this.isCommandCard(slot.pilot)) {
        jobs.push({
          owner: slot.owner,
          slotId: slot.slotId,
          card: slot.pilot,
          start: handStart,
          end: { x: pos.x, y: pos.y, isOpponent: pos.isOpponent },
        });
      }
    });
    return jobs;
  }

  getSlotAreaCenter(positions: SlotPositionMap | undefined, owner: SlotOwner) {
    const slots = positions?.[owner];
    if (!slots) return undefined;
    const vals = Object.values(slots);
    if (!vals.length) return undefined;
    const sum = vals.reduce(
      (acc, p) => {
        acc.x += p.x;
        acc.y += p.y;
        return acc;
      },
      { x: 0, y: 0 },
    );
    return { x: sum.x / vals.length, y: sum.y / vals.length };
  }

  private toKey(slot: SlotViewModel) {
    return `${slot.owner}-${slot.slotId}`;
  }

  private isCommandCard(card?: SlotCardView) {
    return (card?.cardType || card?.cardData?.cardType || "").toLowerCase() === "command";
  }

  private getHandOrigin(owner: SlotOwner) {
    const cam = this.scene.cameras.main;
    const isOpponent = owner === "opponent";
    return {
      x: cam.centerX,
      y: isOpponent ? cam.height * 0.12 : cam.height - 60,
      isOpponent,
    };
  }
}
