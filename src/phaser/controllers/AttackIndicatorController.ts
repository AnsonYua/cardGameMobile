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
  private activeAttackNotificationId?: string;
  private activeAttackTargetKey?: string;

  constructor(private config: AttackIndicatorControllerConfig) {
    this.indicator = new AttackIndicator(config.scene);
  }

  updateFromNotification(
    event: SlotNotification | undefined,
    slots: SlotViewModel[],
    positions?: SlotPositionMap | null,
  ) {
    if (!event) {
      this.hideIndicator();
      return;
    }
    if (!positions) {
      this.hideIndicator();
      return;
    }
    const payload = event.payload || {};
    const targetKey = this.buildAttackTargetKey(payload);
    if (this.activeAttackNotificationId === event.id && this.activeAttackTargetKey === targetKey) {
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
      this.hideIndicator();
      return;
    }
    const attackStyle: AttackIndicatorStyle = attackerOwner ?? "player";
    this.indicator.show({ from: attackerCenter, to: targetPoint, style: attackStyle });
    this.activeAttackNotificationId = event.id;
    this.activeAttackTargetKey = targetKey;
  }

  clear() {
    this.hideIndicator();
  }

  private hideIndicator() {
    if (!this.activeAttackNotificationId) return;
    this.indicator.hide({ fadeDuration: 180 });
    this.activeAttackNotificationId = undefined;
    this.activeAttackTargetKey = undefined;
  }

  private buildAttackTargetKey(payload: any) {
    const attacker = payload.attackerCarduid ?? payload.attackerUnitUid ?? "";
    const target = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid ?? "";
    const slot = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot ?? "";
    const player = payload.forcedTargetPlayerId ?? payload.targetPlayerId ?? "";
    return `${attacker}|${target}|${slot}|${player}`;
  }

}
