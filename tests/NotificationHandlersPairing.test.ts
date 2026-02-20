import { describe, expect, it, vi } from 'vitest';
import { buildNotificationHandlers } from '../src/phaser/animations/NotificationHandlers';

function createDeps() {
  return {
    cardPlayAnimator: {
      playCardPlayed: vi.fn(async () => undefined),
      playCardDrawn: vi.fn(async () => undefined),
      playCardsDrawn: vi.fn(async () => undefined),
      playTopDeckViewed: vi.fn(async () => undefined),
      playCardsMovedToTrash: vi.fn(async () => undefined),
      playCardsMovedToDeckBottom: vi.fn(async () => undefined),
    },
    battleAnimator: {
      playBattleResolution: vi.fn(async () => undefined),
    },
    attackIndicator: {
      updateFromNotification: vi.fn(async () => undefined),
      clear: vi.fn(),
    },
  } as any;
}

describe('NotificationHandlers pairing notifications', () => {
  it('handles PILOT_PAIRED_FROM_HAND without queue break', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const handlers = buildNotificationHandlers(createDeps(), { triggerStatPulse });

    const handler = handlers.get('PILOT_PAIRED_FROM_HAND');
    expect(handler).toBeTruthy();

    await handler?.({ type: 'PILOT_PAIRED_FROM_HAND', payload: {}, id: 'n1' } as any, {
      slots: [],
      allowAnimations: true,
    } as any);

    expect(triggerStatPulse).toHaveBeenCalledTimes(1);
  });

  it('handles PILOT_PAIRED_FROM_TRASH without queue break', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const handlers = buildNotificationHandlers(createDeps(), { triggerStatPulse });

    const handler = handlers.get('PILOT_PAIRED_FROM_TRASH');
    expect(handler).toBeTruthy();

    await handler?.({ type: 'PILOT_PAIRED_FROM_TRASH', payload: {}, id: 'n2' } as any, {
      slots: [],
      allowAnimations: true,
    } as any);

    expect(triggerStatPulse).toHaveBeenCalledTimes(1);
  });
});
