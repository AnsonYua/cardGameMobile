import Phaser from "phaser";
import { createTestButtonPopupView } from "./TestButtonPopupView";
import type { TestButtonPopupConfig } from "./TestButtonPopupTypes";

export type { TestButtonPopupConfig } from "./TestButtonPopupTypes";

export class TestButtonPopup {
  private container?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private depth = 6000;
  private tweenDuration = 200;

  constructor(private scene: Phaser.Scene) {}

  show(config: TestButtonPopupConfig) {
    this.hide();
    const view = createTestButtonPopupView({
      scene: this.scene,
      depth: this.depth,
      tweenDuration: this.tweenDuration,
      config,
      onHide: () => this.hide(),
      onButtonClick: (action) => this.runButtonAction(action),
      onCopyGameLink: () => this.handleCopyGameLink(config),
    });

    this.backdrop = view.backdrop;
    this.container = view.container;
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

  private async runButtonAction(action?: () => void) {
    await this.hide();
    await Promise.resolve(action?.());
  }

  private handleCopyGameLink(config: TestButtonPopupConfig) {
    if (!config.gameId) return;
    const joinUrl = this.buildJoinUrl({
      base: config.joinUrlBase,
      gameId: config.gameId,
      joinToken: config.joinToken,
      isAutoPolling: config.isAutoPolling,
    });
    this.copyToClipboard(joinUrl);
    void this.hide();
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
