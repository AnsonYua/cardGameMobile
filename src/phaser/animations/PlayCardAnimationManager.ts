import Phaser from "phaser";
import { DrawHelpers } from "../ui/HeaderHandler";
import { Palette } from "../ui/types";

type Vector2 = { x: number; y: number };

type PlayAnimationPayload = {
  textureKey?: string;
  fallbackLabel?: string;
  start: Vector2;
  end: Vector2;
  isOpponent?: boolean;
  cardName?: string;
  stats?: { ap?: number; hp?: number };
};

/**
 * Orchestrates the "card played" sequence: flight from hand to slot, impact FX, and a HUD-style alert banner.
 * Designed to be self-contained so SlotDisplayHandler can stay lean.
 */
export class PlayCardAnimationManager {
  private alertContainer?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  async play(payload: PlayAnimationPayload) {
    const flight = this.playFlight(payload);
    await flight;
    this.playImpact(payload.end, payload.isOpponent);
    this.showAlert(payload);
  }

  private playFlight({ textureKey, fallbackLabel, start, end }: PlayAnimationPayload) {
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
      const hasTexture = textureKey && this.scene.textures.exists(textureKey);
      const sprite = hasTexture
        ? this.scene.add.image(start.x, start.y, textureKey!).setDisplaySize(80, 110)
        : (this.scene.add.rectangle(start.x, start.y, 70, 95, 0x5e48f0) as Phaser.GameObjects.Rectangle);
      sprite.setDepth(2000).setOrigin(0.5).setScale(0.9);
      if (!hasTexture && fallbackLabel) {
        this.scene.add
          .text(start.x, start.y, fallbackLabel, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
          .setOrigin(0.5)
          .setDepth(2001);
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
          sprite.destroy();
          resolve();
        },
      });
    });
  }

  private playImpact(pos: Vector2, isOpponent?: boolean) {
    const cam = this.scene.cameras.main;
    cam.shake(120, 0.004);
    const ring = this.scene.add.circle(pos.x, pos.y, 12, 0x000000, 0).setStrokeStyle(2, 0xffffff, 0.7).setDepth(1800);
    this.scene.tweens.add({
      targets: ring,
      radius: 38,
      alpha: 0,
      duration: 320,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });

    const color = isOpponent ? 0xff6b4a : 0x5ee0ff;
    for (let i = 0; i < 10; i++) {
      const angle = Phaser.Math.DegToRad((360 / 10) * i + Phaser.Math.Between(-10, 10));
      const dist = Phaser.Math.Between(28, 52);
      const target = { x: pos.x + Math.cos(angle) * dist, y: pos.y + Math.sin(angle) * dist };
      const particle = this.scene.add.circle(pos.x, pos.y, Phaser.Math.Between(3, 5), color, 0.9).setDepth(1850);
      this.scene.tweens.add({
        targets: particle,
        x: target.x,
        y: target.y,
        alpha: 0,
        scale: 0.6,
        duration: 320,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }

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

  private showAlert({ cardName, stats, isOpponent, textureKey, fallbackLabel }: PlayAnimationPayload) {
    this.alertContainer?.destroy();
    const cam = this.scene.cameras.main;
    const width = cam.width * 0.7;
    const height = 140;
    const x = cam.centerX;
    const y = cam.height * 0.28;
    const borderColor = isOpponent ? 0xff6b4a : 0x5ee0ff;

    const container = this.scene.add.container(x, y).setDepth(2500).setAlpha(0);
    const bg = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: 0,
      width,
      height,
      radius: 18,
      fillColor: "#000000",
      fillAlpha: 0.75,
      strokeColor: borderColor,
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
    container.add(bg);

    const thumbSize = height - 30;
    const hasTexture = textureKey && this.scene.textures.exists(textureKey);
    const thumb = hasTexture
      ? (this.scene.add.image(-width / 2 + thumbSize / 2 + 18, 0, textureKey!).setDisplaySize(thumbSize, thumbSize) as any)
      : (this.scene.add.rectangle(-width / 2 + thumbSize / 2 + 18, 0, thumbSize, thumbSize, 0x5e48f0) as any);
    thumb.setOrigin(0.5);
    container.add(thumb);
    if (!hasTexture && fallbackLabel) {
      const lbl = this.scene.add
        .text(thumb.x, thumb.y, fallbackLabel, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
        .setOrigin(0.5);
      container.add(lbl);
    }

    const title = this.scene.add
      .text(
        -width / 2 + thumbSize + 32,
        -20,
        isOpponent ? `Opponent played ${cardName ?? "a card"}!` : `Deploying ${cardName ?? "card"}!`,
        {
          fontSize: "20px",
          fontFamily: "Arial",
          color: "#f7f9ff",
          fontStyle: "bold",
        },
      )
      .setOrigin(0, 0.5);
    const subtitle = this.scene.add
      .text(
        -width / 2 + thumbSize + 32,
        20,
        `Power: ${stats?.ap ?? "--"} / ${stats?.hp ?? "--"}`,
        { fontSize: "16px", fontFamily: "Arial", color: "#c8d4ff" },
      )
      .setOrigin(0, 0.5);
    container.add(title);
    container.add(subtitle);

    // Glow pulse
    this.scene.tweens.add({
      targets: bg,
      alpha: 0.9,
      duration: 280,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      y: y + 8,
      duration: 220,
      ease: "Sine.easeOut",
    });

    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      duration: 350,
      delay: 1200,
      ease: "Sine.easeIn",
      onComplete: () => container.destroy(),
    });

    this.alertContainer = container;
  }
}
