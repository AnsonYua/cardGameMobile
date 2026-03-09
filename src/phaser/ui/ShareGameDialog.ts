import Phaser from "phaser";
import { redrawRoundedGraphics } from "./graphics/roundedGraphics";
import { resolveShareGameInviteUrl, type ShareGameInviteConfig } from "./shareGameInvite";
import { DEBUG_POPUP_WAITING_THEME as THEME } from "./style/WaitingDialogTheme";

export type { ShareGameInviteConfig } from "./shareGameInvite";

export class ShareGameDialog {
  private container?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private copyResetTimer?: Phaser.Time.TimerEvent;
  private readonly depth = 6000;
  private readonly tweenDuration = 200;

  constructor(private scene: Phaser.Scene) {}

  show(config: ShareGameInviteConfig) {
    this.destroyImmediate();

    const shareUrl = resolveShareGameInviteUrl(config);
    const { width, height } = this.scene.scale;
    const popupW = Math.max(300, Math.min(380, width - 24));
    const copyButtonW = Math.min(168, popupW - 40);
    const copyButtonH = 42;
    const contentW = popupW - 48;

    const description = this.scene.add
      .text(0, 0, "Share this link with another player so they can join this game.", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: THEME.textSecondary,
        align: "center",
        wordWrap: { width: contentW },
      })
      .setOrigin(0.5, 0);

    const statusText = this.scene.add
      .text(
        0,
        0,
        shareUrl
          ? "Copy the join URL and send it to the other player."
          : "Invite link unavailable. Start a hosted room first to generate a join link.",
        {
          fontSize: "13px",
          fontFamily: "Arial",
          color: shareUrl ? THEME.textPrimary : THEME.textSecondary,
          align: "center",
          wordWrap: { width: contentW - 12 },
        },
      )
      .setOrigin(0.5, 0);

    const statusBoxH = Math.max(64, Math.ceil(statusText.height + 28));
    const popupH = Math.max(236, Math.ceil(168 + description.height + statusBoxH));
    const centerX = width / 2;
    const centerY = height / 2;

    const backdrop = this.scene.add
      .rectangle(centerX, centerY, width, height, THEME.backdrop, 0.44)
      .setDepth(this.depth - 1)
      .setAlpha(0)
      .setInteractive();

    const bgShadow = this.scene.add.graphics().setDepth(this.depth);
    redrawRoundedGraphics({
      target: bgShadow,
      x: 0,
      y: 4,
      width: popupW + 10,
      height: popupH + 12,
      radius: 24,
      fillColor: THEME.shadow,
      fillAlpha: 0.34,
    });

    const bg = this.scene.add.graphics().setDepth(this.depth + 1);
    redrawRoundedGraphics({
      target: bg,
      x: 0,
      y: 0,
      width: popupW,
      height: popupH,
      radius: 20,
      fillColor: THEME.panel,
      fillAlpha: 0.96,
      strokeColor: THEME.panelStroke,
      strokeWidth: 2,
    });

    const inner = this.scene.add.graphics().setDepth(this.depth + 2);
    redrawRoundedGraphics({
      target: inner,
      x: 0,
      y: 0,
      width: popupW - 14,
      height: popupH - 14,
      radius: 16,
      fillColor: THEME.panelInner,
      fillAlpha: 0.45,
    });

    const headerY = -popupH / 2 + 30;
    const title = this.scene.add
      .text(-popupW / 2 + 16, headerY, "Invite Player", {
        fontSize: "18px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: THEME.textPrimary,
      })
      .setOrigin(0, 0.5)
      .setDepth(this.depth + 4);

    const closeBtn = this.scene.add
      .circle(popupW / 2 - 20, headerY, 14, THEME.closeFill, 0.95)
      .setDepth(this.depth + 4);
    closeBtn.setStrokeStyle(1, THEME.closeStroke, 0.92);
    const closeLabel = this.scene.add
      .text(closeBtn.x, closeBtn.y - 1, "×", {
        fontSize: "22px",
        fontFamily: "Arial",
        color: THEME.textPrimary,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 5);

    closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => void this.hide());
    closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => void this.hide());
    closeBtn.on("pointerover", () => closeBtn.setFillStyle(THEME.panelStroke, 1));
    closeBtn.on("pointerout", () => closeBtn.setFillStyle(THEME.closeFill, 0.95));

    description.setPosition(0, headerY + 24);
    description.setDepth(this.depth + 4);

    const statusBoxY = description.y + description.height + 24 + statusBoxH / 2;
    const statusBox = this.scene.add.graphics().setDepth(this.depth + 2);
    redrawRoundedGraphics({
      target: statusBox,
      x: 0,
      y: statusBoxY,
      width: popupW - 26,
      height: statusBoxH,
      radius: 10,
      fillColor: THEME.panelInner,
      fillAlpha: 0.96,
      strokeColor: THEME.panelStroke,
    });

    statusText.setPosition(0, statusBoxY - statusBoxH / 2 + 14);
    statusText.setDepth(this.depth + 4);

    const copyButtonY = popupH / 2 - 38;
    const copyButtonBg = this.scene.add.graphics().setDepth(this.depth + 2);
    redrawRoundedGraphics({
      target: copyButtonBg,
      x: 0,
      y: copyButtonY,
      width: copyButtonW,
      height: copyButtonH,
      radius: 10,
      fillColor: shareUrl ? THEME.row : THEME.panelInner,
      fillAlpha: 0.96,
      strokeColor: shareUrl ? THEME.rowBorder : THEME.panelStroke,
    });

    const copyButtonLabel = this.scene.add
      .text(0, copyButtonY, shareUrl ? "Copy" : "Copy Unavailable", {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: shareUrl ? THEME.textPrimary : THEME.textSecondary,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 4);

    const objects: Phaser.GameObjects.GameObject[] = [
      bgShadow,
      bg,
      inner,
      title,
      closeBtn,
      closeLabel,
      description,
      statusBox,
      statusText,
      copyButtonBg,
      copyButtonLabel,
    ];

    if (shareUrl) {
      const copyButtonHit = this.scene.add
        .rectangle(0, copyButtonY, copyButtonW, copyButtonH, 0x000000, 0.001)
        .setDepth(this.depth + 5);
      copyButtonHit.setInteractive({ useHandCursor: true });
      copyButtonHit.on("pointerdown", () => void this.handleCopy(shareUrl, copyButtonLabel));
      copyButtonHit.on("pointerover", () =>
        redrawRoundedGraphics({
          target: copyButtonBg,
          x: 0,
          y: copyButtonY,
          width: copyButtonW,
          height: copyButtonH,
          radius: 10,
          fillColor: THEME.rowHover,
          fillAlpha: 1,
          strokeColor: THEME.rowHoverBorder,
        }),
      );
      copyButtonHit.on("pointerout", () =>
        redrawRoundedGraphics({
          target: copyButtonBg,
          x: 0,
          y: copyButtonY,
          width: copyButtonW,
          height: copyButtonH,
          radius: 10,
          fillColor: THEME.row,
          fillAlpha: 0.96,
          strokeColor: THEME.rowBorder,
        }),
      );
      objects.push(copyButtonHit);
    }

    const container = this.scene.add.container(centerX, centerY, objects).setDepth(this.depth);
    container.setAlpha(0);

    this.backdrop = backdrop;
    this.container = container;

    this.scene.tweens.add({
      targets: [backdrop, container],
      alpha: 1,
      duration: this.tweenDuration,
      ease: "Quad.easeOut",
    });
  }

  async hide(): Promise<void> {
    if (!this.container && !this.backdrop) return;

    this.copyResetTimer?.remove(false);
    this.copyResetTimer = undefined;

    const container = this.container;
    const backdrop = this.backdrop;
    this.container = undefined;
    this.backdrop = undefined;

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: [backdrop, container].filter(Boolean) as Phaser.GameObjects.GameObject[],
        alpha: 0,
        duration: this.tweenDuration,
        ease: "Quad.easeIn",
        onComplete: () => {
          container?.destroy();
          backdrop?.destroy();
          resolve();
        },
      });
    });
  }

  private async handleCopy(targetUrl: string, label: Phaser.GameObjects.Text) {
    const copied = await this.copyToClipboard(targetUrl);
    label.setText(copied ? "Copied" : "Copy Failed");
    this.copyResetTimer?.remove(false);
    this.copyResetTimer = this.scene.time.delayedCall(1200, () => {
      if (label.active) {
        label.setText("Copy");
      }
      this.copyResetTimer = undefined;
    });
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (this.execFallbackCopy(text)) {
      return true;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private execFallbackCopy(text: string): boolean {
    if (typeof document === "undefined") return false;

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.padding = "0";
      textarea.style.border = "0";
      textarea.style.outline = "0";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.opacity = "0";
      textarea.style.fontSize = "16px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      activeElement?.focus?.({ preventScroll: true });
      return copied;
    } catch {
      return false;
    }
  }

  private destroyImmediate() {
    this.copyResetTimer?.remove(false);
    this.copyResetTimer = undefined;
    this.container?.destroy();
    this.backdrop?.destroy();
    this.container = undefined;
    this.backdrop = undefined;
  }
}
