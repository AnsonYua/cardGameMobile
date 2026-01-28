import Phaser from "phaser";
import { FxToolkit } from "./FxToolkit";

type Vector2 = { x: number; y: number };

type PlayAnimationPayload = {
  textureKey?: string;
  fallbackLabel?: string;
  start: Vector2;
  end: Vector2;
  isOpponent?: boolean;
  cardName?: string;
  stats?: { ap?: number; hp?: number };
  size?: { w: number; h: number };
  angle?: number;
};

export class PlayCardAnimationManager {
  private fx: FxToolkit;

  constructor(private scene: Phaser.Scene) {
    this.fx = new FxToolkit(scene);
  }

  async play(payload: PlayAnimationPayload) {
    const flight = this.playFlight(payload);
    await flight;
    this.playImpact(payload.end, payload.isOpponent);
  }

  private playFlight({ textureKey, fallbackLabel, start, end, size, angle }: PlayAnimationPayload) {
    console.log("playFlight ",textureKey)
    return new Promise<void>((resolve) => {
      // Bail if geometry is invalid to avoid runtime errors.
      const valid =
        Number.isFinite(start?.x) &&
        Number.isFinite(start?.y) &&
        Number.isFinite(end?.x) &&
        Number.isFinite(end?.y);
      if (!valid) {
        resolve();
        return;
      }
      // Default to hand/slot sizing and clamp to a safe fraction of the viewport so oversized assets can't explode.
      const cam = this.scene.cameras.main;
      const maxW = Math.max(40, Math.min(cam.width * 0.18, 120));
      const maxH = Math.max(55, Math.min(cam.height * 0.22, 160));
      const targetW = Math.min(size?.w ?? 80, maxW);
      const targetH = Math.min(size?.h ?? 110, maxH);
      const hasTexture = textureKey && this.scene.textures.exists(textureKey);
      const createdNodes: Phaser.GameObjects.GameObject[] = [];
      const sprite = hasTexture
        ? this.scene.add.image(start.x, start.y, textureKey!).setDisplaySize(targetW, targetH)
        : (this.scene.add.rectangle(start.x, start.y, targetW * 0.9, targetH * 0.86, 0x5e48f0) as Phaser.GameObjects.Rectangle);
      sprite.setDepth(2000).setOrigin(0.5).setScale(0.9).setAngle(angle ?? 0);
      createdNodes.push(sprite);
      if (!hasTexture && fallbackLabel) {
        const label = this.scene.add
          .text(start.x, start.y, fallbackLabel, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
          .setOrigin(0.5)
          .setDepth(2001);
        createdNodes.push(label);
      }

      const control = {
        x: (start.x + end.x) / 2 + Phaser.Math.Between(-30, 30),
        y: Math.min(start.y, end.y) - 120,
      };
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2(control.x, control.y),
        new Phaser.Math.Vector2(end.x, end.y),
      );

      this.scene.tweens.add({
        targets: sprite,
        scale: 1.2,
        duration: 180,
        ease: "Sine.easeOut",
      });

      const flightDuration = 520;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: flightDuration,
        ease: "Sine.easeInOut",
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const p = curve.getPoint(t);
          sprite.setPosition(p.x, p.y);
        },
        onComplete: () => {
          createdNodes.forEach((node) => node.destroy());
          resolve();
        },
      });
    });
  }

  private playImpact(pos: Vector2, isOpponent?: boolean) {
    const color = isOpponent ? 0xff6b4a : 0x5ee0ff;
    this.fx.shakeCamera(120, 0.004);
    this.fx.spawnImpactBurst(pos, { ringColor: color, ringAlpha: 0.5, sparkColor: color, sparkCount: 10, sparkLength: 16 });

    // Quick scan-line overlay to hint at tech feel.
    const scan = this.scene.add.rectangle(pos.x, pos.y, 90, 110, 0xffffff, 0.08).setDepth(1820);
    this.scene.tweens.add({
      targets: scan,
      height: 12,
      alpha: 0,
      y: pos.y + 30,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => scan.destroy(),
    });
  }

}
