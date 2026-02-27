import { describe, expect, it } from "vitest";
import { SlotAnimationRenderController } from "../src/phaser/animations/SlotAnimationRenderController";

function createSlot(owner: "player" | "opponent", slotId: string, cardUid: string) {
  return {
    owner,
    slotId,
    unit: {
      id: cardUid.split("_")[0] ?? cardUid,
      cardUid,
      cardType: "unit",
      isRested: false,
      cardData: { id: cardUid.split("_")[0] ?? cardUid, cardType: "unit", ap: 1, hp: 1 },
    },
    isRested: false,
    ap: 1,
    hp: 1,
    fieldCardValue: { totalAP: 1, totalHP: 1 },
  };
}

describe("SlotAnimationRenderController token deploy ordering", () => {
  it("hides token destination until TOKEN_DEPLOYED event ends", () => {
    const previousSlots: any[] = [createSlot("opponent", "slot1", "ATK_uid_1"), createSlot("player", "slot1", "DEF_uid_1")];
    const currentSlots: any[] = [
      createSlot("player", "slot2", "T-006_uid_1"), // already in latest snapshot, should be held until TOKEN_DEPLOYED
    ];
    const events: any[] = [
      {
        id: "battle_1",
        type: "BATTLE_RESOLVED",
        payload: {
          attackingPlayerId: "p2",
          defendingPlayerId: "p1",
          attacker: {
            playerId: "p2",
            slot: "slot1",
            unit: { carduid: "ATK_uid_1", cardId: "ATK", cardData: { id: "ATK", cardType: "unit", ap: 1, hp: 1 } },
            fieldCardValue: { totalAP: 1, totalHP: 1 },
          },
          target: {
            playerId: "p1",
            slot: "slot1",
            unit: { carduid: "DEF_uid_1", cardId: "DEF", cardData: { id: "DEF", cardType: "unit", ap: 1, hp: 1 } },
            fieldCardValue: { totalAP: 1, totalHP: 1 },
          },
        },
      },
      {
        id: "token_1",
        type: "TOKEN_DEPLOYED",
        payload: {
          playerId: "p1",
          toZone: "slot2",
          carduid: "T-006_uid_1",
        },
      },
    ];

    const render = new SlotAnimationRenderController((raw: any) => raw?.slots ?? []);
    const resolveSlotOwnerByPlayer = (playerId?: string) => {
      if (playerId === "p1") return "player";
      if (playerId === "p2") return "opponent";
      return undefined;
    };

    const initial = render.startBatch(events, previousSlots, currentSlots, resolveSlotOwnerByPlayer);
    expect(initial.some((slot) => slot.owner === "player" && slot.slotId === "slot2")).toBe(false);
    expect(initial.some((slot) => slot.owner === "player" && slot.slotId === "slot1")).toBe(true);
    expect(initial.some((slot) => slot.owner === "opponent" && slot.slotId === "slot1")).toBe(true);

    const afterBattle = render.handleEventEnd(
      { id: "battle_1", type: "BATTLE_RESOLVED", payload: {} } as any,
      { currentRaw: { slots: currentSlots } } as any,
    );
    expect(afterBattle?.some((slot) => slot.owner === "player" && slot.slotId === "slot2")).toBe(false);

    const afterToken = render.handleEventEnd(
      { id: "token_1", type: "TOKEN_DEPLOYED", payload: {} } as any,
      { currentRaw: { slots: currentSlots } } as any,
    );
    expect(afterToken?.some((slot) => slot.owner === "player" && slot.slotId === "slot2")).toBe(true);
  });

  it("still sequences non-battle token deploys via TOKEN_DEPLOYED end", () => {
    const previousSlots: any[] = [];
    const currentSlots: any[] = [createSlot("player", "slot3", "T-100_uid_1")];
    const events: any[] = [
      {
        id: "token_2",
        type: "TOKEN_DEPLOYED",
        payload: { playerId: "p1", toZone: "slot3", carduid: "T-100_uid_1" },
      },
    ];

    const render = new SlotAnimationRenderController((raw: any) => raw?.slots ?? []);
    const resolveSlotOwnerByPlayer = (playerId?: string) => (playerId === "p1" ? "player" : undefined);

    const initial = render.startBatch(events, previousSlots, currentSlots, resolveSlotOwnerByPlayer);
    expect(initial.some((slot) => slot.owner === "player" && slot.slotId === "slot3")).toBe(false);

    const afterToken = render.handleEventEnd(
      { id: "token_2", type: "TOKEN_DEPLOYED", payload: {} } as any,
      { currentRaw: { slots: currentSlots } } as any,
    );
    expect(afterToken?.some((slot) => slot.owner === "player" && slot.slotId === "slot3")).toBe(true);
  });
});
