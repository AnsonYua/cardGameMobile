import type { BoardUI } from "./BoardUI";

export class UIVisibilityController {
  constructor(private ui: BoardUI) {}

  hide() {
    const base = this.ui.getBaseControls();
    const energy = this.ui.getEnergyControls();
    const status = this.ui.getStatusControls();
    const hand = this.ui.getHandControls();
    const actions = this.ui.getActionControls();
    base?.setBaseTowerVisible(true, false);
    base?.setBaseTowerVisible(false, false);
    energy?.setVisible(false);
    status?.setVisible(false);
    hand?.setVisible(false);
    actions?.setVisible(false);
  }

  show() {
    const base = this.ui.getBaseControls();
    const energy = this.ui.getEnergyControls();
    const status = this.ui.getStatusControls();
    const hand = this.ui.getHandControls();
    const actions = this.ui.getActionControls();
    base?.setBaseTowerVisible(true, true);
    base?.setBaseTowerVisible(false, true);
    energy?.setVisible(true);
    status?.setVisible(true);
    hand?.setVisible(true);
    energy?.fadeIn();
    status?.fadeIn();
    hand?.fadeIn();
    actions?.setVisible(true);
    //actions?.fadeIn?.();
  }
}
