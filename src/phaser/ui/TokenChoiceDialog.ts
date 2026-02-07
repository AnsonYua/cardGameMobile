import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { toBaseKey, toPreviewKey } from "./HandTypes";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { getDialogTimerHeaderGap } from "./timerBarStyles";

export type TokenChoiceDialogChoice = {
  index: number;
  label: string;
  cardId?: string;
  enabled?: boolean;
};

export type TokenChoiceDialogOptions = {
  headerText?: string;
  promptText?: string;
  choices: TokenChoiceDialogChoice[];
  showButtons?: boolean;
  showOverlay?: boolean;
  showTimer?: boolean;
  onSelect?: (index: number) => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

export class TokenChoiceDialog {
  private container?: Phaser.GameObjects.Container;
  private buttonTargets: Phaser.GameObjects.Rectangle[] = [];
  private dialogTimer: DialogTimerPresenter;
  private open = false;

  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3100, overlay: 3099 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  isOpen() {
    return this.open;
  }

  hide() {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    this.open = false;
    this.dialogTimer.stop();
    this.buttonTargets.forEach((btn) => btn.disableInteractive());
    this.buttonTargets = [];
    animateDialogOut(this.scene, target, () => target.destroy());
  }

  show(opts: TokenChoiceDialogOptions) {
    this.destroy();
    const cam = this.scene.cameras.main;
    const headerText = opts.headerText ?? "Deploy Token";
    const promptText = opts.promptText ?? "";
    const hasPrompt = promptText.trim().length > 0;
    const showButtons = opts.showButtons ?? false;
    const showOverlay = opts.showOverlay ?? true;
    const showTimer = opts.showTimer ?? false;
    const choices = Array.isArray(opts.choices) ? opts.choices : [];

    const headerStyle = {
      fontSize: `${this.cfg.dialog.headerFontSize ?? 20}px`,
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center" as const,
    };
    const promptStyle = {
      fontSize: "16px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center" as const,
      wordWrap: { width: Math.min(520, cam.width * 0.82) },
    };

    const tempHeader = this.scene.add.text(-10000, -10000, headerText, headerStyle).setOrigin(0.5);
    const tempPrompt = hasPrompt
      ? this.scene.add.text(-10000, -10000, promptText, promptStyle).setOrigin(0.5)
      : undefined;

    const choiceHeight = 128;
    const choiceGap = 16;
    const promptHeight = tempPrompt?.height ?? 0;
    const promptGap = 14;
    const listHeight = showButtons
      ? choices.length * choiceHeight + Math.max(0, choices.length - 1) * choiceGap
      : 22;
    const contentHeight = promptHeight + (hasPrompt ? promptGap : 0) + listHeight;

    const contentWidth = Math.min(560, cam.width * 0.86);
    const layout = computePromptDialogLayout(cam, this.cfg, {
      contentWidth,
      contentHeight,
      headerHeight: tempHeader.height,
      headerGap: showTimer ? getDialogTimerHeaderGap() : 14,
    });
    tempHeader.destroy();
    tempPrompt?.destroy();

    const shell = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.container = shell.dialog;
    this.open = true;

    const headerHeightPx = shell.header?.height ?? 0;
    const headerBottom = -layout.dialogHeight / 2 + layout.headerOffset + headerHeightPx / 2;
    const contentTop = headerBottom + (layout.headerGap ?? 14);

    const nodes: Phaser.GameObjects.GameObject[] = [];
    const prompt = hasPrompt ? this.scene.add.text(0, 0, promptText, promptStyle).setOrigin(0.5) : undefined;
    if (prompt) {
      prompt.setY(contentTop + prompt.height / 2);
      nodes.push(prompt);
    }

    const listStartY = prompt ? prompt.y + prompt.height / 2 + promptGap : contentTop;
    const margin = this.cfg.dialog.margin;
    const buttonWidth = Math.max(240, Math.min(560, layout.dialogWidth - margin * 2));

    if (!showButtons) {
      const msg = this.scene.add.text(0, listStartY + 10, "Opponent is deciding...", {
        fontSize: "16px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: buttonWidth },
      });
      msg.setOrigin(0.5, 0);
      nodes.push(msg);
      shell.content.add(nodes);
      animateDialogIn(this.scene, shell.dialog);
      return;
    }

    let cursorY = listStartY + choiceHeight / 2;
    choices.forEach((choice) => {
      const enabled = choice.enabled !== false;
      const rect = this.scene.add.rectangle(0, cursorY, buttonWidth, choiceHeight, 0x2f3238, enabled ? 1 : 0.45);
      rect.setStrokeStyle(2, 0x5b6068, enabled ? 1 : 0.45);
      if (enabled) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await opts.onSelect?.(choice.index);
        });
      }
      nodes.push(rect);

      const texKey = this.resolveTextureKey(choice.cardId);
      if (texKey) {
        const img = this.scene.add.image(0, cursorY, texKey).setOrigin(0.5);
        const tex = this.scene.textures.get(texKey);
        const src: any = tex?.getSourceImage?.();
        const w = Number(src?.width ?? img.width ?? 0) || 1;
        const h = Number(src?.height ?? img.height ?? 0) || 1;
        const maxW = buttonWidth - 28;
        const maxH = choiceHeight - 18;
        const scale = Math.min(maxW / w, maxH / h);
        img.setScale(scale);
        nodes.push(img);
      } else if (choice.cardId) {
        const fallback = this.scene.add.text(0, cursorY, choice.cardId, {
          fontSize: "16px",
          fontFamily: "Arial",
          fontStyle: "bold",
          color: enabled ? "#f5f6f7" : "#98a0aa",
          align: "center",
        });
        fallback.setOrigin(0.5);
        nodes.push(fallback);
      }
      this.buttonTargets.push(rect);
      cursorY += choiceHeight + choiceGap;
    });

    shell.content.add(nodes);
    if (showTimer) {
      this.dialogTimer.attach(shell.dialog, layout, async () => {
        await opts.onTimeout?.();
      });
    }
    animateDialogIn(this.scene, shell.dialog);
  }

  private destroy() {
    this.dialogTimer.stop();
    this.buttonTargets.forEach((btn) => btn.disableInteractive());
    this.buttonTargets = [];
    this.container?.destroy();
    this.container = undefined;
    this.open = false;
  }

  private resolveTextureKey(cardId?: string) {
    if (!cardId) return undefined;
    const preview = toPreviewKey(cardId);
    if (preview && this.scene.textures.exists(preview)) return preview;
    const base = toBaseKey(cardId);
    if (base && this.scene.textures.exists(base)) return base;
    return undefined;
  }
}
