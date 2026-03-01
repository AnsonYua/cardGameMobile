import { describe, expect, test } from "vitest";
import { findLatestUnresolvedChoiceOwner, resolveAutoFollowChoiceOwner } from "./ChoiceOwnerResolver";

describe("ChoiceOwnerResolver", () => {
  test("returns latest unresolved choice owner from notification queue", () => {
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "target_choice_1",
            type: "TARGET_CHOICE",
            payload: {
              event: {
                id: "target_choice_1",
                type: "TARGET_CHOICE",
                playerId: "playerId_1",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
          {
            id: "blocker_choice_1",
            type: "BLOCKER_CHOICE",
            payload: {
              event: {
                id: "blocker_choice_1",
                type: "BLOCKER_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
        ],
      },
    };

    const unresolved = findLatestUnresolvedChoiceOwner(raw);
    expect(unresolved?.eventId).toBe("blocker_choice_1");
    expect(unresolved?.ownerPlayerId).toBe("playerId_2");
    expect(unresolved?.type).toBe("BLOCKER_CHOICE");
  });

  test("ignores completed/resolved/decided entries", () => {
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "option_choice_done",
            type: "OPTION_CHOICE",
            payload: {
              isCompleted: true,
              event: {
                id: "option_choice_done",
                type: "OPTION_CHOICE",
                playerId: "playerId_2",
                status: "RESOLVED",
                data: { userDecisionMade: true },
              },
            },
          },
        ],
      },
    };

    expect(findLatestUnresolvedChoiceOwner(raw)).toBeUndefined();
  });

  test("builds auto-follow decision for opponent-owned unresolved choice", () => {
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "blocker_choice_2",
            type: "BLOCKER_CHOICE",
            payload: {
              event: {
                id: "blocker_choice_2",
                type: "BLOCKER_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
        ],
      },
    };

    const decision = resolveAutoFollowChoiceOwner({
      raw,
      selfPlayerId: "playerId_1",
      attemptedChoiceIds: new Set<string>(),
    });
    expect(decision?.eventId).toBe("blocker_choice_2");
    expect(decision?.ownerPlayerId).toBe("playerId_2");
    expect(decision?.selector).toBe("opponent");
  });

  test("returns no decision after same choice id already attempted", () => {
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "target_choice_3",
            type: "TARGET_CHOICE",
            payload: {
              event: {
                id: "target_choice_3",
                type: "TARGET_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
        ],
      },
    };

    const decision = resolveAutoFollowChoiceOwner({
      raw,
      selfPlayerId: "playerId_1",
      attemptedChoiceIds: new Set<string>(["target_choice_3"]),
    });
    expect(decision).toBeUndefined();
  });

  test("treats missing userDecisionMade as unresolved and follows currentPlayer owner correctly", () => {
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_2",
        notificationQueue: [
          {
            id: "prompt_choice_1",
            type: "PROMPT_CHOICE",
            payload: {
              event: {
                id: "prompt_choice_1",
                type: "PROMPT_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: {},
              },
            },
          },
        ],
      },
    };

    const unresolved = findLatestUnresolvedChoiceOwner(raw);
    expect(unresolved?.eventId).toBe("prompt_choice_1");
    expect(unresolved?.ownerPlayerId).toBe("playerId_2");

    const decision = resolveAutoFollowChoiceOwner({
      raw,
      selfPlayerId: "playerId_1",
      attemptedChoiceIds: new Set<string>(),
    });
    expect(decision?.selector).toBe("currentPlayer");
  });
});
