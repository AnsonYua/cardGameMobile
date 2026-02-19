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
    const popupW = 260;
    const desiredH = config.scenarioPicker ? 540 : 480;
    const popupH = Math.max(260, Math.min(desiredH, height - 40));
    const centerX = width / 2;
    const centerY = height / 2;

    this.backdrop = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.4).setDepth(this.depth - 1);
    this.backdrop.setAlpha(0).setInteractive();

    const bg = this.scene.add.rectangle(0, 0, popupW, popupH, 0x36d616, 1).setDepth(this.depth);
    const closeBtn = this.scene.add.circle(popupW / 2 - 18, -popupH / 2 + 18, 14, 0x00ffff, 1).setDepth(this.depth + 1);
    const closeLabel = this.scene.add
      .text(closeBtn.x, closeBtn.y, "X", { fontSize: "16px", fontFamily: "Arial", color: "#ff0000" })
      .setOrigin(0.5)
      .setDepth(this.depth + 2);

    closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());

    const buttonKeys = ["button1", "button2", "button3", "button4", "button5", "button6", "button7", "button8"] as const;
    const buttons = buttonKeys.map((key) => config[key]).filter(Boolean) as PopupButton[];
    const btnGap = 14;
    const btnH = 44;
    const btnW = popupW - 40;
    const btnObjs: Phaser.GameObjects.GameObject[] = [];
    const footerReserve = gameId ? 64 : 24;
    const btnBlockHeight = buttons.length > 0 ? buttons.length * btnH + (buttons.length - 1) * btnGap : 0;

    let yCursor = -popupH / 2 + 64;

    const picker = config.scenarioPicker;
    if (picker) {
      const title = this.scene.add
        .text(0, yCursor, picker.title ?? "Scenario", { fontSize: "16px", fontFamily: "Arial", color: "#000000" })
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      btnObjs.push(title);
      yCursor += 18;

      const wrapper = document.createElement("div");
      wrapper.style.width = `${btnW}px`;
      wrapper.style.height = "34px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.height = "32px";
      select.style.fontSize = "12px";
      select.style.padding = "0 6px";

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

      const dropdown = this.scene.add.dom(0, yCursor + 18, wrapper).setOrigin(0.5).setDepth(this.depth + 2);
      btnObjs.push(dropdown);

      yCursor += 60;
    }

    buttons.forEach((btn, idx) => {
      const y = yCursor + idx * (btnH + btnGap);
      const rect = this.scene.add.rectangle(0, y, btnW, btnH, 0x11a9ff, 0.1).setDepth(this.depth + 1);
      rect.setStrokeStyle(2, 0x0000ff, 1);
      const label = this.scene.add
        .text(0, y, btn.label, { fontSize: "18px", fontFamily: "Arial", color: "#ff0000" })
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      const handleClick = async () => {
        await this.hide();
        await Promise.resolve(btn.onClick?.());
      };
      rect.setInteractive({ useHandCursor: true }).on("pointerdown", handleClick);
      label.setInteractive({ useHandCursor: true }).on("pointerdown", handleClick);
      btnObjs.push(rect, label);
    });

    // Game ID footer
    if (gameId) {
      const footerY = popupH / 2 - 22;
      const footerBg = this.scene.add.rectangle(0, footerY, popupW - 24, 34, 0x000000, 0.1).setDepth(this.depth + 1);
      footerBg.setStrokeStyle(1, 0x00ff00, 0.8);
      const footerText = this.scene.add
        .text(0, footerY, `Game ID: ${gameId}`, { fontSize: "14px", fontFamily: "Arial", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      const handleCopyGameLink = () => {
        const joinUrl = this.buildJoinUrl({
          base: config.joinUrlBase,
          gameId,
          joinToken: config.joinToken,
          isAutoPolling: config.isAutoPolling
        });
        this.copyToClipboard(joinUrl);
        void this.hide();
      };
      footerBg.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      footerText.setInteractive({ useHandCursor: true }).on("pointerdown", handleCopyGameLink);
      btnObjs.push(footerBg, footerText);
    }

    this.container = this.scene.add.container(centerX, centerY, [bg, closeBtn, closeLabel, ...btnObjs]).setDepth(this.depth);
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
    url.searchParams.set("player", "opponent");
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
