import Phaser from "phaser";

type PopupButton = { label: string; onClick?: () => void };
type ScenarioPickerConfig = {
  title?: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
};

export type TestButtonPopupConfig = Partial<
  Record<"button1" | "button2" | "button3" | "button4" | "button5" | "button6" | "button7" | "button8", PopupButton>
> & {
  gameId?: string;
  joinToken?: string;
  isAutoPolling?: boolean;
  joinUrlBase?: string;
  scenarioPicker?: ScenarioPickerConfig;
};

export class TestButtonPopup {
  private container?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private depth = 6000;
  private tweenDuration = 200;

  constructor(private scene: Phaser.Scene) {}

  show(config: TestButtonPopupConfig) {
    this.hide();
    const { width, height } = this.scene.scale;
    const { gameId } = config;
    const buttonKeys = ["button1", "button2", "button3", "button4", "button5", "button6", "button7", "button8"] as const;
    const buttons = buttonKeys.map((key) => config[key]).filter(Boolean) as PopupButton[];

    const baseButtonH = 42;
    const baseGap = 10;
    const buttonBlockH = buttons.length > 0 ? buttons.length * baseButtonH + (buttons.length - 1) * baseGap : 0;
    const pickerBlockH = config.scenarioPicker ? 76 : 0;
    const footerBlockH = gameId ? 72 : 26;
    const desiredH = 116 + pickerBlockH + buttonBlockH + footerBlockH;

    const popupW = Math.max(300, Math.min(380, width - 24));
    const popupH = Math.max(340, Math.min(desiredH, height - 18));
    const centerX = width / 2;
    const centerY = height / 2;

    this.backdrop = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.44).setDepth(this.depth - 1);
    this.backdrop.setAlpha(0).setInteractive();

    const drawRounded = (
      g: Phaser.GameObjects.Graphics,
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number,
      fillColor: number,
      fillAlpha: number,
      strokeColor?: number,
      strokeAlpha = 1,
      strokeWidth = 1,
    ) => {
      g.clear();
      g.fillStyle(fillColor, fillAlpha);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
      if (strokeColor !== undefined && strokeWidth > 0) {
        g.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
      }
    };

    const bgShadow = this.scene.add.graphics().setDepth(this.depth);
    drawRounded(bgShadow, 0, 4, popupW + 10, popupH + 12, 24, 0x000000, 0.34);

    const bg = this.scene.add.graphics().setDepth(this.depth + 1);
    drawRounded(bg, 0, 0, popupW, popupH, 20, 0x3a3d42, 0.96, 0x5b6068, 1, 2);
    const inner = this.scene.add.graphics().setDepth(this.depth + 2);
    drawRounded(inner, 0, 0, popupW - 14, popupH - 14, 16, 0x2f3238, 0.45);

    const headerY = -popupH / 2 + 30;
    const title = this.scene.add
      .text(-popupW / 2 + 16, headerY, "Debug Controls", {
        fontSize: "18px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
      })
      .setOrigin(0, 0.5)
      .setDepth(this.depth + 4);

    const closeBtn = this.scene.add.circle(popupW / 2 - 20, headerY, 14, 0x4a4f57, 0.95).setDepth(this.depth + 4);
    closeBtn.setStrokeStyle(1, 0x6f7680, 0.92);
    const closeLabel = this.scene.add
      .text(closeBtn.x, closeBtn.y - 1, "×", { fontSize: "22px", fontFamily: "Arial", color: "#f5f6f7" })
      .setOrigin(0.5)
      .setDepth(this.depth + 5);

    closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeBtn.on("pointerover", () => closeBtn.setFillStyle(0x5b6068, 1));
    closeBtn.on("pointerout", () => closeBtn.setFillStyle(0x4a4f57, 0.95));

    let btnGap = 10;
    let btnH = 42;
    const minBtnH = 34;
    const minGap = 6;
    const maxGap = 14;
    const btnW = popupW - 36;
    const btnObjs: Phaser.GameObjects.GameObject[] = [];
    const footerReserve = gameId ? 78 : 24;
    const sectionGap = 14;

    let yTop = -popupH / 2 + 58;

    const picker = config.scenarioPicker;
    if (picker) {
      const title = this.scene.add
        .text(-btnW / 2, yTop, picker.title ?? "Scenario", {
          fontSize: "13px",
          fontFamily: "Arial",
          fontStyle: "bold",
          color: "#f5f6f7",
        })
        .setOrigin(0, 0)
        .setDepth(this.depth + 4);
      btnObjs.push(title);
      yTop += 24;

      const pickerH = 38;
      const pickerY = yTop + pickerH / 2;
      const pickerBg = this.scene.add.graphics().setDepth(this.depth + 2);
      drawRounded(pickerBg, 0, pickerY, btnW, pickerH, 10, 0x32363d, 0.96, 0x5b6068, 1, 1);
      btnObjs.push(pickerBg);

      const wrapper = document.createElement("div");
      wrapper.style.width = `${btnW - 12}px`;
      wrapper.style.height = "32px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.height = "32px";
      select.style.fontSize = "12px";
      select.style.borderRadius = "8px";
      select.style.border = "1px solid rgba(91, 96, 104, 0.98)";
      select.style.background = "rgba(47, 50, 56, 0.98)";
      select.style.color = "#f5f6f7";
      select.style.padding = "0 8px";
      select.style.outline = "none";
      select.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,0.04)";

      picker.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.text = opt;
        select.appendChild(option);
      });
      if (picker.value && picker.options.includes(picker.value)) {
        select.value = picker.value;
      }
      select.addEventListener("change", () => picker.onChange?.(select.value));
      wrapper.appendChild(select);

      const dropdown = this.scene.add.dom(0, pickerY, wrapper).setOrigin(0.5).setDepth(this.depth + 4);
      btnObjs.push(dropdown);
      yTop += pickerH + sectionGap;
    }

    const maxButtonsBottom = popupH / 2 - footerReserve;
    if (buttons.length > 0) {
      const gapCount = Math.max(0, buttons.length - 1);
      const maxBlock = maxButtonsBottom - yTop;
      const targetBtnH = Math.floor((maxBlock - gapCount * btnGap) / buttons.length);
      if (targetBtnH < btnH) {
        btnH = Math.max(minBtnH, targetBtnH);
      }
      let blockHeight = buttons.length * btnH + gapCount * btnGap;
      if (blockHeight > maxBlock && gapCount > 0) {
        btnGap = Math.max(minGap, Math.floor((maxBlock - buttons.length * btnH) / gapCount));
        blockHeight = buttons.length * btnH + gapCount * btnGap;
      }
      const remaining = maxBlock - blockHeight;
      if (remaining > 0 && gapCount > 0) {
        const gapBoost = Math.min(maxGap - btnGap, Math.floor(remaining / gapCount));
        if (gapBoost > 0) {
          btnGap += gapBoost;
          blockHeight = buttons.length * btnH + gapCount * btnGap;
        }
      }
      const finalRemaining = maxBlock - blockHeight;
      if (finalRemaining > sectionGap) {
        yTop += Math.min(20, Math.floor((finalRemaining - sectionGap) / 2));
      }
    }

    buttons.forEach((btn, idx) => {
      const y = yTop + btnH / 2 + idx * (btnH + btnGap);
      const rect = this.scene.add.graphics().setDepth(this.depth + 2);
      drawRounded(rect, 0, y, btnW, btnH, 10, 0x353a43, 0.96, 0x5b6068, 1, 1);
      const label = this.scene.add
        .text(0, y, btn.label, {
          fontSize: "15px",
          fontFamily: "Arial",
          color: "#f5f6f7",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 4);

      const hit = this.scene.add.rectangle(0, y, btnW, btnH, 0x000000, 0.001).setDepth(this.depth + 5);
      hit.setInteractive({ useHandCursor: true });

      const handleClick = async () => {
        await this.hide();
        await Promise.resolve(btn.onClick?.());
      };
      hit.on("pointerdown", handleClick);
      hit.on("pointerover", () => {
        drawRounded(rect, 0, y, btnW, btnH, 10, 0x404651, 1, 0x7b8591, 1, 1);
        label.setColor("#ffffff");
      });
      hit.on("pointerout", () => {
        drawRounded(rect, 0, y, btnW, btnH, 10, 0x353a43, 0.96, 0x5b6068, 1, 1);
        label.setColor("#f5f6f7");
      });
      btnObjs.push(rect, label, hit);
    });

    // Game ID footer
    if (gameId) {
      const footerY = popupH / 2 - 30;
      const footerW = popupW - 22;
      const footerH = 48;
      const footerBg = this.scene.add.graphics().setDepth(this.depth + 2);
      drawRounded(footerBg, 0, footerY, footerW, footerH, 10, 0x2f3238, 0.96, 0x5b6068, 1, 1);
      const footerText = this.scene.add
        .text(0, footerY, `Game ID: ${gameId}\nTap to copy join link`, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: "#f5f6f7",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 4);
      const handleCopyGameLink = () => {
        const joinUrl = this.buildJoinUrl({
          base: config.joinUrlBase,
          gameId,
          joinToken: config.joinToken,
          isAutoPolling: config.isAutoPolling,
        });
        this.copyToClipboard(joinUrl);
        void this.hide();
      };
      const footerHit = this.scene.add.rectangle(0, footerY, footerW, footerH, 0x000000, 0.001).setDepth(this.depth + 5);
      footerHit.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      footerText.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      footerHit.on("pointerover", () => drawRounded(footerBg, 0, footerY, footerW, footerH, 10, 0x404651, 1, 0x7b8591, 1, 1));
      footerHit.on("pointerout", () => drawRounded(footerBg, 0, footerY, footerW, footerH, 10, 0x2f3238, 0.96, 0x5b6068, 1, 1));
      btnObjs.push(footerBg, footerText, footerHit);
    }

    this.container = this.scene.add
      .container(centerX, centerY, [bgShadow, bg, inner, title, closeBtn, closeLabel, ...btnObjs])
      .setDepth(this.depth);
    this.container.setAlpha(0);

    this.scene.tweens.add({
      targets: [this.backdrop, this.container],
      alpha: 1,
      duration: this.tweenDuration,
      ease: "Quad.easeOut",
    });
  }

  async hide(): Promise<void> {
    if (!this.container && !this.backdrop) return;
    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: [this.backdrop, this.container].filter(Boolean) as any[],
        alpha: 0,
        duration: this.tweenDuration,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.container?.destroy();
          this.backdrop?.destroy();
          this.container = undefined;
          this.backdrop = undefined;
          resolve();
        },
      });
    });
  }

  private copyToClipboard(text: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => this.execFallbackCopy(text));
      return;
    }
    this.execFallbackCopy(text);
  }

  private buildJoinUrl(opts: { base?: string; gameId: string; joinToken?: string; isAutoPolling?: boolean }): string {
    const origin =
      opts.base ??
      (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:5173");
    const url = new URL("/game", origin);
    url.searchParams.set("mode", "join");
    url.searchParams.set("gameId", opts.gameId);
    url.searchParams.set("isAutoPolling", String(opts.isAutoPolling ?? true));
    if (opts.joinToken) url.searchParams.set("joinToken", opts.joinToken);
    return url.toString();
  }

  private execFallbackCopy(text: string) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch {
      // no-op
    }
  }
}
