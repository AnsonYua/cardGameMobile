import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlotNotification } from "../src/phaser/animations/NotificationAnimationController";
import type { SlotPositionMap, SlotViewModel } from "../src/phaser/ui/SlotTypes";

const showSpy = vi.fn(async () => undefined);
const hideSpy = vi.fn();

vi.mock("../src/phaser/animations/AttackIndicator", () => {
  class MockAttackIndicator {
    show = showSpy;
    hide = hideSpy;
  }
  return { AttackIndicator: MockAttackIndicator };
});

import { AttackIndicatorController } from "../src/phaser/controllers/AttackIndicatorController";

function buildController() {
  return new AttackIndicatorController({
    scene: {} as any,
    anchorsProvider: () => ({
      getShieldAnchor: (isOpponent: boolean) => (isOpponent ? { x: 700, y: 140 } : { x: 100, y: 460 }),
      getBaseAnchor: (isOpponent: boolean) => (isOpponent ? { x: 700, y: 80 } : { x: 100, y: 520 }),
    }),
    resolveSlotOwnerByPlayer: (playerId?: string) => {
      if (playerId === "p1") return "player";
      if (playerId === "p2") return "opponent";
      return undefined;
    },
  });
}

function buildSlots(): SlotViewModel[] {
  return [
    {
      owner: "player",
      slotId: "slot1",
      unit: { cardUid: "attacker_uid", cardId: "A", name: "Attacker", rested: false, canAttack: true, ap: 1, hp: 1 },
    } as any,
    {
      owner: "opponent",
      slotId: "slot2",
      unit: { cardUid: "blocker_uid", cardId: "B", name: "Blocker", rested: false, canAttack: true, ap: 1, hp: 1 },
    } as any,
  ];
}

function buildPositions(): SlotPositionMap {
  return {
    player: {
      slot1: { x: 180, y: 420, width: 80, height: 100 },
    },
    opponent: {
      slot2: { x: 620, y: 180, width: 80, height: 100 },
    },
  } as any;
}

function note(id: string, type: string, payload: Record<string, any>): SlotNotification {
  return { id, type, payload } as any;
}

describe("AttackIndicatorController", () => {
  beforeEach(() => {
    vi.useRealTimers();
    showSpy.mockClear();
    hideSpy.mockClear();
  });

  it("does not redraw for same semantic attack+target across different notification ids", async () => {
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });
    const refreshSameTarget = note("refresh_1", "REFRESH_TARGET", {
      sourceNotificationId: "attack_1",
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    await controller.updateFromNotification(refreshSameTarget, slots, positions);

    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("redraws when redirect target changes", async () => {
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });
    const refreshRedirect = note("refresh_1", "REFRESH_TARGET", {
      sourceNotificationId: "attack_1",
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      forcedTargetCarduid: "blocker_uid",
      forcedTargetZone: "slot2",
      forcedTargetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    await controller.updateFromNotification(refreshRedirect, slots, positions);

    expect(showSpy).toHaveBeenCalledTimes(2);
  });

  it("debounces hide when event is temporarily missing", async () => {
    vi.useFakeTimers();
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    await controller.updateFromNotification(undefined, slots, positions);
    await vi.advanceTimersByTimeAsync(100);
    await controller.updateFromNotification(attack, slots, positions);
    await vi.advanceTimersByTimeAsync(80);

    expect(hideSpy).toHaveBeenCalledTimes(0);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("hides after debounce if missing event persists", async () => {
    vi.useFakeTimers();
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    await controller.updateFromNotification(undefined, slots, positions);
    await vi.advanceTimersByTimeAsync(170);

    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("clears immediately on explicit clear", async () => {
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    controller.clear();

    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("does not redraw when identical updates overlap before first show completes", async () => {
    let resolveShow: (() => void) | undefined;
    showSpy.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveShow = resolve;
        }),
    );
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    const p1 = controller.updateFromNotification(attack, slots, positions);
    const p2 = controller.updateFromNotification(attack, slots, positions);
    resolveShow?.();
    await Promise.all([p1, p2]);

    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("suppresses redraw for resolved attack key within suppression window", async () => {
    vi.useFakeTimers();
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack, slots, positions);
    controller.markAttackResolved("attack_1");
    expect(hideSpy).toHaveBeenCalledTimes(0);
    await controller.updateFromNotification(attack, slots, positions);

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(hideSpy).toHaveBeenCalledTimes(0);
  });

  it("allows redraw for different attack key even when suppression is active", async () => {
    vi.useFakeTimers();
    const controller = buildController();
    const slots = buildSlots();
    const positions = buildPositions();

    const attack1 = note("attack_1", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });
    const attack2 = note("attack_2", "UNIT_ATTACK_DECLARED", {
      attackerCarduid: "attacker_uid_2",
      attackerSlot: "slot1",
      attackingPlayerId: "p1",
      defendingPlayerId: "p2",
      targetSlotName: "shieldArea",
      targetPlayerId: "p2",
    });

    await controller.updateFromNotification(attack1, slots, positions);
    controller.markAttackResolved("attack_1");
    await controller.updateFromNotification(attack2, slots, positions);

    expect(showSpy).toHaveBeenCalledTimes(2);
  });
});
