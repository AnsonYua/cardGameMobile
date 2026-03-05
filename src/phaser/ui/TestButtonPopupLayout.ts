export type PopupSizeInput = {
  viewportWidth: number;
  viewportHeight: number;
  buttonCount: number;
  hasScenarioPicker: boolean;
  hasFooter: boolean;
};

export type PopupSizeResult = {
  popupW: number;
  popupH: number;
};

export type ButtonStackInput = {
  buttonCount: number;
  startY: number;
  maxBottomY: number;
  baseButtonHeight?: number;
  baseGap?: number;
  minButtonHeight?: number;
  minGap?: number;
  maxGap?: number;
  extraCenterCap?: number;
  sectionGap?: number;
};

export type ButtonStackResult = {
  startY: number;
  buttonHeight: number;
  buttonGap: number;
};

export function computePopupSize(input: PopupSizeInput): PopupSizeResult {
  const baseButtonH = 42;
  const baseGap = 10;
  const buttonBlockH =
    input.buttonCount > 0 ? input.buttonCount * baseButtonH + (input.buttonCount - 1) * baseGap : 0;
  const pickerBlockH = input.hasScenarioPicker ? 76 : 0;
  const footerBlockH = input.hasFooter ? 72 : 26;
  const desiredH = 116 + pickerBlockH + buttonBlockH + footerBlockH;

  return {
    popupW: Math.max(300, Math.min(380, input.viewportWidth - 24)),
    popupH: Math.max(340, Math.min(desiredH, input.viewportHeight - 18)),
  };
}

export function computeButtonStackLayout(input: ButtonStackInput): ButtonStackResult {
  const minBtnH = input.minButtonHeight ?? 34;
  const minGap = input.minGap ?? 6;
  const maxGap = input.maxGap ?? 14;
  const sectionGap = input.sectionGap ?? 14;
  const extraCenterCap = input.extraCenterCap ?? 20;

  let buttonHeight = input.baseButtonHeight ?? 42;
  let buttonGap = input.baseGap ?? 10;
  let startY = input.startY;

  if (input.buttonCount <= 0) {
    return { startY, buttonHeight, buttonGap };
  }

  const gapCount = Math.max(0, input.buttonCount - 1);
  const maxBlock = input.maxBottomY - startY;
  const targetBtnH = Math.floor((maxBlock - gapCount * buttonGap) / input.buttonCount);
  if (targetBtnH < buttonHeight) {
    buttonHeight = Math.max(minBtnH, targetBtnH);
  }

  let blockHeight = input.buttonCount * buttonHeight + gapCount * buttonGap;
  if (blockHeight > maxBlock && gapCount > 0) {
    buttonGap = Math.max(minGap, Math.floor((maxBlock - input.buttonCount * buttonHeight) / gapCount));
    blockHeight = input.buttonCount * buttonHeight + gapCount * buttonGap;
  }

  const remaining = maxBlock - blockHeight;
  if (remaining > 0 && gapCount > 0) {
    const gapBoost = Math.min(maxGap - buttonGap, Math.floor(remaining / gapCount));
    if (gapBoost > 0) {
      buttonGap += gapBoost;
      blockHeight = input.buttonCount * buttonHeight + gapCount * buttonGap;
    }
  }

  const finalRemaining = maxBlock - blockHeight;
  if (finalRemaining > sectionGap) {
    startY += Math.min(extraCenterCap, Math.floor((finalRemaining - sectionGap) / 2));
  }

  return { startY, buttonHeight, buttonGap };
}
