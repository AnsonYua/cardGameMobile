import { describe, expect, it } from 'vitest';
import { findActiveChoiceEntryFromRaw } from '../src/phaser/controllers/choice/ChoiceFlowUtils';

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
});
