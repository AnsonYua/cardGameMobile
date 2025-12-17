import type { AnimationJob } from "./PlayAnimationService";
import type { SlotViewModel, SlotCardView, SlotOwner } from "../ui/SlotTypes";

export type SlotNotification = {
  eventType?: string;
  playerId?: string;
  owner?: SlotOwner;
  slotId?: string;
  cardUid?: string;
  cardId?: string;
  metadata?: any;
};

export type SlotAnimationKind = "card_played" | "attack" | "command" | "unknown";

type AnimationCallback = (
  slot: SlotViewModel,
  card?: SlotCardView,
  startOverride?: { x: number; y: number; isOpponent?: boolean },
  endOverride?: { x: number; y: number; isOpponent?: boolean },
) => void;

export class SlotAnimationController {
  constructor(private playAnimation: AnimationCallback) {}

  animate(
    jobs: AnimationJob[],
    slots: SlotViewModel[],
    notificationQueue: SlotNotification[],
    opts: { allowAnimations: boolean },
  ) {
    if (!opts.allowAnimations || !jobs.length) return;
    jobs.forEach((job) => {
      const target = slots.find((s) => s.slotId === job.slotId && s.owner === job.owner);
      if (!target) return;
      const notification = this.findMatchingNotification(job, notificationQueue);
      const kind = this.resolveAnimationKind(notification);
      const overrides = this.buildOverrides(job, kind);
      this.playAnimation(target, job.card, overrides.start ?? job.start, overrides.end ?? job.end);
    });
  }

  private findMatchingNotification(job: AnimationJob, queue: SlotNotification[]): SlotNotification | undefined {
    return queue.find((notification) => {
      if (!notification) return false;
      if (notification.cardUid && job.card?.cardUid && notification.cardUid === job.card.cardUid) {
        return true;
      }
      if (notification.cardId && job.card?.id && notification.cardId === job.card.id) {
        return true;
      }
      if (notification.slotId && notification.owner && notification.slotId === job.slotId && notification.owner === job.owner) {
        return true;
      }
      return false;
    });
  }

  private resolveAnimationKind(notification?: SlotNotification): SlotAnimationKind {
    const type = (notification?.eventType ?? "").toString().toUpperCase();
    if (!type) return "unknown";
    if (type.includes("ATTACK") || type.includes("DAMAGE")) return "attack";
    if (type.includes("COMMAND")) return "command";
    if (type.includes("CARD_PLAYED") || type.includes("PLAY_CARD")) return "card_played";
    return "unknown";
  }

  private buildOverrides(job: AnimationJob, kind: SlotAnimationKind) {
    // Future: customize overrides depending on animation kind.
    return { start: job.start, end: job.end };
  }
}
