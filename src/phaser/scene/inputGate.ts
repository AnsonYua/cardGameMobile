export function disableBoardInputs(deps: {
  turnTimer?: { setEnabled?: (enabled: boolean) => void } | null;
  headerControls?: { setTimerVisible?: (visible: boolean) => void } | null;
  debugControls?: { stopAutoPolling?: () => Promise<void> } | null;
  handControls?: { setVisible?: (visible: boolean) => void } | null;
  actionControls?: { setVisible?: (visible: boolean) => void } | null;
  slotControls?: { setSlotClickEnabled?: (enabled: boolean) => void } | null;
  baseControls?: { setBaseInputEnabled?: (enabled: boolean) => void } | null;
}) {
  deps.turnTimer?.setEnabled?.(false);
  deps.headerControls?.setTimerVisible?.(false);
  void deps.debugControls?.stopAutoPolling?.();
  deps.handControls?.setVisible?.(false);
  deps.actionControls?.setVisible?.(false);
  deps.slotControls?.setSlotClickEnabled?.(false);
  deps.baseControls?.setBaseInputEnabled?.(false);
}
