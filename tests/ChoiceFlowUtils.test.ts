import { describe, expect, it } from 'vitest';
import { findActiveBlockerChoiceFromRaw, findActiveChoiceEntryFromRaw } from '../src/phaser/controllers/choice/ChoiceFlowUtils';

describe('ChoiceFlowUtils.findActiveChoiceEntryFromRaw', () => {
  it('returns active choice from notificationQueue', () => {
    const raw = {
      gameEnv: {
        notificationQueue: [
          {
            id: 'target_choice_1',
            type: 'TARGET_CHOICE',
            payload: {
              event: {
                id: 'target_choice_1',
                type: 'TARGET_CHOICE',
                status: 'DECLARED',
                playerId: 'playerId_2',
                data: { userDecisionMade: false },
              },
              isCompleted: false,
            },
            metadata: {
              expiresAt: Number.MAX_SAFE_INTEGER,
            },
          },
        ],
      },
    };

    const entry = findActiveChoiceEntryFromRaw(raw, 'TARGET_CHOICE');
    expect(entry?.id).toBe('target_choice_1');
    expect(entry?.playerId).toBe('playerId_2');
  });

  it('ignores processingQueue and returns undefined when notificationQueue has no active choice', () => {
    const raw = {
      gameEnv: {
        processingQueue: [
          {
            id: 'target_choice_from_processing',
            type: 'TARGET_CHOICE',
            status: 'DECLARED',
            playerId: 'playerId_2',
            data: { userDecisionMade: false },
          },
        ],
        notificationQueue: [],
      },
    };

    const entry = findActiveChoiceEntryFromRaw(raw, 'TARGET_CHOICE');
    expect(entry).toBeUndefined();
  });


  it('returns active blocker choice notification for unresolved blocker owned by current player', () => {
    const raw = {
      gameEnv: {
        notificationQueue: [
          {
            id: 'blocker_choice_1',
            type: 'BLOCKER_CHOICE',
            payload: {
              event: {
                id: 'blocker_choice_1',
                type: 'BLOCKER_CHOICE',
                status: 'DECLARED',
                playerId: 'playerId_1',
                data: { userDecisionMade: false },
              },
            },
            metadata: {
              expiresAt: Number.MAX_SAFE_INTEGER,
            },
          },
        ],
      },
    };

    const blocker = findActiveBlockerChoiceFromRaw(raw);
    expect(blocker?.event?.id).toBe('blocker_choice_1');
    expect(blocker?.event?.playerId).toBe('playerId_1');
    expect(blocker?.notificationId).toBe('blocker_choice_1');
  });

});
