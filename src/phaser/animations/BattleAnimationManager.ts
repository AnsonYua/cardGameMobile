import Phaser from "phaser";
import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotViewModel, SlotOwner, SlotPositionMap, SlotCardView } from "../ui/SlotTypes";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import { findSlotForAttack, getSlotPositionEntry, resolveAttackTargetPoint } from "../utils/AttackResolver";
import { FxToolkit } from "./FxToolkit";

type SlotVisibilityControls = {
  setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
};

type BattleAnimationManagerConfig = {
  scene: Phaser.Scene;
  slotControls?: SlotVisibilityControls | null;
  anchors: TargetAnchorProviders;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  onSlotsUnlocked?: (keys: string[]) => void;
};

type BattleSpriteSeed = {
  owner: SlotOwner;
  slotId?: string;
  card: SlotCardView;
  position: { x: number; y: number };
  size: { w: number; h: number };
  isOpponent?: boolean;
};

type PendingBattleSnapshot = {
  attacker?: BattleSpriteSeed;
  target?: BattleSpriteSeed;
  targetPoint: { x: number; y: number };
  savedAt: number;
};

export class BattleAnimationManager {
  private slotControls?: SlotVisibilityControls | null;
  private battleAnimationLayer?: Phaser.GameObjects.Container;
  private pendingBattleSnapshots = new Map<string, PendingBattleSnapshot>();
  private processedBattleResolutionIds = new Set<string>();
  private battleAnimationQueue: Promise<void> = Promise.resolve();
  private fx: FxToolkit;
  private snapshotTtlMs = 15000;
  private maxSnapshots = 24;
  private lockedSlotSnapshots = new Map<string, SlotViewModel>();

  constructor(private config: BattleAnimationManagerConfig) {
    this.slotControls = config.slotControls;
    this.fx = new FxToolkit(config.scene);
  }

  setSlotControls(slotControls?: SlotVisibilityControls | null) {
    this.slotControls = slotControls;
  }

  captureAttackSnapshot(note: SlotNotification | undefined, slots: SlotViewModel[], positions?: SlotPositionMap | null) {
    if (!note || !positions) return;
    const payload = note.payload || {};
    // eslint-disable-next-line no-console
    console.log("[BattleAnimation] captureAttackSnapshot", note.id, note.type, {
      battleEnd: payload?.battleEnd,
      attackerSlot: payload?.attackerSlot || payload?.attackerSlotName,
      targetSlot: payload?.targetSlotName || payload?.targetSlot,
      forcedTargetZone: payload?.forcedTargetZone,
    });
    const attackerOwner = this.config.resolveSlotOwnerByPlayer(payload.attackingPlayerId);
    const defenderOwner =
      this.config.resolveSlotOwnerByPlayer(payload.defendingPlayerId) || (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attackerSlot || payload.attackerSlotName;
    const attackerSlot = findSlotForAttack(slots, payload.attackerCarduid, attackerOwner, attackerSlotId);
    const attackerPosition = getSlotPositionEntry(positions, attackerSlot, attackerOwner, attackerSlotId);
    const targetPoint = resolveAttackTargetPoint(payload, slots, positions, defenderOwner ?? "opponent", {
      resolveSlotOwnerByPlayer: this.config.resolveSlotOwnerByPlayer,
      anchors: this.config.anchors,
    });
    if (!attackerPosition || !targetPoint) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] captureAttackSnapshot skipped", {
        attackerPosition: !!attackerPosition,
        targetPoint: !!targetPoint,
      });
      return;
    }

    const targetSlotId = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot;
    const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const targetSlot = findSlotForAttack(slots, targetCarduid, defenderOwner, targetSlotId);
    const targetPosition = getSlotPositionEntry(positions, targetSlot, defenderOwner, targetSlotId);

    const attackerSeed = this.buildBattleSpriteSeed(attackerSlot, attackerPosition);
    if (!attackerSeed) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] captureAttackSnapshot missing attackerSeed", note.id);
      return;
    }
    const targetSeed = this.buildBattleSpriteSeed(targetSlot, targetPosition);
    this.pendingBattleSnapshots.set(note.id, {
      attacker: attackerSeed,
      target: targetSeed,
      targetPoint,
      savedAt: Date.now(),
    });
    this.lockSlotSnapshot(attackerSlot);
    this.lockSlotSnapshot(targetSlot);
    this.trimSnapshotCache();
    this.evictExpiredSnapshots();
  }

  processBattleResolutionNotifications(notifications: SlotNotification[]) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return;
    }
    this.evictExpiredSnapshots();
    notifications.forEach((note) => {
      if (!note) return;
      if ((note.type || "").toUpperCase() !== "BATTLE_RESOLVED") return;
      if (this.processedBattleResolutionIds.has(note.id)) return;
      this.processedBattleResolutionIds.add(note.id);
      this.queueBattleResolution(note);
    });
  }

  private queueBattleResolution(note: SlotNotification) {
    const payload = note.payload || {};
    const attackId = payload.attackNotificationId;
    if (!attackId) return;
    const snapshot = this.pendingBattleSnapshots.get(attackId);
    if (!snapshot) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] missing snapshot for battle", attackId, note.id, payload?.battleType);
      return;
    }
    this.battleAnimationQueue = this.battleAnimationQueue
      .then(() => this.playBattleResolutionAnimation(attackId, snapshot, payload))
      .then(() => {
        console.log("[BattleAnimation] completed resolution", attackId, payload?.battleType, Date.now());
      })
      .catch((err) => console.warn("battle animation failed", err))
      .finally(() => {
        this.releaseLockedSlotsForSnapshot(snapshot);
        this.processedBattleResolutionIds.delete(note.id);
        this.pendingBattleSnapshots.delete(attackId);
      });
  }

  private async playBattleResolutionAnimation(
    attackId: string,
    snapshot: PendingBattleSnapshot,
    payload: any,
  ): Promise<void> {
    const attackerSeed = snapshot.attacker;
    if (!attackerSeed) {
      return;
    }
    const attackerSprite = this.createBattleSprite(attackerSeed);
    if (!attackerSprite) {
      return;
    }
    const targetSprite = snapshot.target ? this.createBattleSprite(snapshot.target) : undefined;
    const targetPoint = snapshot.target?.position ?? snapshot.targetPoint;
    const releaseVisibility: Array<() => void> = [];
    const hideSlot = (seed?: BattleSpriteSeed) => {
      if (!seed?.slotId) return;
      this.slotControls?.setSlotVisible?.(seed.owner, seed.slotId, false);
      releaseVisibility.push(() => {
        this.slotControls?.setSlotVisible?.(seed.owner, seed.slotId, true);
      });
    };
    hideSlot(attackerSeed);
    hideSlot(snapshot.target);
    try {
      await this.fx.runTween({
        targets: attackerSprite,
        x: targetPoint.x,
        y: targetPoint.y,
        duration: 320,
        ease: "Sine.easeIn",
      });
      await this.playImpactEffects(attackerSprite, targetSprite, targetPoint);

      const result = payload?.result || {};
      const cleanupTasks: Promise<void>[] = [];
      if (result.attackerDestroyed) {
        cleanupTasks.push(this.fadeOutAndDestroy(attackerSprite));
      } else {
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
        if (result.defenderDestroyed) {
          cleanupTasks.push(this.fadeOutAndDestroy(targetSprite));
        } else {
          cleanupTasks.push(this.pulseSprite(targetSprite));
        }
      }

      await Promise.all(cleanupTasks);
      this.destroyBattleSprite(attackerSprite);
      this.destroyBattleSprite(targetSprite);
    } finally {
      releaseVisibility.forEach((fn) => fn());
    }
  }

  private buildBattleSpriteSeed(slot?: SlotViewModel, slotPosition?: { x: number; y: number; w: number; h: number; isOpponent?: boolean }): BattleSpriteSeed | undefined {
    if (!slot || !slotPosition) return undefined;
    const card = slot.unit ?? slot.pilot;
    if (!card) return undefined;
    const base = Math.min(slotPosition.w, slotPosition.h) * 0.8;
    return {
      owner: slot.owner,
      slotId: slot.slotId,
      card,
      position: { x: slotPosition.x, y: slotPosition.y },
      size: { w: base, h: base * 1.4 },
      isOpponent: slotPosition.isOpponent ?? slot.owner === "opponent",
    };
  }

  private lockSlotSnapshot(slot?: SlotViewModel) {
    if (!slot) return;
    const key = `${slot.owner}-${slot.slotId}`;
    if (!slot.slotId) return;
    const snapshot: SlotViewModel = {
      owner: slot.owner,
      slotId: slot.slotId,
      unit: slot.unit ? { ...slot.unit } : undefined,
      pilot: slot.pilot ? { ...slot.pilot } : undefined,
      isRested: slot.isRested,
      ap: slot.ap,
      hp: slot.hp,
      fieldCardValue: slot.fieldCardValue ? { ...slot.fieldCardValue } : undefined,
    };
    this.lockedSlotSnapshots.set(key, snapshot);
    // eslint-disable-next-line no-console
    console.log("[BattleAnimation] lockSlot", key, snapshot.unit?.cardUid ?? snapshot.pilot?.cardUid ?? null);
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
    if (!seed.card) return undefined;
    const container = this.config.scene.add.container(seed.position.x, seed.position.y);
    container.setDepth(seed.isOpponent ? 905 : 915);
    layer?.add(container);

    const width = seed.size.w;
    const height = seed.size.h;
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

  private releaseLockedSlotsForSnapshot(snapshot: PendingBattleSnapshot) {
    const released: string[] = [];
    const release = (seed?: BattleSpriteSeed) => {
      if (!seed || !seed.slotId) return;
      const key = `${seed.owner}-${seed.slotId}`;
      if (this.lockedSlotSnapshots.delete(key)) {
        released.push(key);
      }
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] unlockSlot", key);
    };
    release(snapshot.attacker);
    release(snapshot.target);
    if (released.length) {
      this.config.onSlotsUnlocked?.(released);
    }
  }

  getLockedSlots() {
    return new Map(this.lockedSlotSnapshots);
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

  private trimSnapshotCache() {
    while (this.pendingBattleSnapshots.size > this.maxSnapshots) {
      const oldestKey = this.pendingBattleSnapshots.keys().next().value;
      if (!oldestKey) break;
      this.pendingBattleSnapshots.delete(oldestKey);
    }
  }

  private evictExpiredSnapshots(now = Date.now()) {
    const ttl = this.snapshotTtlMs;
    this.pendingBattleSnapshots.forEach((snapshot, key) => {
      if (now - snapshot.savedAt > ttl) {
        this.pendingBattleSnapshots.delete(key);
      }
    });
  }
}
