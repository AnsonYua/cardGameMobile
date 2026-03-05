import type Phaser from "phaser";
import type { CardDialogConfig } from "../CardDialogLayout";
import { DEFAULT_CARD_DIALOG_CONFIG } from "../CardDialogLayout";
import { TimedPromptDialog } from "../TimedPromptDialog";
import type { TurnTimerController } from "../../controllers/TurnTimerController";

type BinaryTimedChoiceOptions = {
  headerText: string;
  promptText?: string;
  leftLabel: string;
  rightLabel: string;
  onLeft?: () => Promise<void> | void;
  onRight?: () => Promise<void> | void;
  timeoutChoice: "left" | "right";
  showOverlay?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  headerFontSize?: number;
  headerGap?: number;
};

export class BinaryTimedChoiceDialog {
  private prompt: TimedPromptDialog<boolean>;

  constructor(
    scene: Phaser.Scene,
    timerController?: TurnTimerController,
    cfg: CardDialogConfig = DEFAULT_CARD_DIALOG_CONFIG,
  ) {
    this.prompt = new TimedPromptDialog<boolean>(scene, timerController, cfg);
  }

  async showPrompt(opts: BinaryTimedChoiceOptions): Promise<boolean> {
    const timeoutResult = opts.timeoutChoice === "left";
    const timeoutHandler = opts.timeoutChoice === "left" ? opts.onLeft : opts.onRight;
    return this.prompt.showPrompt({
      headerText: opts.headerText,
      promptText: opts.promptText ?? "",
      buttons: [
        { label: opts.leftLabel, result: true, onClick: opts.onLeft },
        { label: opts.rightLabel, result: false, onClick: opts.onRight },
      ],
      timeoutResult,
      onTimeout: timeoutHandler,
      showOverlay: opts.showOverlay,
      closeOnBackdrop: opts.closeOnBackdrop,
      showCloseButton: opts.showCloseButton,
      headerFontSize: opts.headerFontSize,
      headerGap: opts.headerGap,
    });
  }

  getAutomationState() {
    return this.prompt.getAutomationState();
  }

  async choose(index: 0 | 1): Promise<boolean> {
    return this.prompt.choose(index);
  }
}

