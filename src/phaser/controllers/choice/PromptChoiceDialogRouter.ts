import type { PromptChoiceDialog } from "../../ui/PromptChoiceDialog";
import type { TopDeckSelectionReviewDialog } from "../../ui/TopDeckSelectionReviewDialog";
import { getTopDeckSelectionReviewCards, isTopDeckSelectionReviewPrompt } from "./TopDeckSelectionReviewContext";
import { withTopDeckSelectionReviewStepHeader } from "./TopDeckSelectionStepHeader";
import { mapOptionChoiceToDialogView } from "./OptionChoiceViewMapper";

type DialogChoice = { index?: number; label?: string; enabled?: boolean };

type ShowPromptChoiceDialogParams = {
  entry: any;
  rawSnapshot?: any;
  promptChoiceDialog?: PromptChoiceDialog | null;
  topDeckSelectionReviewDialog?: TopDeckSelectionReviewDialog | null;
  onSubmit: (index: number) => Promise<void>;
  resolveTimeoutIndex: (options: any[]) => number;
};

export function hidePromptChoiceDialogs(params: {
  promptChoiceDialog?: PromptChoiceDialog | null;
  topDeckSelectionReviewDialog?: TopDeckSelectionReviewDialog | null;
}) {
  params.promptChoiceDialog?.hide();
  params.topDeckSelectionReviewDialog?.hide();
}

export function isPromptChoiceDialogOpen(
  entry: any,
  dialogs: { promptChoiceDialog?: PromptChoiceDialog | null; topDeckSelectionReviewDialog?: TopDeckSelectionReviewDialog | null },
): boolean {
  const useTopDeckSelectionReviewDialog = isTopDeckSelectionReviewPrompt(entry?.data?.context);
  const activeDialog = useTopDeckSelectionReviewDialog ? dialogs.topDeckSelectionReviewDialog : dialogs.promptChoiceDialog;
  return !!activeDialog?.isOpen?.();
}

export function showPromptChoiceDialog(params: ShowPromptChoiceDialogParams) {
  const { entry } = params;
  const useTopDeckSelectionReviewDialog = isTopDeckSelectionReviewPrompt(entry?.data?.context);
  const rawHeaderText = (entry?.data?.headerText ?? "Choose Option").toString();
  const promptText = (entry?.data?.promptText ?? "").toString();
  const options = Array.isArray(entry?.data?.availableOptions) ? entry.data.availableOptions : [];

  if (useTopDeckSelectionReviewDialog) {
    params.promptChoiceDialog?.hide();
    const continueIndex = params.resolveTimeoutIndex(options);
    const cards = getTopDeckSelectionReviewCards(entry?.data?.context);
    const headerText = withTopDeckSelectionReviewStepHeader(rawHeaderText, entry?.data?.context);
    params.topDeckSelectionReviewDialog?.show({
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

  params.topDeckSelectionReviewDialog?.hide();
  const buttons = options.map((o: DialogChoice) => ({
    label: (o?.label ?? "").toString() || `Option ${Number(o?.index ?? 0) + 1}`,
    enabled: o?.enabled !== false && o?.disabled !== true,
    onClick: async () => {
      await params.onSubmit(Number(o?.index ?? 0));
    },
  }));
  const mappedChoices = options.map((o: any) => mapOptionChoiceToDialogView(params.rawSnapshot ?? entry, o));
  const optionActions = options.map((o: any) => ({
    index: Number(o?.index ?? 0),
    action: (o?.payload?.action ?? "").toString() || undefined,
  }));
  const hasCardChoice = mappedChoices.some((choice) => choice.mode === "card" && !!choice.cardId);

  params.promptChoiceDialog?.show({
    headerText: rawHeaderText,
    promptText,
    buttons,
    choices: hasCardChoice ? mappedChoices : undefined,
    optionActions,
    showOverlay: true,
    showTimer: true,
    onTimeout: async () => {
      const idx = params.resolveTimeoutIndex(options);
      await params.onSubmit(idx);
    },
  });
}
