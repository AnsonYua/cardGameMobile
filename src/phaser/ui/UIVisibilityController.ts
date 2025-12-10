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
    this.showInternal({ fade: true, toggleBase: true });
  }

  showWithoutFade() {
    this.showInternal({ fade: false, toggleBase: false });
  }

  private showInternal(opts: { fade: boolean; toggleBase: boolean }) {
    const base = this.ui.getBaseControls();
    const energy = this.ui.getEnergyControls();
    const status = this.ui.getStatusControls();
    const hand = this.ui.getHandControls();
    const actions = this.ui.getActionControls();
    if (opts.toggleBase) {
      base?.setBaseTowerVisible(true, true, opts.fade);
      base?.setBaseTowerVisible(false, true, opts.fade);
    }
    energy?.setVisible(true);
    status?.setVisible(true);
    hand?.setVisible(true);
    // Reset actions to an empty list when showing UI to avoid stale labels.
    actions?.setButtons?.([]);
    if (opts.fade) {
      energy?.fadeIn();
      status?.fadeIn();
      hand?.fadeIn();
      //actions?.fadeIn?.();
    }
    actions?.setVisible(true);
  }
}
