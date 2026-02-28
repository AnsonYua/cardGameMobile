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
      markAttackResolved: vi.fn(),
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

  it('registers TOKEN_DEPLOYED so event stays sequenced in animation queue', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const handlers = buildNotificationHandlers(createDeps(), { triggerStatPulse });

    const handler = handlers.get('TOKEN_DEPLOYED');
    expect(handler).toBeTruthy();

    await handler?.({ type: 'TOKEN_DEPLOYED', payload: {}, id: 'n3' } as any, {
      slots: [],
      allowAnimations: true,
    } as any);
  });

  it('skips battle animation when BATTLE_RESOLVED is pre-battle aborted', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const deps = createDeps();
    const handlers = buildNotificationHandlers(deps, { triggerStatPulse });
    const handler = handlers.get('BATTLE_RESOLVED');
    expect(handler).toBeTruthy();

    const event = {
      id: 'battle_abort_1',
      type: 'BATTLE_RESOLVED',
      payload: {
        attackNotificationId: 'attack_declared_1',
        battleType: 'attackUnit',
        result: {
          aborted: true,
          battleEndedEarly: true,
          preBattle: true,
          damageStepExecuted: false,
          attackerDamageTaken: 0,
        },
      },
    };

    await handler?.(event as any, {
      slots: [],
      allowAnimations: true,
      boardSlotPositions: undefined,
      currentRaw: {},
      getRenderSlots: () => [],
    } as any);

    expect(deps.battleAnimator.playBattleResolution).not.toHaveBeenCalled();
    expect(deps.attackIndicator.markAttackResolved).toHaveBeenCalledWith('attack_declared_1');
    expect(deps.attackIndicator.clear).toHaveBeenCalled();
  });
});
