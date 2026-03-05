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

    const popupW = Math.max(280, Math.min(360, width - 24));
    const popupH = Math.max(320, Math.min(desiredH, height - 20));
    const centerX = width / 2;
    const centerY = height / 2;

    this.backdrop = this.scene.add.rectangle(centerX, centerY, width, height, 0x020817, 0.64).setDepth(this.depth - 1);
    this.backdrop.setAlpha(0).setInteractive();

    const bgShadow = this.scene.add.rectangle(0, 4, popupW + 8, popupH + 10, 0x000000, 0.36).setDepth(this.depth);
    const bg = this.scene.add.rectangle(0, 0, popupW, popupH, 0x0f172a, 0.97).setDepth(this.depth + 1);
    bg.setStrokeStyle(2, 0x7dd3fc, 0.45);

    const headerY = -popupH / 2 + 24;
    const headerBar = this.scene.add.rectangle(0, headerY, popupW - 14, 40, 0x13233f, 0.94).setDepth(this.depth + 2);
    headerBar.setStrokeStyle(1, 0x8ce7ff, 0.4);
    const headerSheen = this.scene.add.rectangle(0, headerY - 7, popupW - 18, 12, 0xa5f3fc, 0.1).setDepth(this.depth + 3);
    const title = this.scene.add
      .text(-popupW / 2 + 16, headerY, "Debug Controls", {
        fontSize: "18px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#e7f8ff",
      })
      .setOrigin(0, 0.5)
      .setDepth(this.depth + 4);

    const closeBtn = this.scene.add.circle(popupW / 2 - 20, headerY, 14, 0x244060, 0.95).setDepth(this.depth + 4);
    closeBtn.setStrokeStyle(1, 0x9eeaff, 0.75);
    const closeLabel = this.scene.add
      .text(closeBtn.x, closeBtn.y - 1, "×", { fontSize: "22px", fontFamily: "Arial", color: "#effcff" })
      .setOrigin(0.5)
      .setDepth(this.depth + 5);

    closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeBtn.on("pointerover", () => closeBtn.setFillStyle(0x33557e, 1));
    closeBtn.on("pointerout", () => closeBtn.setFillStyle(0x244060, 0.95));

    let btnGap = 10;
    let btnH = 42;
    const minBtnH = 34;
    const minGap = 6;
    const maxGap = 14;
    const btnW = popupW - 32;
    const btnObjs: Phaser.GameObjects.GameObject[] = [];
    const footerReserve = gameId ? 72 : 24;
    const sectionGap = 14;

    let yCursor = -popupH / 2 + 70;

    const picker = config.scenarioPicker;
    if (picker) {
      const title = this.scene.add
        .text(-btnW / 2, yCursor, picker.title ?? "Scenario", {
          fontSize: "13px",
          fontFamily: "Arial",
          fontStyle: "bold",
          color: "#bcefff",
        })
        .setOrigin(0, 0.5)
        .setDepth(this.depth + 4);
      btnObjs.push(title);
      yCursor += 28;

      const pickerBg = this.scene.add.rectangle(0, yCursor, btnW, 36, 0x11243d, 0.92).setDepth(this.depth + 2);
      pickerBg.setStrokeStyle(1, 0x8ce7ff, 0.55);
      btnObjs.push(pickerBg);

      const wrapper = document.createElement("div");
      wrapper.style.width = `${btnW - 10}px`;
      wrapper.style.height = "30px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.height = "30px";
      select.style.fontSize = "12px";
      select.style.borderRadius = "6px";
      select.style.border = "1px solid rgba(136, 232, 255, 0.55)";
      select.style.background = "rgba(9, 24, 43, 0.9)";
      select.style.color = "#e8f9ff";
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

      const dropdown = this.scene.add.dom(0, yCursor, wrapper).setOrigin(0.5).setDepth(this.depth + 4);
      btnObjs.push(dropdown);
      yCursor += 36 + sectionGap;
    }

    const maxButtonsBottom = popupH / 2 - footerReserve;
    if (buttons.length > 0) {
      const gapCount = Math.max(0, buttons.length - 1);
      const maxBlock = maxButtonsBottom - yCursor;
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
        yCursor += Math.min(20, Math.floor((finalRemaining - sectionGap) / 2));
      }
    }

    buttons.forEach((btn, idx) => {
      const y = yCursor + idx * (btnH + btnGap);
      const rect = this.scene.add.rectangle(0, y, btnW, btnH, 0x12253f, 0.92).setDepth(this.depth + 2);
      rect.setStrokeStyle(1, 0x79e4ff, 0.62);
      const accent = this.scene.add.rectangle(-btnW / 2 + 4, y, 6, btnH - 8, 0x7dd3fc, 0.86).setDepth(this.depth + 3);
      const label = this.scene.add
        .text(0, y, btn.label, {
          fontSize: "15px",
          fontFamily: "Arial",
          color: "#ecfaff",
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
        rect.setFillStyle(0x18365a, 0.97);
        rect.setStrokeStyle(1, 0x9fe9ff, 0.95);
        accent.setFillStyle(0xa5f3fc, 1);
        label.setColor("#ffffff");
      });
      hit.on("pointerout", () => {
        rect.setFillStyle(0x12253f, 0.92);
        rect.setStrokeStyle(1, 0x79e4ff, 0.62);
        accent.setFillStyle(0x7dd3fc, 0.86);
        label.setColor("#ecfaff");
      });
      btnObjs.push(rect, accent, label, hit);
    });

    // Game ID footer
    if (gameId) {
      const footerY = popupH / 2 - 30;
      const footerBg = this.scene.add.rectangle(0, footerY, popupW - 22, 46, 0x0f2138, 0.94).setDepth(this.depth + 2);
      footerBg.setStrokeStyle(1, 0x85e9ff, 0.7);
      const footerText = this.scene.add
        .text(0, footerY, `Game ID: ${gameId}\nTap to copy join link`, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: "#dff8ff",
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
      footerBg.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      footerText.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      footerBg.on("pointerover", () => footerBg.setFillStyle(0x143055, 0.96));
      footerBg.on("pointerout", () => footerBg.setFillStyle(0x0f2138, 0.94));
      btnObjs.push(footerBg, footerText);
    }

    this.container = this.scene.add
      .container(centerX, centerY, [bgShadow, bg, headerBar, headerSheen, title, closeBtn, closeLabel, ...btnObjs])
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
