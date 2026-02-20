import type { PromptChoiceDialog } from "../../ui/PromptChoiceDialog";
import type { TutorTopDeckRevealDialog } from "../../ui/TutorTopDeckRevealDialog";
import { getTutorTopDeckRevealCards, isTutorTopDeckRevealPrompt } from "./TutorTopDeckRevealContext";

type DialogChoice = { index?: number; label?: string; enabled?: boolean };

type ShowPromptChoiceDialogParams = {
  entry: any;
  promptChoiceDialog?: PromptChoiceDialog | null;
  tutorTopDeckRevealDialog?: TutorTopDeckRevealDialog | null;
  onSubmit: (index: number) => Promise<void>;
  resolveTimeoutIndex: (options: any[]) => number;
};

export function hidePromptChoiceDialogs(params: {
  promptChoiceDialog?: PromptChoiceDialog | null;
  tutorTopDeckRevealDialog?: TutorTopDeckRevealDialog | null;
}) {
  params.promptChoiceDialog?.hide();
  params.tutorTopDeckRevealDialog?.hide();
}

export function isPromptChoiceDialogOpen(
  entry: any,
  dialogs: { promptChoiceDialog?: PromptChoiceDialog | null; tutorTopDeckRevealDialog?: TutorTopDeckRevealDialog | null },
): boolean {
  const useTutorRevealDialog = isTutorTopDeckRevealPrompt(entry?.data?.context);
  const activeDialog = useTutorRevealDialog ? dialogs.tutorTopDeckRevealDialog : dialogs.promptChoiceDialog;
  return !!activeDialog?.isOpen?.();
}

export function showPromptChoiceDialog(params: ShowPromptChoiceDialogParams) {
  const { entry } = params;
  const useTutorRevealDialog = isTutorTopDeckRevealPrompt(entry?.data?.context);
  const headerText = (entry?.data?.headerText ?? "Choose Option").toString();
  const promptText = (entry?.data?.promptText ?? "").toString();
  const options = Array.isArray(entry?.data?.availableOptions) ? entry.data.availableOptions : [];

  if (useTutorRevealDialog) {
    params.promptChoiceDialog?.hide();
    const continueIndex = params.resolveTimeoutIndex(options);
    const cards = getTutorTopDeckRevealCards(entry?.data?.context);
    params.tutorTopDeckRevealDialog?.show({
      headerText,
      promptText,
      cards,
      continueLabel: "Continue",
      showOverlay: true,
      showTimer: true,
      onContinue: async () => {
        await params.onSubmit(continueIndex);
      },
      onTimeout: async () => {
        await params.onSubmit(continueIndex);
      },
    });
    return;
  }

  params.tutorTopDeckRevealDialog?.hide();
  const buttons = options.map((o: DialogChoice) => ({
    label: (o?.label ?? "").toString() || `Option ${Number(o?.index ?? 0) + 1}`,
    enabled: o?.enabled !== false,
    onClick: async () => {
      await params.onSubmit(Number(o?.index ?? 0));
    },
  }));

  params.promptChoiceDialog?.show({
    headerText,
    promptText,
    buttons,
    showOverlay: true,
    showTimer: true,
    onTimeout: async () => {
      const idx = params.resolveTimeoutIndex(options);
      await params.onSubmit(idx);
    },
  });
}
