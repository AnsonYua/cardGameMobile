import { describe, expect, test } from "vitest";
import { findFirstBlockingChoiceIndex, sliceEventsForBlockingChoice } from "./ChoiceNotificationWindow";

function note(id: string, type: string, payload: Record<string, any> = {}) {
  return { id, type, payload };
}

function unresolvedChoice(id: string, type: string, playerId: string, overrides: Record<string, any> = {}) {
  return note(id, type, {
    event: {
      id,
      type,
      playerId,
      status: "DECLARED",
      data: {
        userDecisionMade: false,
        ...((overrides.event?.data as Record<string, any> | undefined) ?? {}),
      },
      ...overrides.event,
    },
    ...overrides.payload,
  });
}

describe("ChoiceNotificationWindow", () => {
  test("keeps battle predecessors before unresolved self target choice", () => {
    const events = [
      note("attack-1", "UNIT_ATTACK_DECLARED"),
      note("battle-1", "BATTLE_RESOLVED"),
      unresolvedChoice("choice-1", "TARGET_CHOICE", "playerId_1"),
      note("hand-1", "CARD_ADDED_TO_HAND"),
    ] as any;

    expect(findFirstBlockingChoiceIndex(events, "playerId_1")).toBe(2);
    expect(sliceEventsForBlockingChoice(events, "playerId_1").map((event: any) => event.type)).toEqual([
      "UNIT_ATTACK_DECLARED",
      "BATTLE_RESOLVED",
      "TARGET_CHOICE",
    ]);
  });

  test("keeps deploy flow predecessor before unresolved self target choice", () => {
    const events = [
      note("play-1", "CARD_PLAYED"),
      unresolvedChoice("choice-1", "TARGET_CHOICE", "playerId_1"),
    ] as any;

    expect(sliceEventsForBlockingChoice(events, "playerId_1").map((event: any) => event.type)).toEqual([
      "CARD_PLAYED",
      "TARGET_CHOICE",
    ]);
  });

  test("returns all events when there is no unresolved blocking choice", () => {
    const events = [
      note("attack-1", "UNIT_ATTACK_DECLARED"),
      note("battle-1", "BATTLE_RESOLVED"),
      note("hand-1", "CARD_ADDED_TO_HAND"),
    ] as any;

    expect(findFirstBlockingChoiceIndex(events, "playerId_1")).toBe(-1);
    expect(sliceEventsForBlockingChoice(events, "playerId_1")).toEqual(events);
  });

  test("ignores resolved and completed choices", () => {
    const resolved = note("choice-resolved", "TARGET_CHOICE", {
      event: {
        id: "choice-resolved",
        type: "TARGET_CHOICE",
        playerId: "playerId_1",
        status: "RESOLVED",
        data: { userDecisionMade: true },
      },
    });
    const completed = unresolvedChoice("choice-completed", "TARGET_CHOICE", "playerId_1", {
      payload: { isCompleted: true },
    });

    expect(findFirstBlockingChoiceIndex([resolved] as any, "playerId_1")).toBe(-1);
    expect(findFirstBlockingChoiceIndex([completed] as any, "playerId_1")).toBe(-1);
  });

  test("does not block on opponent-owned unresolved choice for local player", () => {
    const events = [
      note("battle-1", "BATTLE_RESOLVED"),
      unresolvedChoice("choice-1", "TARGET_CHOICE", "playerId_2"),
      note("hand-1", "CARD_ADDED_TO_HAND"),
    ] as any;

    expect(findFirstBlockingChoiceIndex(events, "playerId_1")).toBe(-1);
    expect(sliceEventsForBlockingChoice(events, "playerId_1")).toEqual(events);
  });

  test("blocker choice still blocks later events without reordering predecessors", () => {
    const events = [
      note("attack-1", "UNIT_ATTACK_DECLARED"),
      unresolvedChoice("blocker-1", "BLOCKER_CHOICE", "playerId_1"),
      note("battle-1", "BATTLE_RESOLVED"),
    ] as any;

    expect(findFirstBlockingChoiceIndex(events, "playerId_1")).toBe(1);
    expect(sliceEventsForBlockingChoice(events, "playerId_1").map((event: any) => event.type)).toEqual([
      "UNIT_ATTACK_DECLARED",
      "BLOCKER_CHOICE",
    ]);
  });

  test("keeps the first unresolved self choice as the blocking boundary across refresh events", () => {
    const events = [
      note("attack-1", "UNIT_ATTACK_DECLARED"),
      unresolvedChoice("choice-1", "TARGET_CHOICE", "playerId_1"),
      note("refresh-1", "GAME_ENV_REFRESH"),
      unresolvedChoice("choice-2", "TARGET_CHOICE", "playerId_1"),
      note("battle-1", "BATTLE_RESOLVED"),
    ] as any;

    expect(findFirstBlockingChoiceIndex(events, "playerId_1")).toBe(1);
    expect(sliceEventsForBlockingChoice(events, "playerId_1").map((event: any) => event.type)).toEqual([
      "UNIT_ATTACK_DECLARED",
      "TARGET_CHOICE",
    ]);

    const afterFirstChoiceResolved = events.slice(2);
    expect(findFirstBlockingChoiceIndex(afterFirstChoiceResolved, "playerId_1")).toBe(1);
    expect(
      sliceEventsForBlockingChoice(afterFirstChoiceResolved, "playerId_1").map((event: any) => event.type),
    ).toEqual(["GAME_ENV_REFRESH", "TARGET_CHOICE"]);
  });
});
