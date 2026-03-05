import type { PromptDialogButton } from "../ui/PromptDialog";
import type { SessionInitErrorSpec } from "./SessionErrorMapper";

const DEFAULT_CREATE_ROOM_URL = "/game?mode=host&isAutoPolling=true&automation=1";

const executeAction = (action: SessionInitErrorSpec["actions"][number]) => {
  if (typeof window === "undefined") return;
  if (action.reload) {
    window.location.reload();
    return;
  }
  if (action.createRoom) {
    window.location.href = DEFAULT_CREATE_ROOM_URL;
    return;
  }
  if (action.href) {
    window.location.href = action.href;
  }
};

export const toSessionInitDialogButtons = (spec: SessionInitErrorSpec): PromptDialogButton[] =>
  spec.actions.map((action) => ({
    label: action.label,
    onClick: async () => {
      executeAction(action);
    },
  }));
