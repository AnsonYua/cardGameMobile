import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { createPromptDialog } from "./PromptDialog";

export type AbilityChoiceDialogOption = {
  label: string;
  enabled?: boolean;
  onClick: () => Promise<void> | void;
};

export type AbilityChoiceDialogGroup = {
  title?: string;
  options: AbilityChoiceDialogOption[];
};

export type AbilityChoiceDialogOpts = {
  headerText?: string;
  promptText?: string;
  groups: AbilityChoiceDialogGroup[];
  onClose?: () => void;
};

type Row =
  | { kind: "title"; text: string }
  | { kind: "option"; option: AbilityChoiceDialogOption };

/**
 * Multi-option choice dialog (vertical list) used for ability activation selection.
 */
export class AbilityChoiceDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

  show(opts: AbilityChoiceDialogOpts) {
    this.destroy();
    const cam = this.scene.cameras.main;
    const headerText = opts.headerText ?? "Activate Effect";
    const promptText = opts.promptText ?? "Choose ability";

    const groups = (opts.groups ?? []).filter((g) => (g.options ?? []).length > 0);
    const rows: Row[] = [];
    groups.forEach((group) => {
      if (group.title && group.title.trim()) {
        rows.push({ kind: "title", text: group.title });
      }
      group.options.forEach((option) => rows.push({ kind: "option", option }));
    });
    if (!rows.length) {
      return;
    }

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
      wordWrap: { width: Math.min(520, cam.width * 0.8) },
    };
    const groupStyle = {
      fontSize: "14px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#cbd2dc",
      align: "left" as const,
    };

    const tempHeader = this.scene.add.text(-10000, -10000, headerText, headerStyle).setOrigin(0.5);
    const tempPrompt = promptText
      ? this.scene.add.text(-10000, -10000, promptText, promptStyle).setOrigin(0.5)
      : undefined;

    const rowGap = 10;
    const buttonHeight = 44;
    const titleHeight = 18;

    const promptHeight = tempPrompt?.height ?? 0;
    const rowsHeight =
      rows.reduce((sum, r) => sum + (r.kind === "title" ? titleHeight : buttonHeight), 0) +
      (rows.length > 1 ? rowGap * (rows.length - 1) : 0);
    const contentHeight = promptHeight + (promptHeight ? 14 : 0) + rowsHeight;

    const contentWidth = Math.min(520, cam.width * 0.82);
    const layout = computePromptDialogLayout(cam, this.cfg, {
      contentWidth,
      contentHeight,
      headerHeight: tempHeader.height,
      headerGap: 14,
    });
    tempHeader.destroy();
    tempPrompt?.destroy();

    const dialog = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay: true,
      closeOnBackdrop: true,
      showCloseButton: true,
      onClose: () => void this.hide(opts.onClose),
    });
    this.container = dialog.dialog;

    const headerHeight = dialog.header?.height ?? 0;
    const headerBottom = -layout.dialogHeight / 2 + layout.headerOffset + headerHeight / 2;
    const contentTop = headerBottom + (layout.headerGap ?? 14);
    const margin = this.cfg.dialog.margin;
    const buttonWidth = Math.max(240, layout.dialogWidth - margin * 2);

    const nodes: Phaser.GameObjects.GameObject[] = [];
    let cursorY = contentTop;
    if (promptText && promptText.trim()) {
      const prompt = this.scene.add.text(0, 0, promptText, promptStyle).setOrigin(0.5);
      prompt.setY(cursorY + prompt.height / 2);
      nodes.push(prompt);
      cursorY = prompt.y + prompt.height / 2 + 14;
    }

    rows.forEach((row, idx) => {
      if (idx > 0) cursorY += rowGap;
      if (row.kind === "title") {
        const label = this.scene.add.text(-buttonWidth / 2, cursorY, row.text, groupStyle).setOrigin(0, 0.5);
        nodes.push(label);
        cursorY += titleHeight;
        return;
      }

      const enabled = row.option.enabled !== false;
      const rect = this.scene.add.rectangle(0, cursorY + buttonHeight / 2, buttonWidth, buttonHeight, 0x2f3238, enabled ? 1 : 0.45);
      rect.setStrokeStyle(2, 0x5b6068, enabled ? 1 : 0.45);
      if (enabled) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await row.option.onClick();
        });
      }
      const txt = this.scene.add.text(0, rect.y, row.option.label, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: enabled ? "#f5f6f7" : "#98a0aa",
        align: "center",
        wordWrap: { width: buttonWidth - 18 },
      });
      txt.setOrigin(0.5);
      nodes.push(rect, txt);
      cursorY = rect.y + buttonHeight / 2;
    });

    dialog.content.add(nodes);
    animateDialogIn(this.scene, this.container);
  }

  showInfo(opts: { headerText?: string; message: string; onClose?: () => void }) {
    this.destroy();
    const headerText = opts.headerText ?? "Cannot Activate";
    const message = opts.message || "Not enough cost";
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      promptText: message,
      buttons: [
        {
          label: "OK",
          onClick: async () => {
            await this.hide(opts.onClose);
          },
        },
      ],
      showOverlay: true,
      closeOnBackdrop: true,
      showCloseButton: true,
      onClose: () => void this.hide(opts.onClose),
    });
    this.container = dialog.dialog;
    animateDialogIn(this.scene, this.container);
  }

  async hide(onClose?: () => void): Promise<void> {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    animateDialogOut(this.scene, target, () => {
      target.destroy();
      onClose?.();
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}
