import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";

export type BurstChoiceGroupRow = {
  id: string;
  label: string;
  enabled?: boolean;
  done?: boolean;
  onClick?: () => Promise<void> | void;
};

export type BurstChoiceGroupDialogOpts = {
  headerText?: string;
  promptText?: string;
  rows: BurstChoiceGroupRow[];
};

/**
 * Non-dismissable list dialog for choosing which burst to resolve in a group.
 */
export class BurstChoiceGroupDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 4000 },
  };

  constructor(private scene: Phaser.Scene) {}

  isOpen() {
    return !!this.container;
  }

  show(opts: BurstChoiceGroupDialogOpts) {
    this.destroy();
    const cam = this.scene.cameras.main;
    const headerText = opts.headerText ?? "Resolve Burst Effects";
    const promptText = opts.promptText ?? "Choose a burst effect to resolve";
    const rows = (opts.rows ?? []).filter((r) => !!r && !!r.label);
    if (!rows.length) return;

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
      wordWrap: { width: Math.min(560, cam.width * 0.86) },
    };

    const tempHeader = this.scene.add.text(-10000, -10000, headerText, headerStyle).setOrigin(0.5);
    const tempPrompt = promptText
      ? this.scene.add.text(-10000, -10000, promptText, promptStyle).setOrigin(0.5)
      : undefined;

    const rowGap = 10;
    const rowHeight = 52;
    const promptHeight = tempPrompt?.height ?? 0;
    const rowsHeight = rows.length * rowHeight + (rows.length > 1 ? rowGap * (rows.length - 1) : 0);
    const contentHeight = promptHeight + (promptHeight ? 14 : 0) + rowsHeight;

    const contentWidth = Math.min(560, cam.width * 0.88);
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
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.container = dialog.dialog;

    const headerHeight = dialog.header?.height ?? 0;
    const headerBottom = -layout.dialogHeight / 2 + layout.headerOffset + headerHeight / 2;
    const contentTop = headerBottom + (layout.headerGap ?? 14);

    const margin = this.cfg.dialog.margin;
    const rowWidth = Math.max(280, layout.dialogWidth - margin * 2);

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
      const done = row.done === true;
      const enabled = row.enabled !== false && !done;
      const bgAlpha = done ? 0.32 : enabled ? 1 : 0.45;
      const strokeAlpha = done ? 0.22 : enabled ? 1 : 0.45;
      const rect = this.scene.add.rectangle(0, cursorY + rowHeight / 2, rowWidth, rowHeight, 0x2f3238, bgAlpha);
      rect.setStrokeStyle(2, 0x5b6068, strokeAlpha);
      if (enabled && row.onClick) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await row.onClick?.();
        });
      }
      const statusSuffix = done ? " (Done)" : "";
      const txt = this.scene.add.text(0, rect.y, `${row.label}${statusSuffix}`, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: done ? "#8d96a0" : enabled ? "#f5f6f7" : "#98a0aa",
        align: "center",
        wordWrap: { width: rowWidth - 20 },
      });
      txt.setOrigin(0.5);
      nodes.push(rect, txt);
      cursorY = rect.y + rowHeight / 2;
    });

    dialog.content.add(nodes);
    animateDialogIn(this.scene, this.container);
  }

  async hide(): Promise<void> {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    animateDialogOut(this.scene, target, () => {
      target.destroy();
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}

