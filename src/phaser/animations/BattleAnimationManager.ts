import Phaser from "phaser";
import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotViewModel, SlotOwner, SlotPositionMap, SlotCardView } from "../ui/SlotTypes";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import { findSlotForAttack, getSlotPositionEntry, resolveAttackTargetPoint } from "../utils/AttackResolver";
import { FxToolkit } from "./FxToolkit";
import { toPreviewKey } from "../ui/HandTypes";

type BattleAnimationManagerConfig = {
  scene: Phaser.Scene;
  anchors: TargetAnchorProviders;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
  createSlotSprite?: (slot: SlotViewModel, size: { w: number; h: number }) => Phaser.GameObjects.Container | undefined;
  getSlotsFromRaw?: (raw: any) => SlotViewModel[];
};

type BattleSpriteSeed = {
  owner: SlotOwner;
  slotId?: string;
  card: SlotCardView;
  slot?: SlotViewModel;
  position: { x: number; y: number };
  size: { w: number; h: number };
  isOpponent?: boolean;
};

type PendingBattleSnapshot = {
  attacker?: BattleSpriteSeed;
  target?: BattleSpriteSeed;
  targetPoint: { x: number; y: number };
  attackId: string;
};

export class BattleAnimationManager {
  private battleAnimationLayer?: Phaser.GameObjects.Container;
  private fx: FxToolkit;

  constructor(private config: BattleAnimationManagerConfig) {
    this.fx = new FxToolkit(config.scene);
  }

  async playBattleResolution(
    event: SlotNotification,
    slots?: SlotViewModel[],
    positions?: SlotPositionMap | null,
    raw?: any,
  ) {
    if (!event) return;
    if ((event.type || "").toUpperCase() !== "BATTLE_RESOLVED") return;
    const payload = event.payload || {};
    const attackId = payload.attackNotificationId;
    if (!attackId) return;
    const snapshot = this.buildSnapshotFromResolution(event, slots, positions);
    if (!snapshot) {
      return;
    }
    const rawSlots = raw && this.config.getSlotsFromRaw ? this.config.getSlotsFromRaw(raw) : undefined;
    await this.playBattleResolutionAnimation(snapshot, payload, rawSlots);
  }

  private buildSnapshotFromResolution(
    note: SlotNotification,
    slots?: SlotViewModel[],
    positions?: SlotPositionMap | null,
  ): PendingBattleSnapshot | undefined {
    if (!slots || !positions) return undefined;
    const payload = note.payload || {};
    const attackerOwner =
      this.config.resolveSlotOwnerByPlayer(payload.attacker?.playerId ?? payload.attackingPlayerId);
    const defenderOwner =
      this.config.resolveSlotOwnerByPlayer(payload.target?.playerId ?? payload.defendingPlayerId) ||
      (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attacker?.slot ?? payload.attackerSlot ?? payload.attackerSlotName;
    const attackerCarduid =
      payload.attacker?.unit?.carduid ??
      payload.attacker?.carduid ??
      payload.attackerCarduid ??
      payload.attackerUnitUid;
    const attackerSlot = findSlotForAttack(slots, attackerCarduid, attackerOwner, attackerSlotId);
    const attackerPosition = getSlotPositionEntry(positions, attackerSlot, attackerOwner, attackerSlotId);
    const targetPoint = resolveAttackTargetPoint(payload, slots, positions, defenderOwner ?? "opponent", {
      resolveSlotOwnerByPlayer: this.config.resolveSlotOwnerByPlayer,
      anchors: this.config.anchors,
    });

    if (!attackerPosition || !targetPoint) {
      return undefined;
    }

    const targetSlotId =
      payload.forcedTargetZone ?? payload.target?.slot ?? payload.targetSlotName ?? payload.targetSlot;
    const targetCarduid =
      payload.forcedTargetCarduid ?? payload.target?.carduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const targetSlot = findSlotForAttack(slots, targetCarduid, defenderOwner, targetSlotId);
    const targetPosition = getSlotPositionEntry(positions, targetSlot, defenderOwner, targetSlotId);

    const attackerSeed =
      this.buildBattleSpriteSeed(attackerSlot, attackerPosition) ||
      this.buildPayloadSeed(payload, "attacker", attackerOwner, attackerSlotId, attackerPosition);
    if (!attackerSeed) return undefined;
    const targetSeed =
      this.buildBattleSpriteSeed(targetSlot, targetPosition) ||
      this.buildPayloadSeed(payload, "target", defenderOwner, targetSlotId, targetPosition);

    return {
      attacker: attackerSeed,
      target: targetSeed,
      targetPoint,
      attackId: payload.attackNotificationId ?? note.id,
    };
  }

  private async playBattleResolutionAnimation(
    snapshot: PendingBattleSnapshot,
    payload: any,
    rawSlots?: SlotViewModel[],
  ): Promise<void> {
    const attackerSeed = snapshot.attacker;
    if (!attackerSeed) {
      return;
    }
    const resolved = this.resolveBattleResult(snapshot, payload, rawSlots);
    const hideSlot = (seed?: BattleSpriteSeed) => {
      if (!seed?.slotId) return;
      this.config.setSlotVisible?.(seed.owner, seed.slotId, false);
    };
    const showSlot = (seed?: BattleSpriteSeed) => {
      if (!seed?.slotId) return;
      this.config.setSlotVisible?.(seed.owner, seed.slotId, true);
    };
    try {
      // Create sprite clones so we can animate without mutating actual slot renderers.
      const attackerSprite = this.createBattleSprite(attackerSeed);
      if (!attackerSprite) {
        return;
      }
      const targetSprite = snapshot.target ? this.createBattleSprite(snapshot.target) : undefined;
      // Only hide underlying slots once we have sprites to show; otherwise the attacker can "pop" out.
      hideSlot(attackerSeed);
      hideSlot(snapshot.target);
      const targetPoint = snapshot.target?.position ?? snapshot.targetPoint;
      // Advance attacker to target, then play impact effects.
      await this.fx.runTween({
        targets: attackerSprite,
        x: targetPoint.x,
        y: targetPoint.y,
        duration: 320,
        ease: "Sine.easeIn",
      });
      await this.playImpactEffects(attackerSprite, targetSprite, targetPoint);

    const cleanupTasks: Promise<void>[] = [];
    if (resolved.attackerDestroyed) {
      cleanupTasks.push(this.fadeOutAndDestroy(attackerSprite));
    } else {
      // Return attacker to origin if it survives.
      cleanupTasks.push(
        this.fx.runTween({
          targets: attackerSprite,
          x: attackerSeed.position.x,
          y: attackerSeed.position.y,
          duration: 260,
          ease: "Sine.easeOut",
        }),
      );
    }

    if (targetSprite) {
      if (resolved.defenderDestroyed) {
        cleanupTasks.push(this.fadeOutAndDestroy(targetSprite));
      } else {
        // Pulse target to show impact without removing it.
        cleanupTasks.push(this.pulseSprite(targetSprite));
      }
    }

      await Promise.all(cleanupTasks);
      this.destroyBattleSprite(attackerSprite);
      this.destroyBattleSprite(targetSprite);
    } finally {
      if (!resolved.attackerDestroyed) {
        showSlot(attackerSeed);
      }
      if (!resolved.defenderDestroyed) {
        showSlot(snapshot.target);
      }
    }
  }

  private buildBattleSpriteSeed(slot?: SlotViewModel, slotPosition?: { x: number; y: number; w: number; h: number; isOpponent?: boolean }): BattleSpriteSeed | undefined {
    if (!slot || !slotPosition) return undefined;
    const card = slot.unit ?? slot.pilot;
    if (!card) return undefined;
    return {
      owner: slot.owner,
      slotId: slot.slotId,
      card,
      slot,
      position: { x: slotPosition.x, y: slotPosition.y },
      size: { w: slotPosition.w, h: slotPosition.h },
      isOpponent: slotPosition.isOpponent ?? slot.owner === "opponent",
    };
  }

  private buildPayloadSeed(
    payload: any,
    role: "attacker" | "target",
    owner: SlotOwner | undefined,
    slotId: string | undefined,
    position?: { x: number; y: number; w: number; h: number; isOpponent?: boolean },
  ): BattleSpriteSeed | undefined {
    if (!owner || !slotId || !position) return undefined;
    // Build a sprite seed from payload when the slot card is already gone.
    const payloadSlot = this.buildSlotFromPayload(payload, role, owner, slotId);
    const uid =
      role === "attacker"
        ? payload.attackerCarduid
        : payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const label = role === "attacker" ? payload.attackerName : payload.targetName;
    const cardId = this.extractCardId(uid);
    const textureKey = cardId ? toPreviewKey(cardId) : undefined;
    const id = label || uid || (role === "attacker" ? "Attacker" : "Target");
    const card: SlotCardView = {
      id,
      textureKey,
      cardUid: uid,
      cardType: role === "attacker" ? "unit" : undefined,
      cardData: label ? { name: label } : undefined,
    };
    return {
      owner,
      slotId,
      card,
      slot: payloadSlot,
      position: { x: position.x, y: position.y },
      size: { w: position.w, h: position.h },
      isOpponent: position.isOpponent ?? owner === "opponent",
    };
  }

  private extractCardId(uid?: string) {
    if (!uid || typeof uid !== "string") return undefined;
    const trimmed = uid.trim();
    if (!trimmed) return undefined;
    const idx = trimmed.indexOf("_");
    if (idx > 0) return trimmed.slice(0, idx);
    return trimmed;
  }

  private ensureBattleAnimationLayer() {
    if (!this.battleAnimationLayer) {
      this.battleAnimationLayer = this.config.scene.add.container(0, 0);
      this.battleAnimationLayer.setDepth(900);
    }
    return this.battleAnimationLayer;
  }

  private createBattleSprite(seed: BattleSpriteSeed) {
    const layer = this.ensureBattleAnimationLayer();
    if (!seed.card && !seed.slot) return undefined;
    const width = Number.isFinite(seed.size?.w) && seed.size.w > 0 ? seed.size.w : 96;
    const height = Number.isFinite(seed.size?.h) && seed.size.h > 0 ? seed.size.h : 134;
    const slotSprite = seed.slot ? this.config.createSlotSprite?.(seed.slot, { w: width, h: height }) : undefined;
    const fallbackSlot =
      seed.slot ??
      (seed.card
        ? {
            owner: seed.owner,
            slotId: seed.slotId ?? "slot",
            unit: seed.card,
            ap: seed.card?.cardData?.ap ?? 0,
            hp: seed.card?.cardData?.hp ?? 0,
          }
        : undefined);
    const fallbackSprite = fallbackSlot ? this.config.createSlotSprite?.(fallbackSlot, { w: width, h: height }) : undefined;
    const container = slotSprite ?? fallbackSprite ?? this.config.scene.add.container(0, 0);
    container.setPosition(seed.position.x, seed.position.y);
    container.setDepth(seed.isOpponent ? 905 : 915);
    layer?.add(container);

    if (slotSprite || fallbackSprite) {
      return container;
    }
    if (seed.card.textureKey && this.config.scene.textures.exists(seed.card.textureKey)) {
      const img = this.config.scene.add.image(0, 0, seed.card.textureKey);
      img.setDisplaySize(width, height);
      img.setOrigin(0.5);
      container.add(img);
    } else {
      const rect = this.config.scene.add.rectangle(0, 0, width, height, 0x2f3342, 0.95);
      rect.setStrokeStyle(2, 0x111926, 0.9);
      container.add(rect);
      if (seed.card.id) {
        const label = this.config.scene.add
          .text(0, 0, seed.card.id, {
            fontSize: "14px",
            fontFamily: "Arial",
            color: "#f5f6fb",
            align: "center",
          })
          .setOrigin(0.5);
        container.add(label);
      }
    }

    return container;
  }

  private async playImpactEffects(
    attackerSprite: Phaser.GameObjects.Container,
    targetSprite: Phaser.GameObjects.Container | undefined,
    point: { x: number; y: number },
  ) {
    const tasks: Promise<void>[] = [];
    tasks.push(this.fx.punchSprite(attackerSprite));
    tasks.push(this.fx.spawnImpactBurst(point));
    tasks.push(this.fx.shakeCamera(140, 0.008));
    if (targetSprite) {
      tasks.push(this.fx.flashSprite(targetSprite));
    } else {
      tasks.push(this.fx.flashAtPoint(point));
    }
    await Promise.all(tasks);
  }

  private fadeOutAndDestroy(target: Phaser.GameObjects.Container) {
    return this.fx
      .runTween({
        targets: target,
        alpha: 0,
        duration: 200,
        ease: "Sine.easeIn",
      })
      .then(() => {
        this.destroyBattleSprite(target);
      });
  }

  private pulseSprite(target: Phaser.GameObjects.Container) {
    return this.fx
      .runTween({
        targets: target,
        scale: 1.08,
        yoyo: true,
        duration: 140,
        ease: "Sine.easeInOut",
      })
      .then(() => {
        const meta = target as any;
        if (!meta?.destroyed) {
          target.setScale(1);
        }
      });
  }

  private destroyBattleSprite(target?: Phaser.GameObjects.Container) {
    if (!target) return;
    const meta = target as any;
    if (meta?.destroyed) return;
    target.destroy(true);
  }

  private buildSlotFromPayload(
    payload: any,
    role: "attacker" | "target",
    owner: SlotOwner,
    slotId: string,
  ): SlotViewModel | undefined {
    const source = role === "attacker" ? payload.attacker : payload.target;
    if (!source) return undefined;
    const unit = this.toSlotCard(source.unit);
    const pilot = this.toSlotCard(source.pilot);
    if (!unit && !pilot) return undefined;
    const fieldCardValue = source.fieldCardValue ?? {};
    return {
      owner,
      slotId,
      unit,
      pilot,
      isRested: source.unit?.isRested ?? fieldCardValue?.isRested ?? false,
      ap: fieldCardValue.totalAP ?? unit?.cardData?.ap ?? 0,
      hp: fieldCardValue.totalHP ?? unit?.cardData?.hp ?? 0,
      fieldCardValue,
    };
  }

  private toSlotCard(card: any): SlotCardView | undefined {
    if (!card) return undefined;
    const id = card.cardId ?? card.id;
    const textureKey = id ? toPreviewKey(id) : undefined;
    const cardUid = card.carduid ?? card.cardUid ?? card.uid ?? card.id;
    return { id, textureKey, cardType: card.cardData?.cardType, isRested: card.isRested, cardData: card.cardData, cardUid };
  }

  private resolveBattleResult(
    snapshot: PendingBattleSnapshot,
    payload: any,
    rawSlots?: SlotViewModel[],
  ): { attackerDestroyed: boolean; defenderDestroyed: boolean } {
    const result = payload?.result ?? {};
    let attackerDestroyed = this.coerceOptionalBool(result.attackerDestroyed);
    let defenderDestroyed = this.coerceOptionalBool(result.defenderDestroyed);

    if (attackerDestroyed == null || defenderDestroyed == null) {
      const attackerAp = this.getSeedStat(snapshot.attacker, "ap");
      const attackerHp = this.getSeedStat(snapshot.attacker, "hp");
      const targetAp = this.getSeedStat(snapshot.target, "ap");
      const targetHp = this.getSeedStat(snapshot.target, "hp");
      if (defenderDestroyed == null && attackerAp != null && targetHp != null) {
        defenderDestroyed = attackerAp >= targetHp;
      }
      if (attackerDestroyed == null && targetAp != null && attackerHp != null) {
        attackerDestroyed = targetAp >= attackerHp;
      }
    }

    if (rawSlots?.length) {
      const attackerUid = this.resolveSeedUid(snapshot.attacker, payload, "attacker");
      const targetUid = this.resolveSeedUid(snapshot.target, payload, "target");
      if (attackerUid && !this.isUidInSlots(rawSlots, attackerUid)) {
        attackerDestroyed = true;
      }
      if (targetUid && !this.isUidInSlots(rawSlots, targetUid)) {
        defenderDestroyed = true;
      }
    }

    return {
      attackerDestroyed: !!attackerDestroyed,
      defenderDestroyed: !!defenderDestroyed,
    };
  }

  private getSeedStat(seed: BattleSpriteSeed | undefined, stat: "ap" | "hp"): number | undefined {
    const slotValue =
      stat === "ap"
        ? seed?.slot?.fieldCardValue?.totalAP ?? seed?.slot?.ap
        : seed?.slot?.fieldCardValue?.totalHP ?? seed?.slot?.hp;
    if (typeof slotValue === "number") return slotValue;
    const cardValue = stat === "ap" ? seed?.card?.cardData?.ap : seed?.card?.cardData?.hp;
    return typeof cardValue === "number" ? cardValue : undefined;
  }

  private resolveSeedUid(seed: BattleSpriteSeed | undefined, payload: any, role: "attacker" | "target") {
    if (seed?.card?.cardUid) return seed.card.cardUid;
    if (role === "attacker") {
      return payload?.attacker?.carduid ?? payload?.attackerCarduid ?? payload?.attackerUnitUid;
    }
    return (
      payload?.forcedTargetCarduid ??
      payload?.target?.carduid ??
      payload?.targetCarduid ??
      payload?.targetUnitUid
    );
  }

  private isUidInSlots(slots: SlotViewModel[], uid: string) {
    return slots.some((slot) => slot.unit?.cardUid === uid || slot.pilot?.cardUid === uid);
  }

  private coerceOptionalBool(value: unknown) {
    if (value === true) return true;
    if (value === false) return false;
    return null;
  }
}
