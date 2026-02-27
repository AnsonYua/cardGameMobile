import { describe, expect, it } from "vitest";
import {
  findLiveAttackIndicatorNotification,
  getActiveAttackTargetSlotKey,
  resolveAttackContextForIndicator,
  resolveRefreshTargetAttackNotificationId,
} from "../src/phaser/utils/NotificationUtils";

function note(id: string, type: string, payload: Record<string, any> = {}) {
  return { id, type, payload };
}

describe("NotificationUtils attack indicator selection", () => {
  it("prefers latest REFRESH_TARGET for unresolved redirect", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackerCarduid: "attacker_uid",
        targetSlotName: "shieldArea",
      }),
      note("refresh_1", "REFRESH_TARGET", {
        sourceNotificationId: "attack_1",
        forcedTargetCarduid: "blocker_uid",
        forcedTargetZone: "slot1",
        forcedTargetPlayerId: "p2",
      }),
    ];

    const active = findLiveAttackIndicatorNotification(notifications as any);
    expect(active?.type).toBe("REFRESH_TARGET");
    expect(active?.payload?.forcedTargetZone).toBe("slot1");
  });

  it("returns undefined when redirect source battle is resolved", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackerCarduid: "attacker_uid",
        targetSlotName: "shieldArea",
      }),
      note("refresh_1", "REFRESH_TARGET", {
        sourceNotificationId: "attack_1",
        forcedTargetCarduid: "blocker_uid",
        forcedTargetZone: "slot1",
        forcedTargetPlayerId: "p2",
      }),
      note("resolved_1", "BATTLE_RESOLVED", {
        attackNotificationId: "attack_1",
      }),
    ];

    const active = findLiveAttackIndicatorNotification(notifications as any);
    expect(active).toBeUndefined();
  });

  it("returns undefined for blocker-linked REFRESH_TARGET when original attack is resolved", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackerCarduid: "attacker_uid",
        targetSlotName: "shieldArea",
      }),
      note("blocker_1", "BLOCKER_CHOICE", {
        event: {
          data: {
            originalAttackEvent: {
              data: {
                attackNotificationId: "attack_1",
              },
            },
          },
        },
      }),
      note("refresh_1", "REFRESH_TARGET", {
        sourceNotificationId: "blocker_1",
        forcedTargetCarduid: "blocker_uid",
        forcedTargetZone: "slot1",
        forcedTargetPlayerId: "p2",
      }),
      note("resolved_1", "BATTLE_RESOLVED", {
        attackNotificationId: "attack_1",
      }),
    ];

    const active = findLiveAttackIndicatorNotification(notifications as any);
    expect(active).toBeUndefined();
  });

  it("falls back to UNIT_ATTACK_DECLARED when unresolved and no redirect", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackerCarduid: "attacker_uid",
        targetSlotName: "shieldArea",
      }),
    ];

    const active = findLiveAttackIndicatorNotification(notifications as any);
    expect(active?.id).toBe("attack_1");
    expect(active?.type).toBe("UNIT_ATTACK_DECLARED");
  });

  it("suppresses UNIT_ATTACK_DECLARED when battleEnd is true", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackerCarduid: "attacker_uid",
        targetSlotName: "shieldArea",
        battleEnd: true,
      }),
    ];

    const active = findLiveAttackIndicatorNotification(notifications as any);
    expect(active).toBeUndefined();
  });

  it("resolves target slot key from REFRESH_TARGET payload", () => {
    const slotKey = getActiveAttackTargetSlotKey(
      note("refresh_1", "REFRESH_TARGET", {
        forcedTargetZone: "slot4",
        forcedTargetPlayerId: "p2",
      }) as any,
      (playerId?: string) => (playerId === "p2" ? "opponent" : "player"),
    );

    expect(slotKey).toBe("opponent-slot4");
  });

  it("resolves REFRESH_TARGET source via blocker choice original attack notification id", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackingPlayerId: "p2",
        defendingPlayerId: "p1",
        attackerCarduid: "attacker_uid",
        attackerSlot: "slot2",
      }),
      note("blocker_1", "BLOCKER_CHOICE", {
        event: {
          data: {
            originalAttackEvent: {
              data: {
                attackNotificationId: "attack_1",
              },
            },
          },
        },
      }),
      note("refresh_1", "REFRESH_TARGET", {
        sourceNotificationId: "blocker_1",
        forcedTargetCarduid: "blocker_uid",
        forcedTargetZone: "slot1",
        forcedTargetPlayerId: "p1",
      }),
    ];

    const resolvedAttackId = resolveRefreshTargetAttackNotificationId(notifications[2] as any, notifications as any);
    expect(resolvedAttackId).toBe("attack_1");
  });

  it("hydrates attacker context from currentBattle when refresh payload lacks attacker fields", () => {
    const notifications = [
      note("attack_1", "UNIT_ATTACK_DECLARED", {
        attackingPlayerId: "p2",
        defendingPlayerId: "p1",
        attackerCarduid: "attacker_uid",
      }),
      note("blocker_1", "BLOCKER_CHOICE", {
        event: {
          data: {
            originalAttackEvent: {
              data: {
                attackNotificationId: "attack_1",
              },
            },
          },
        },
      }),
      note("refresh_1", "REFRESH_TARGET", {
        sourceNotificationId: "blocker_1",
        forcedTargetCarduid: "blocker_uid",
        forcedTargetZone: "slot1",
        forcedTargetPlayerId: "p1",
      }),
    ];
    const raw = {
      gameEnv: {
        currentBattle: {
          attackingPlayerId: "p2",
          defendingPlayerId: "p1",
          attackerCarduid: "attacker_uid",
        },
        players: {
          p2: {
            zones: {
              slot2: {
                unit: { carduid: "attacker_uid" },
              },
            },
          },
        },
      },
    };

    const context = resolveAttackContextForIndicator(raw, notifications[2] as any, notifications as any);
    expect(context.attackingPlayerId).toBe("p2");
    expect(context.defendingPlayerId).toBe("p1");
    expect(context.attackerCarduid).toBe("attacker_uid");
    expect(context.attackerSlot).toBe("slot2");
  });
});
