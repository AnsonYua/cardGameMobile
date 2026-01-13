import type { SelectionActionController } from "../controllers/SelectionActionController";
import type { BoardUiControls } from "./boardUiSetup";

type UiBindingDeps = {
  controls: BoardUiControls;
  actionDispatcher: { dispatch: (index: number) => void };
  selectionAction?: SelectionActionController;
  showTrashArea: (owner: "opponent" | "player") => void;
  showDebugControls: () => void;
};

export function wireBoardUiHandlers(deps: UiBindingDeps) {
  deps.controls.actionControls?.setActionHandler((index) => deps.actionDispatcher.dispatch(index));
  deps.controls.handControls?.setCardClickHandler?.((card) => deps.selectionAction?.handleHandCardSelected(card));
  deps.controls.slotControls?.setSlotClickHandler?.((slot) => deps.selectionAction?.handleSlotCardSelected(slot));
  deps.controls.baseControls?.setBaseClickHandler?.((payload) => deps.selectionAction?.handleBaseCardSelected(payload));
  deps.controls.trashControls?.setTrashClickHandler?.((owner) => deps.showTrashArea(owner));
  deps.controls.headerControls?.setAvatarHandler(() => deps.showDebugControls());
}
