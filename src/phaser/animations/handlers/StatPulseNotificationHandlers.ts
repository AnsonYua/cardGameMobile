import type { AnimationContext } from '../AnimationTypes';
import type { SlotNotification } from '../NotificationAnimationController';

export type StatPulseHandler = (event: SlotNotification, ctx: AnimationContext) => Promise<void>;

export function createStatPulseHandler(
  triggerStatPulse: (event: SlotNotification, ctx: AnimationContext) => Promise<void>,
): StatPulseHandler {
  return async (event, ctx) => {
    await triggerStatPulse(event, ctx);
  };
}

export function buildStatPulseNotificationEntries(handler: StatPulseHandler): Array<[string, StatPulseHandler]> {
  return [
    ['CARD_STAT_MODIFIED', handler],
    ['CARD_DAMAGED', handler],
    ['PILOT_PAIRED_FROM_HAND', handler],
    ['PILOT_PAIRED_FROM_TRASH', handler],
  ];
}
