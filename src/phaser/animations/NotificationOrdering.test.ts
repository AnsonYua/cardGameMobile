import { describe, expect, test } from "vitest";
import { orderNotificationsForAnimation } from "./NotificationOrdering";

describe("NotificationOrdering", () => {
  test("preserves backend queue order without reordering", () => {
    const input = [
      { id: "card-played-1", type: "CARD_PLAYED" },
      { id: "battle-resolved-1", type: "BATTLE_RESOLVED" },
      { id: "target-choice-1", type: "TARGET_CHOICE" },
    ] as any;

    const output = orderNotificationsForAnimation(input);

    expect(output).toEqual(input);
    expect(output).not.toBe(input);
    expect(output.map((event: any) => event.id)).toEqual([
      "card-played-1",
      "battle-resolved-1",
      "target-choice-1",
    ]);
  });
});
