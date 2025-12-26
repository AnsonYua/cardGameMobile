import Phaser from "phaser";

type TweenConfig = Phaser.Types.Tweens.TweenBuilderConfig;

type ImpactBurstOptions = {
  ringColor?: number;
  ringAlpha?: number;
  sparkColor?: number;
  sparkCount?: number;
  sparkLength?: number;
};

export class FxToolkit {
  constructor(private scene: Phaser.Scene) {}

  runTween(config: TweenConfig) {
    return new Promise<void>((resolve) => {
      const { onComplete, onCompleteScope, onCompleteParams, ...rest } = config as TweenConfig & Record<string, any>;
      const tween = this.scene.tweens.add({
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

  punchSprite(target: Phaser.GameObjects.GameObject, opts: { scale?: number; duration?: number } = {}) {
    const scale = opts.scale ?? 1.12;
    const duration = opts.duration ?? 90;
    (target as any).setScale?.(1);
    return this.runTween({
      targets: target,
      scale,
      duration,
      ease: "Quad.easeOut",
      yoyo: true,
    }).then(() => {
      (target as any).setScale?.(1);
    });
  }

  flashSprite(target: Phaser.GameObjects.GameObject, alphaFactor = 0.35, duration = 110) {
    const initialAlpha = (target as any).alpha ?? 1;
    return this.runTween({
      targets: target,
      alpha: initialAlpha * alphaFactor,
      duration,
      yoyo: true,
      ease: "Sine.easeIn",
    }).then(() => {
      (target as any).setAlpha?.(initialAlpha);
    });
  }

  flashAtPoint(point: { x: number; y: number }, size = { w: 120, h: 140 }, alpha = 0.65) {
    const rect = this.scene.add.rectangle(point.x, point.y, size.w, size.h, 0xffffff, alpha);
    rect.setDepth(920);
    return this.runTween({
      targets: rect,
      alpha: 0,
      duration: 160,
      ease: "Quad.easeOut",
    }).then(() => rect.destroy());
  }

  spawnImpactBurst(point: { x: number; y: number }, opts: ImpactBurstOptions = {}) {
    const ringColor = opts.ringColor ?? 0xffffff;
    const ringAlpha = opts.ringAlpha ?? 0.8;
    const sparkColor = opts.sparkColor ?? 0xfff3b0;
    const sparkCount = opts.sparkCount ?? 4;
    const sparkLength = opts.sparkLength ?? 12;

    const ring = this.scene.add.circle(point.x, point.y, 8, ringColor, 0.15);
    ring.setStrokeStyle(2, ringColor, ringAlpha);
    ring.setDepth(920);
    const sparks: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < sparkCount; i += 1) {
      const spark = this.scene.add.rectangle(point.x, point.y, 4, sparkLength, sparkColor, 0.85);
      spark.setAngle((360 / sparkCount) * i + 45);
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

  shakeCamera(duration = 120, intensity = 0.008) {
    this.scene.cameras.main?.shake(duration, intensity);
    return this.delay(duration);
  }

  delay(ms: number) {
    return new Promise<void>((resolve) => {
      this.scene.time.delayedCall(ms, () => resolve());
    });
  }
}
