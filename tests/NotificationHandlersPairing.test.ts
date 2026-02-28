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
    targetNoticeDialog: {
      showNotice: vi.fn(async () => undefined),
    },
    slotControls: {
      flashTargetedSlot: vi.fn(async () => undefined),
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

  it('shows opponent-facing lock notice and flashes targeted slots for PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const deps = createDeps();
    const handlers = buildNotificationHandlers(deps, { triggerStatPulse });
    const handler = handlers.get('PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED');
    expect(handler).toBeTruthy();

    await handler?.(
      {
        id: 'lock_1',
        type: 'PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED',
        payload: {
          playerId: 'playerId_1',
          targets: [
            { carduid: 'enemy_slot2_uid', zone: 'slot2', playerId: 'playerId_2' },
          ],
        },
      } as any,
      {
        currentPlayerId: 'playerId_2',
        resolveSlotOwnerByPlayer: (playerId?: string) => (playerId === 'playerId_2' ? 'player' : 'opponent'),
        currentRaw: {
          gameEnv: {
            players: {
              playerId_2: {
                zones: {
                  slot2: {
                    unit: { carduid: 'enemy_slot2_uid', cardData: { name: 'Marasai' } },
                  },
                },
              },
            },
          },
        },
      } as any,
    );

    expect(deps.targetNoticeDialog.showNotice).toHaveBeenCalledTimes(1);
    expect(deps.slotControls.flashTargetedSlot).toHaveBeenCalledWith('player-slot2', {
      color: 0xffd166,
      durationMs: 1200,
    });
    const noticeArg = deps.targetNoticeDialog.showNotice.mock.calls[0]?.[0];
    expect(noticeArg?.message).toContain('Slot 2');
    expect(noticeArg?.message).toContain('Marasai');
    expect(noticeArg?.message).toContain("cannot be set active during your next Start Phase");
  });

  it('does not show lock notice when no local targets are affected', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const deps = createDeps();
    const handlers = buildNotificationHandlers(deps, { triggerStatPulse });
    const handler = handlers.get('PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED');
    expect(handler).toBeTruthy();

    await handler?.(
      {
        id: 'lock_2',
        type: 'PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED',
        payload: {
          playerId: 'playerId_1',
          targets: [{ carduid: 'other_uid', zone: 'slot1', playerId: 'playerId_3' }],
        },
      } as any,
      {
        currentPlayerId: 'playerId_2',
        resolveSlotOwnerByPlayer: () => 'opponent',
        currentRaw: { gameEnv: { players: {} } },
      } as any,
    );

    expect(deps.targetNoticeDialog.showNotice).not.toHaveBeenCalled();
    expect(deps.slotControls.flashTargetedSlot).not.toHaveBeenCalled();
  });

  it('renders multi-target notice once and deduplicates flashed slot keys', async () => {
    const triggerStatPulse = vi.fn(async () => undefined);
    const deps = createDeps();
    const handlers = buildNotificationHandlers(deps, { triggerStatPulse });
    const handler = handlers.get('PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED');
    expect(handler).toBeTruthy();

    await handler?.(
      {
        id: 'lock_3',
        type: 'PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED',
        payload: {
          playerId: 'playerId_1',
          targets: [
            { carduid: 'uid_a', zone: 'slot2', playerId: 'playerId_2' },
            { carduid: 'uid_a', zone: 'slot2', playerId: 'playerId_2' },
            { carduid: 'uid_b', zone: 'slot3', playerId: 'playerId_2' },
          ],
        },
      } as any,
      {
        currentPlayerId: 'playerId_2',
        resolveSlotOwnerByPlayer: (playerId?: string) => (playerId === 'playerId_2' ? 'player' : 'opponent'),
        currentRaw: {
          gameEnv: {
            players: {
              playerId_2: {
                zones: {
                  slot2: { unit: { carduid: 'uid_a', cardData: { name: 'Target A' } } },
                  slot3: { unit: { carduid: 'uid_b', cardData: { name: 'Target B' } } },
                },
              },
            },
          },
        },
      } as any,
    );

    expect(deps.targetNoticeDialog.showNotice).toHaveBeenCalledTimes(1);
    expect(deps.slotControls.flashTargetedSlot).toHaveBeenCalledTimes(2);
    const flashedKeys = deps.slotControls.flashTargetedSlot.mock.calls.map((args: any[]) => args[0]);
    expect(flashedKeys).toEqual(['player-slot2', 'player-slot3']);
    const noticeArg = deps.targetNoticeDialog.showNotice.mock.calls[0]?.[0];
    expect(noticeArg?.message).toContain('Targeted slot(s):');
    expect(noticeArg?.message).toContain('Slot 2');
    expect(noticeArg?.message).toContain('Slot 3');
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
