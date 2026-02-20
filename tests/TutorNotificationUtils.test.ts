import { describe, expect, it } from "vitest";
import { hasActiveTutorRevealPrompt } from "../src/phaser/utils/TutorNotificationUtils";

describe("hasActiveTutorRevealPrompt", () => {
  it("returns true for unresolved tutor reveal confirm prompt", () => {
    const queue = [
      {
        type: "PROMPT_CHOICE",
        payload: {
          event: {
            status: "DECLARED",
            data: {
              playerId: "p1",
              choiceId: "tutor_top_deck_reveal_confirm",
              userDecisionMade: false,
              context: {
                kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM",
                tutor: {
                  sourceCarduid: "ST03-006_uid",
                  effect: { effectId: "destroyed_tutor_zeon_unit_from_top_3" },
                },
              },
            },
          },
          isCompleted: false,
        },
      },
    ];

    expect(
      hasActiveTutorRevealPrompt(queue as any, {
        playerId: "p1",
        sourceCarduid: "ST03-006_uid",
        effectId: "destroyed_tutor_zeon_unit_from_top_3",
      }),
    ).toBe(true);
  });

  it("returns false for resolved prompt", () => {
    const queue = [
      {
        type: "PROMPT_CHOICE",
        payload: {
          event: {
            status: "RESOLVED",
            data: {
              choiceId: "tutor_top_deck_reveal_confirm",
              userDecisionMade: true,
            },
          },
          isCompleted: true,
        },
      },
    ];

    expect(hasActiveTutorRevealPrompt(queue as any)).toBe(false);
  });
});
