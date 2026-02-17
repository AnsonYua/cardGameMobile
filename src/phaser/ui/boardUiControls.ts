import Phaser from "phaser";
import type { ActionButtonBarHandler } from "./ActionButtonBarHandler";
import type { HeaderHandler } from "./HeaderHandler";
import type { HandAreaHandler } from "./HandAreaHandler";
import type { HandCardView } from "./HandTypes";
import { formatHeaderStatus } from "./HeaderStatusFormatter";

export type HandControls = {
  setVisible: (visible: boolean) => void;
  fadeIn: () => void;
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearHand: () => void;
  clearSelection?: () => void;
  hidePreviewNow?: () => void;
  scrollToEnd?: (animate?: boolean) => void;
  renderPreviewCard?: (container: Phaser.GameObjects.Container, card: HandCardView) => void;
  setCardClickHandler?: (handler: (card: HandCardView) => void) => void;
  getCardSize?: () => { w: number; h: number } | undefined;
  getAutomationState?: () => { visible: boolean; selectedUid?: string; cards: HandCardView[] };
  clickCard?: (uid: string) => boolean;
};

export type ActionControls = {
  setVisible: (visible: boolean) => void;
  fadeIn: (duration?: number) => void;
  setButtons: (labels: string[]) => void;
  setActionHandler: (handler: (index: number) => void) => void;
  setDescriptors: (buttons: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[]) => void;
  setState: (state: { descriptors: any[] }) => void;
  setWaitingForOpponent: (
    waiting: boolean,
    overrideButtons?: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[],
  ) => void;
  setWaitingLabel: (label: string) => void;
  getAutomationState?: () => {
    visible: boolean;
    waitingMode: boolean;
    waitingLabel: string;
    buttons: { label: string; enabled: boolean; primary?: boolean }[];
  };
  invokeByIndex?: (index: number) => Promise<boolean> | boolean;
  invokePrimary?: () => Promise<boolean> | boolean;
};

export type HeaderControls = {
  setStatus: (text: string) => void;
  setStatusFromEngine?: (status: any, opts?: { offlineFallback?: boolean }) => void;
  setTurnText?: (text: string, color?: string) => void;
  setAvatarHandler: (handler: () => void) => void;
  setTimerProgress?: (progress: number, secondsLeft: number) => void;
  setTimerVisible?: (visible: boolean) => void;
};

export function createHandControls(hand: HandAreaHandler): HandControls {
  return {
    setVisible: (visible: boolean) => hand.setVisible(visible),
    fadeIn: () => hand.fadeIn(),
    setHand: (cards, opts) => hand.setHand(cards, opts),
    clearHand: () => hand.clearHand(),
    clearSelection: () => hand.clearSelection(),
    hidePreviewNow: () => hand.hidePreviewNow(),
    scrollToEnd: (animate?: boolean) => hand.scrollToEnd(animate),
    renderPreviewCard: (container, card) => hand.renderPreviewCard(container, card),
    setCardClickHandler: (handler) => hand.setCardClickHandler?.(handler),
    getCardSize: () => hand.getCardSize(),
    getAutomationState: () => hand.getAutomationState(),
    clickCard: (uid: string) => hand.clickCard(uid),
  };
}

export function createActionControls(actions: ActionButtonBarHandler): ActionControls {
  return {
    setVisible: (visible: boolean) => actions.setVisible(visible),
    fadeIn: (duration?: number) => actions.fadeIn(duration),
    setButtons: (labels: string[]) => actions.setButtons(labels),
    setActionHandler: (handler: (index: number) => void) => actions.setActionHandler(handler),
    setDescriptors: (buttons) => actions.setDescriptors(buttons),
    setState: (state: { descriptors: any[] }) => actions.setState(state),
    setWaitingForOpponent: (waiting, overrideButtons) => actions.setWaitingForOpponent(waiting, overrideButtons),
    setWaitingLabel: (label: string) => actions.setWaitingLabel(label),
    getAutomationState: () => actions.getAutomationState(),
    invokeByIndex: (index: number) => actions.invokeByIndex(index),
    invokePrimary: () => actions.invokePrimary(),
  };
}

export function createHeaderControls(header: HeaderHandler): HeaderControls {
  return {
    setStatus: (text: string) => header.setStatusText(text),
    setStatusFromEngine: (status: any, opts?: { offlineFallback?: boolean }) => {
      const text = formatHeaderStatus(status, opts);
      if (text) {
        header.setStatusText(text);
      }
    },
    setTurnText: (text: string, color?: string) => header.setTurnText(text, color),
    setAvatarHandler: (handler: () => void) => header.setAvatarHandler(handler),
    setTimerProgress: (progress, secondsLeft) => header.setTimerProgress(progress, secondsLeft),
    setTimerVisible: (visible) => header.setTimerVisible(visible),
  };
}
