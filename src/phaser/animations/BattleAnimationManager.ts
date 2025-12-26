import Phaser from "phaser";
import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotViewModel, SlotOwner, SlotPositionMap, SlotCardView } from "../ui/SlotTypes";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import {
  findSlotForAttack,
  getSlotPositionEntry,
  resolveAttackTargetPoint,
} from "../utils/AttackResolver";

type SlotVisibilityControls = {
  setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
};

type BattleAnimationManagerConfig = {
  scene: Phaser.Scene;
  slotControls?: SlotVisibilityControls | null;
  anchors: TargetAnchorProviders;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
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
};

export class BattleAnimationManager {
  private slotControls?: SlotVisibilityControls | null;
  private battleAnimationLayer?: Phaser.GameObjects.Container;
  private pendingBattleSnapshots = new Map<string, PendingBattleSnapshot>();
  private processedBattleResolutionIds = new Set<string>();
  private battleAnimationQueue: Promise<void> = Promise.resolve();

  constructor(private config: BattleAnimationManagerConfig) {
    this.slotControls = config.slotControls;
  }

  setSlotControls(slotControls?: SlotVisibilityControls | null) {
    this.slotControls = slotControls;
  }

  captureAttackSnapshot(note: SlotNotification | undefined, slots: SlotViewModel[], positions?: SlotPositionMap | null) {
    if (!note || !positions) return;
    const payload = note.payload || {};
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
      return;
    }

    const targetSlotId = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot;
    const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const targetSlot = findSlotForAttack(slots, targetCarduid, defenderOwner, targetSlotId);
    const targetPosition = getSlotPositionEntry(positions, targetSlot, defenderOwner, targetSlotId);

    const attackerSeed = this.buildBattleSpriteSeed(attackerSlot, attackerPosition);
    if (!attackerSeed) {
      return;
    }
    const targetSeed = this.buildBattleSpriteSeed(targetSlot, targetPosition);
    this.pendingBattleSnapshots.set(note.id, {
      attacker: attackerSeed,
      target: targetSeed,
      targetPoint,
    });
  }

  processBattleResolutionNotifications(notifications: SlotNotification[]) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return;
    }
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
    if (!snapshot) return;
    this.battleAnimationQueue = this.battleAnimationQueue
      .then(() => this.playBattleResolutionAnimation(attackId, snapshot, payload))
      .catch((err) => console.warn("battle animation failed", err));
  }

  private async playBattleResolutionAnimation(
    attackId: string,
    snapshot: PendingBattleSnapshot,
    payload: any,
  ): Promise<void> {
    const attackerSeed = snapshot.attacker;
    if (!attackerSeed) {
      this.pendingBattleSnapshots.delete(attackId);
      return;
    }
    const attackerSprite = this.createBattleSprite(attackerSeed);
    if (!attackerSprite) {
      this.pendingBattleSnapshots.delete(attackId);
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
      await this.runTween({
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
          this.runTween({
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
      this.pendingBattleSnapshots.delete(attackId);
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

  private runTween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((resolve) => {
      const {
        onComplete,
        onCompleteScope,
        onCompleteParams,
        ...rest
      } = config as Phaser.Types.Tweens.TweenBuilderConfig & Record<string, any>;
      const tween = this.config.scene.tweens.add({
        ...rest,
        onComplete: (tweenObj: Phaser.Tweens.Tween, targets: any, ...cbArgs: any[]) => {
          if (typeof onComplete === "function") {
            const userArgs = Array.isArray(onCompleteParams) ? onCompleteParams : cbArgs;
            (onComplete as (t: Phaser.Tweens.Tween, target: any, ...args: any[]) => void).call(
              onCompleteScope ?? this,
              tweenObj,
              targets,
              ...userArgs,
            );
          }
          resolve();
        },
      });
      if (!tween) {
        resolve();
      }
    });
  }

  private async playImpactEffects(
    attackerSprite: Phaser.GameObjects.Container,
    targetSprite: Phaser.GameObjects.Container | undefined,
    point: { x: number; y: number },
  ) {
    const tasks: Promise<void>[] = [];
    tasks.push(this.punchSprite(attackerSprite));
    tasks.push(this.spawnImpactBurst(point));
    tasks.push(this.shakeCamera(140, 0.008));
    if (targetSprite) {
      tasks.push(this.flashSprite(targetSprite));
    } else {
      tasks.push(this.flashAtPoint(point));
    }
    await Promise.all(tasks);
  }

  private fadeOutAndDestroy(target: Phaser.GameObjects.Container) {
    return this.runTween({
      targets: target,
      alpha: 0,
      duration: 200,
      ease: "Sine.easeIn",
    }).then(() => {
      this.destroyBattleSprite(target);
    });
  }

  private pulseSprite(target: Phaser.GameObjects.Container) {
    return this.runTween({
      targets: target,
      scale: 1.08,
      yoyo: true,
      duration: 140,
      ease: "Sine.easeInOut",
    }).then(() => {
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

  private punchSprite(target: Phaser.GameObjects.Container) {
    target.setScale(1);
    return this.runTween({
      targets: target,
      scale: 1.12,
      duration: 90,
      ease: "Quad.easeOut",
      yoyo: true,
    }).then(() => {
      target.setScale(1);
    });
  }

  private flashSprite(target: Phaser.GameObjects.Container) {
    const initialAlpha = target.alpha;
    return this.runTween({
      targets: target,
      alpha: initialAlpha * 0.35,
      duration: 110,
      yoyo: true,
      ease: "Sine.easeIn",
    }).then(() => {
      target.setAlpha(initialAlpha);
    });
  }

  private flashAtPoint(point: { x: number; y: number }) {
    const rect = this.config.scene.add.rectangle(point.x, point.y, 120, 140, 0xffffff, 0.65);
    rect.setDepth(920);
    return this.runTween({
      targets: rect,
      alpha: 0,
      duration: 160,
      ease: "Quad.easeOut",
    }).then(() => rect.destroy());
  }

  private spawnImpactBurst(point: { x: number; y: number }) {
    const ring = this.config.scene.add.circle(point.x, point.y, 8, 0xffffff, 0.15);
    ring.setStrokeStyle(2, 0xffffff, 0.8);
    ring.setDepth(920);
    const sparks: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 4; i += 1) {
      const spark = this.config.scene.add.rectangle(point.x, point.y, 4, 12, 0xfff3b0, 0.85);
      spark.setAngle(i * 90 + 45);
      spark.setDepth(921);
      sparks.push(spark);
    }
    return Promise.all([
      this.runTween({
        targets: ring,
        scale: 1.8,
        alpha: 0,
        duration: 220,
        ease: "Quad.easeOut",
      }),
      ...sparks.map((spark) =>
        this.runTween({
          targets: spark,
          y: spark.y - 8,
          alpha: 0,
          duration: 180,
          ease: "Sine.easeOut",
        }),
      ),
    ]).then(() => {
      ring.destroy();
      sparks.forEach((spark) => spark.destroy());
    });
  }

  private shakeCamera(duration = 120, intensity = 0.008) {
    this.config.scene.cameras.main?.shake(duration, intensity);
    return this.delay(duration);
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      this.config.scene.time.delayedCall(ms, () => resolve());
    });
  }
}
