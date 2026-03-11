import { describe, expect, test } from 'vitest';
import { commandHasTimingWindow } from './actionEligibility';

function createHandSelection(uid: string) {
  return {
    kind: 'hand' as const,
    uid,
  };
}

function createRawForCommand(rule: any) {
  return {
    gameEnv: {
      players: {
        player_1: {
          deck: {
            hand: [
              {
                carduid: 'command_uid_0001',
                cardData: {
                  cardType: 'command',
                  effects: {
                    rules: [rule],
                  },
                },
              },
            ],
          },
        },
      },
    },
  };
}

describe('commandHasTimingWindow', () => {
  test('does not offer ACTION_STEP-only command effects during MAIN_PHASE', () => {
    const raw = createRawForCommand({
      type: 'play',
      timing: {
        activationWindows: ['ACTION_STEP'],
      },
    });

    expect(
      commandHasTimingWindow(
        createHandSelection('command_uid_0001'),
        raw,
        'player_1',
        'MAIN_PHASE',
      ),
    ).toBe(false);
    expect(
      commandHasTimingWindow(
        createHandSelection('command_uid_0001'),
        raw,
        'player_1',
        'ACTION_STEP_PHASE',
      ),
    ).toBe(true);
  });

  test('falls back to MAIN_PHASE when command timing windows are missing', () => {
    const raw = createRawForCommand({
      type: 'play',
      timing: {},
    });

    expect(
      commandHasTimingWindow(
        createHandSelection('command_uid_0001'),
        raw,
        'player_1',
        'MAIN_PHASE',
      ),
    ).toBe(true);
    expect(
      commandHasTimingWindow(
        createHandSelection('command_uid_0001'),
        raw,
        'player_1',
        'ACTION_STEP_PHASE',
      ),
    ).toBe(false);
  });
});
