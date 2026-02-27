import Phaser from "phaser";
import { AttackIndicator, type AttackIndicatorStyle } from "../animations/AttackIndicator";
import type { SlotViewModel, SlotPositionMap, SlotOwner } from "../ui/SlotTypes";
import type { SlotNotification } from "../animations/NotificationAnimationController";
import {
  resolveAttackTargetPoint,
  findSlotForAttack,
  getSlotCenterFromMap,
  type TargetAnchorProviders,
} from "../utils/AttackResolver";

type AttackIndicatorControllerConfig = {
  scene: Phaser.Scene;
  anchorsProvider: () => TargetAnchorProviders;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
};

export class AttackIndicatorController {
  private indicator: AttackIndicator;
  private activeAttackKey?: string;
  private activeAttackTargetKey?: string;
  private requestedAttackKey?: string;
  private requestedAttackTargetKey?: string;
  private suppressedAttackKey?: string;
  private suppressedUntilMs = 0;
  private pendingHideTimer?: ReturnType<typeof setTimeout>;
  private readonly hideDebounceMs = 150;
  private readonly suppressionWindowMs = 800;

  constructor(private config: AttackIndicatorControllerConfig) {
    this.indicator = new AttackIndicator(config.scene);
  }

  async updateFromNotification(
    event: SlotNotification | undefined,
    slots: SlotViewModel[],
    positions?: SlotPositionMap | null,
  ): Promise<void> {
    if (!event) {
      this.scheduleHide("missing_event");
      return;
    }
    if (!positions) {
      this.scheduleHide("missing_positions");
      return;
    }
    const payload = event.payload || {};
    const attackKey = this.buildAttackKey(event, payload);
    const targetKey = this.buildAttackTargetKey(payload);
    this.cancelScheduledHide();
    const now = Date.now();
    const isSuppressed = !!this.suppressedAttackKey && this.suppressedAttackKey === attackKey && now < this.suppressedUntilMs;
    if (this.suppressedAttackKey && this.suppressedAttackKey !== attackKey) {
      this.suppressedAttackKey = undefined;
      this.suppressedUntilMs = 0;
    }
    if (isSuppressed) {
      console.warn("[AttackIndicatorController] suppressed redraw", {
        eventType: (event.type ?? "").toString().toUpperCase(),
        eventId: event.id,
        attackKey,
        targetKey,
        suppressedAttackKey: this.suppressedAttackKey,
      });
      return;
    }
    const skipRedraw =
      (this.activeAttackKey === attackKey && this.activeAttackTargetKey === targetKey) ||
      (this.requestedAttackKey === attackKey && this.requestedAttackTargetKey === targetKey);
    console.warn("[AttackIndicatorController] update", {
      eventType: (event.type ?? "").toString().toUpperCase(),
      eventId: event.id,
      attackKey,
      targetKey,
      skipRedraw,
    });
    if (skipRedraw) {
      return;
    }

    const attackerOwner = this.config.resolveSlotOwnerByPlayer(payload.attackingPlayerId);
    const defenderOwner =
      this.config.resolveSlotOwnerByPlayer(payload.defendingPlayerId) || (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attackerSlot || payload.attackerSlotName;
    const attackerSlotVm = findSlotForAttack(slots, payload.attackerCarduid, attackerOwner, attackerSlotId);
    const attackerCenter = getSlotCenterFromMap(positions, attackerSlotVm, attackerOwner, attackerSlotId);
    const targetPoint = resolveAttackTargetPoint(payload, slots, positions, defenderOwner, {
      resolveSlotOwnerByPlayer: this.config.resolveSlotOwnerByPlayer,
      anchors: this.config.anchorsProvider(),
    });
    if (!attackerCenter || !targetPoint) {
      this.scheduleHide("missing_points");
      return;
    }
    const attackStyle: AttackIndicatorStyle = attackerOwner ?? "player";
    this.requestedAttackKey = attackKey;
    this.requestedAttackTargetKey = targetKey;
    await this.indicator.show({ from: attackerCenter, to: targetPoint, style: attackStyle });
    this.activeAttackKey = attackKey;
    this.activeAttackTargetKey = targetKey;
    this.requestedAttackKey = attackKey;
    this.requestedAttackTargetKey = targetKey;
  }

  clear() {
    this.cancelScheduledHide();
    this.hideIndicator();
  }

  markAttackResolved(attackRef?: string) {
    if (!attackRef) return;
    this.suppressedAttackKey = String(attackRef);
    this.suppressedUntilMs = Date.now() + this.suppressionWindowMs;
    console.warn("[AttackIndicatorController] mark attack resolved", {
      suppressedAttackKey: this.suppressedAttackKey,
      suppressedUntilMs: this.suppressedUntilMs,
    });
  }

  getSuppressedAttackKey() {
    const now = Date.now();
    if (this.suppressedAttackKey && now < this.suppressedUntilMs) {
      return this.suppressedAttackKey;
    }
    return undefined;
  }

  private hideIndicator() {
    if (!this.activeAttackKey && !this.requestedAttackKey) return;
    this.indicator.hide({ fadeDuration: 180 });
    this.activeAttackKey = undefined;
    this.activeAttackTargetKey = undefined;
    this.requestedAttackKey = undefined;
    this.requestedAttackTargetKey = undefined;
  }

  private scheduleHide(reason: string) {
    if (!this.activeAttackKey && !this.requestedAttackKey) return;
    if (this.pendingHideTimer) return;
    console.warn("[AttackIndicatorController] schedule hide", {
      reason,
      scheduledHide: true,
      delayMs: this.hideDebounceMs,
    });
    this.pendingHideTimer = setTimeout(() => {
      this.pendingHideTimer = undefined;
      this.hideIndicator();
    }, this.hideDebounceMs);
  }

  private cancelScheduledHide() {
    if (!this.pendingHideTimer) return;
    clearTimeout(this.pendingHideTimer);
    this.pendingHideTimer = undefined;
    console.warn("[AttackIndicatorController] cancel scheduled hide", { hideCanceled: true });
  }

  private buildAttackKey(event: SlotNotification, payload: any) {
    const attackRef =
      payload.sourceNotificationId ??
      payload.attackNotificationId ??
      payload.notificationId ??
      event.id ??
      "";
    if (attackRef) return String(attackRef);
    const attacker = payload.attackerCarduid ?? payload.attackerUnitUid ?? "";
    const slot = payload.attackerSlot ?? payload.attackerSlotName ?? "";
    const attackerPlayer = payload.attackingPlayerId ?? "";
    const defenderPlayer = payload.defendingPlayerId ?? "";
    return `${attacker}|${slot}|${attackerPlayer}|${defenderPlayer}`;
  }

  private buildAttackTargetKey(payload: any) {
    const attacker = payload.attackerCarduid ?? payload.attackerUnitUid ?? "";
    const target = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid ?? "";
    const slot = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot ?? "";
    const player = payload.forcedTargetPlayerId ?? payload.targetPlayerId ?? "";
    return `${attacker}|${target}|${slot}|${player}`;
  }

}
