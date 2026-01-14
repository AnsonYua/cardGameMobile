export const HEADER_TIMER_BAR_STYLE = {
  height: 4,
  fillColor: 0x2ecc71,
  bgColor: 0x0f1118,
  borderColor: 0x5b6068,
  showLabel: false,
};

export const DIALOG_TIMER_BAR_STYLE = {
  height: 6,
  fillColor: 0x3d6cff,
  bgColor: 0x1a1d24,
  borderColor: 0x5b6068,
  showLabel: false,
};

export const DIALOG_TIMER_BAR_SPACING = {
  top: 14,
  bottom: 18,
};

export const getDialogTimerHeaderGap = () =>
  DIALOG_TIMER_BAR_SPACING.top + DIALOG_TIMER_BAR_STYLE.height + DIALOG_TIMER_BAR_SPACING.bottom;
