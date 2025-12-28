import Phaser from "phaser";
import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotViewModel, SlotOwner, SlotPositionMap, SlotCardView } from "../ui/SlotTypes";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import { findSlotForAttack, getSlotPositionEntry, resolveAttackTargetPoint } from "../utils/AttackResolver";
import { FxToolkit } from "./FxToolkit";
import { toPreviewKey } from "../ui/HandTypes";
import { ProcessedIdCache, SnapshotCache } from "./AnimationCaches";

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
  attackId: string;
};

export class BattleAnimationManager {
  private static readonly LOCK_TTL_MS = 12000;
  private slotControls?: SlotVisibilityControls | null;
  private battleAnimationLayer?: Phaser.GameObjects.Container;
  private snapshotCache = new SnapshotCache<PendingBattleSnapshot>({
    ttlMs: 15000,
    maxEntries: 24,
  });
  private processedResolutions = new ProcessedIdCache(200);
  private resolvedAttacks = new ProcessedIdCache(300);
  private battleAnimationQueue: Promise<void> = Promise.resolve();
  private fx: FxToolkit;
  private lockedSlotSnapshots = new Map<string, { slot: SlotViewModel; savedAt: number }>();
  private pendingLockSnapshots = new Map<string, { slot: SlotViewModel; savedAt: number }>();
  private pendingLocksByAttackId = new Map<string, Set<string>>();

  constructor(private config: BattleAnimationManagerConfig) {
    this.slotControls = config.slotControls;
    this.fx = new FxToolkit(config.scene);
  }

  setSlotControls(slotControls?: SlotVisibilityControls | null) {
    this.slotControls = slotControls;
  }

  captureAttackSnapshot(snapshotNote: SlotNotification | undefined, slots: SlotViewModel[], positions?: SlotPositionMap | null) {
    if (!snapshotNote || !positions) return;
    if (this.resolvedAttacks.has(snapshotNote.id)) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] skip capture resolved attack", snapshotNote.id);
      return;
    }
    const payload = snapshotNote.payload || {};
    const previousSnapshot = this.snapshotCache.get(snapshotNote.id);
    // eslint-disable-next-line no-console
    console.log("[BattleAnimation] captureAttackSnapshot", snapshotNote.id, snapshotNote.type, {
      battleEnd: payload?.battleEnd,
      attackerSlot: payload?.attackerSlot || payload?.attackerSlotName,
      targetSlot: payload?.targetSlotName || payload?.targetSlot,
      forcedTargetZone: payload?.forcedTargetZone,
    });
    const attackerOwner = this.config.resolveSlotOwnerByPlayer(payload.attackingPlayerId);
    const defenderOwner =
      this.config.resolveSlotOwnerByPlayer(payload.defendingPlayerId) || (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attackerSlot || payload.attackerSlotName;
    // Resolve attacker and target positions using current slot state or payload fallback.
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
      this.snapshotCache.evictExpired();
      return;
    }

    const targetSlotId = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot;
    const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const targetSlot = findSlotForAttack(slots, targetCarduid, defenderOwner, targetSlotId);
    const targetPosition = getSlotPositionEntry(positions, targetSlot, defenderOwner, targetSlotId);

    const attackerSeed =
      this.buildBattleSpriteSeed(attackerSlot, attackerPosition) ||
      this.buildPayloadSeed(payload, "attacker", attackerOwner, attackerSlotId, attackerPosition);
    if (!attackerSeed) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] captureAttackSnapshot missing attackerSeed", snapshotNote.id);
      if (previousSnapshot) {
        this.releaseLockedSlotsForSnapshot(previousSnapshot);
        this.snapshotCache.delete(snapshotNote.id);
      }
      return;
    }
    const targetSeed =
      this.buildBattleSpriteSeed(targetSlot, targetPosition) ||
      this.buildPayloadSeed(payload, "target", defenderOwner, targetSlotId, targetPosition);
    const expectsTargetSlot = Boolean(
      payload.forcedTargetZone ||
        payload.targetSlotName ||
        payload.targetSlot ||
        payload.forcedTargetCarduid ||
        payload.targetCarduid ||
        payload.targetUnitUid,
    );
    if (previousSnapshot?.target && !targetSeed && expectsTargetSlot) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] captureAttackSnapshot keeping previous target", snapshotNote.id);
      return;
    }
    const replacedSnapshot = this.snapshotCache.set(snapshotNote.id, {
      attacker: attackerSeed,
      target: targetSeed,
      targetPoint,
      attackId: snapshotNote.id,
    });
    if (replacedSnapshot) {
      // Swap snapshots cleanly to avoid stale locks.
      this.releaseLockedSlotsForSnapshot(replacedSnapshot);
      this.releasePendingLocksForAttack(replacedSnapshot.attackId);
    }
    // Defer locking until battle animation runs to avoid overriding fresh UI changes.
    this.storePendingLock(snapshotNote.id, attackerSlot, attackerSeed);
    this.storePendingLock(snapshotNote.id, targetSlot, targetSeed);
    this.snapshotCache.evictExpired();
  }

  processBattleResolutionNotifications(notifications: SlotNotification[]) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return this.battleAnimationQueue;
    }
    this.snapshotCache.evictExpired();
    notifications.forEach((note) => {
      if (!note) return;
      if ((note.type || "").toUpperCase() !== "BATTLE_RESOLVED") return;
      if (this.processedResolutions.has(note.id)) return;
      // Prevent double-processing the same resolution during polling updates.
      this.processedResolutions.add(note.id);
      this.queueBattleResolution(note);
    });
    return this.battleAnimationQueue;
  }

  private queueBattleResolution(note: SlotNotification) {
    const payload = note.payload || {};
    const attackId = payload.attackNotificationId;
    if (!attackId) return;
    const snapshot = this.snapshotCache.get(attackId);
    if (!snapshot) {
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] missing snapshot for battle", attackId, note.id, payload?.battleType);
      // No snapshot means no animation; ensure locks are still released.
      this.releaseLockedSlotsByPayload(payload);
      return;
    }
    this.activatePendingLocksForAttack(attackId);
    this.battleAnimationQueue = this.battleAnimationQueue
      .then(() => this.playBattleResolutionAnimation(snapshot, payload))
      .then(() => {
        console.log("[BattleAnimation] completed resolution", attackId, payload?.battleType, Date.now());
        this.resolvedAttacks.add(attackId);
      })
      .catch((err) => console.warn("battle animation failed", err))
      .finally(() => {
        this.releaseLockedSlotsForSnapshot(snapshot);
        this.releasePendingLocksForAttack(attackId);
        this.snapshotCache.delete(attackId);
      });
  }

  private async playBattleResolutionAnimation(snapshot: PendingBattleSnapshot, payload: any): Promise<void> {
    const attackerSeed = snapshot.attacker;
    if (!attackerSeed) {
      return;
    }
    // Create sprite clones so we can animate without mutating actual slot renderers.
    const attackerSprite = this.createBattleSprite(attackerSeed);
    if (!attackerSprite) {
      return;
    }
    const targetSprite = snapshot.target ? this.createBattleSprite(snapshot.target) : undefined;
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

    const result = payload?.result || {};
    const cleanupTasks: Promise<void>[] = [];
    if (result.attackerDestroyed) {
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
      if (result.defenderDestroyed) {
        cleanupTasks.push(this.fadeOutAndDestroy(targetSprite));
      } else {
        // Pulse target to show impact without removing it.
        cleanupTasks.push(this.pulseSprite(targetSprite));
      }
    }

    await Promise.all(cleanupTasks);
    this.destroyBattleSprite(attackerSprite);
    this.destroyBattleSprite(targetSprite);
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

  private buildPayloadSeed(
    payload: any,
    role: "attacker" | "target",
    owner: SlotOwner | undefined,
    slotId: string | undefined,
    position?: { x: number; y: number; w: number; h: number; isOpponent?: boolean },
  ): BattleSpriteSeed | undefined {
    if (!owner || !slotId || !position) return undefined;
    // Build a sprite seed from payload when the slot card is already gone.
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
    const base = Math.min(position.w, position.h) * 0.8;
    return {
      owner,
      slotId,
      card,
      position: { x: position.x, y: position.y },
      size: { w: base, h: base * 1.4 },
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

  private lockSlotSnapshot(slot?: SlotViewModel) {
    if (!slot) return;
    const key = `${slot.owner}-${slot.slotId}`;
    if (!slot.slotId) return;
    // Snapshot the slot so we can render a stable card during animations.
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
    this.lockedSlotSnapshots.set(key, { slot: snapshot, savedAt: Date.now() });
    // eslint-disable-next-line no-console
    console.log("[BattleAnimation] lockSlot", key, snapshot.unit?.cardUid ?? snapshot.pilot?.cardUid ?? null);
  }

  private storePendingLock(attackId: string, slot?: SlotViewModel, seed?: BattleSpriteSeed) {
    if (!slot && !seed) return;
    const owner = slot?.owner ?? seed?.owner;
    const slotId = slot?.slotId ?? seed?.slotId;
    if (!owner || !slotId) return;
    const key = `${owner}-${slotId}`;
    const snapshot: SlotViewModel = {
      owner,
      slotId,
      unit: slot?.unit ? { ...slot.unit } : seed?.card ? { ...seed.card } : undefined,
      pilot: slot?.pilot ? { ...slot.pilot } : undefined,
      isRested: slot?.isRested,
      ap: slot?.ap,
      hp: slot?.hp,
      fieldCardValue: slot?.fieldCardValue ? { ...slot.fieldCardValue } : undefined,
    };
    this.pendingLockSnapshots.set(key, { slot: snapshot, savedAt: Date.now() });
    const bucket = this.pendingLocksByAttackId.get(attackId) ?? new Set<string>();
    bucket.add(key);
    this.pendingLocksByAttackId.set(attackId, bucket);
  }

  private activatePendingLocksForAttack(attackId: string) {
    this.evictExpiredLocks();
    const keys = this.pendingLocksByAttackId.get(attackId);
    if (!keys) return;
    keys.forEach((key) => {
      const entry = this.pendingLockSnapshots.get(key);
      if (entry) {
        this.lockedSlotSnapshots.set(key, { slot: entry.slot, savedAt: Date.now() });
        this.pendingLockSnapshots.delete(key);
        // eslint-disable-next-line no-console
        console.log("[BattleAnimation] activateLock", key);
      }
    });
    this.pendingLocksByAttackId.delete(attackId);
  }

  private releasePendingLocksForAttack(attackId: string) {
    const keys = this.pendingLocksByAttackId.get(attackId);
    if (!keys) return;
    keys.forEach((key) => {
      this.pendingLockSnapshots.delete(key);
    });
    this.pendingLocksByAttackId.delete(attackId);
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

  private releaseLockedSlotsByPayload(payload: any) {
    const released: string[] = [];
    const tryRelease = (owner: SlotOwner | undefined, slotId?: string) => {
      if (!owner || !slotId) return;
      const key = `${owner}-${slotId}`;
      if (this.lockedSlotSnapshots.delete(key)) {
        released.push(key);
      }
      // eslint-disable-next-line no-console
      console.log("[BattleAnimation] unlockSlot", key);
    };
    const attackerOwner = this.config.resolveSlotOwnerByPlayer(payload.attacker?.playerId ?? payload.attackingPlayerId);
    const targetOwner = this.config.resolveSlotOwnerByPlayer(payload.target?.playerId ?? payload.defendingPlayerId);
    tryRelease(attackerOwner, payload.attacker?.slot);
    tryRelease(targetOwner, payload.target?.slot);
    if (released.length) {
      this.config.onSlotsUnlocked?.(released);
    }
  }

  getLockedSlots() {
    this.evictExpiredLocks();
    const merged = new Map<string, SlotViewModel>();
    this.pendingLockSnapshots.forEach((entry, key) => merged.set(key, entry.slot));
    this.lockedSlotSnapshots.forEach((entry, key) => merged.set(key, entry.slot));
    return merged;
  }

  private evictExpiredLocks(now = Date.now()) {
    const ttl = BattleAnimationManager.LOCK_TTL_MS;
    this.pendingLockSnapshots.forEach((_entry, key) => {
      const entry = this.pendingLockSnapshots.get(key);
      if (entry && now - entry.savedAt > ttl) {
        this.pendingLockSnapshots.delete(key);
        // eslint-disable-next-line no-console
        console.log("[BattleAnimation] evictPendingLock", key);
      }
    });
    this.lockedSlotSnapshots.forEach((_entry, key) => {
      const entry = this.lockedSlotSnapshots.get(key);
      if (entry && now - entry.savedAt > ttl) {
        this.lockedSlotSnapshots.delete(key);
        // eslint-disable-next-line no-console
        console.log("[BattleAnimation] evictLocked", key);
      }
    });
    // Clean up empty attack buckets.
    Array.from(this.pendingLocksByAttackId.entries()).forEach(([attackId, keys]) => {
      const remaining = new Set<string>();
      keys.forEach((k) => {
        if (this.pendingLockSnapshots.has(k)) {
          remaining.add(k);
        }
      });
      if (remaining.size === 0) {
        this.pendingLocksByAttackId.delete(attackId);
      } else {
        this.pendingLocksByAttackId.set(attackId, remaining);
      }
    });
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

}
