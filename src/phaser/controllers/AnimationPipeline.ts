import type Phaser from "phaser";
import { PlayCardAnimationManager } from "../animations/PlayCardAnimationManager";
import { NotificationAnimationController } from "../animations/NotificationAnimationController";
import { BattleAnimationManager } from "../animations/BattleAnimationManager";
import { AttackIndicatorController } from "./AttackIndicatorController";
import { AnimationQueue } from "../animations/AnimationQueue";
import { SlotAnimationRenderController } from "../animations/SlotAnimationRenderController";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { HandCardView } from "../ui/HandTypes";
import type { TargetAnchorProviders } from "../utils/AttackResolver";

type SlotControls = {
  setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
  createSlotSprite?: (slot: SlotViewModel, size: { w: number; h: number }) => Phaser.GameObjects.Container | undefined;
  setPlayAnimations?: (enabled: boolean) => void;
  getSlotAreaCenter?: (owner: SlotOwner) => { x: number; y: number } | undefined;
  markStatAnimationPending?: (slotKey: string) => void;
  releaseStatAnimation?: (slotKey: string) => void;
  playStatPulse?: (slotKey: string, delta: number) => Promise<void> | void;
};

type HandControls = {
  renderPreviewCard?: (container: Phaser.GameObjects.Container, card: HandCardView) => void;
};

type DrawPopupDialog = {
  showDrawPopup: (opts: {
    card: any;
    header?: string;
    fadeInMs?: number;
    holdMs?: number;
    fadeOutMs?: number;
    showOverlay?: boolean;
    centerY?: number;
  }) => Promise<void>;
};

type MulliganDialog = {
  showPrompt: (opts: { prompt?: string; onYes?: () => Promise<void> | void; onNo?: () => Promise<void> | void }) => Promise<boolean>;
};

type ChooseFirstPlayerDialog = {
  showPrompt: (opts: { prompt?: string; onFirst?: () => Promise<void> | void; onSecond?: () => Promise<void> | void }) => Promise<boolean>;
};

type TurnOrderStatusDialog = {
  showMessage: (promptText: string, headerText?: string) => void;
  hide: () => void;
};

type CoinFlipOverlay = {
  play: () => Promise<void> | void;
};

export function createAnimationPipeline(deps: {
  scene: Phaser.Scene;
  slotControls: SlotControls | null;
  handControls: HandControls | null;
  drawPopupDialog?: DrawPopupDialog;
  mulliganDialog?: MulliganDialog;
  chooseFirstPlayerDialog?: ChooseFirstPlayerDialog;
  turnOrderStatusDialog?: TurnOrderStatusDialog;
  waitingOpponentDialog?: TurnOrderStatusDialog;
  mulliganWaitingDialog?: TurnOrderStatusDialog;
  coinFlipOverlay?: CoinFlipOverlay;
  phaseChangeDialog?: { showPhaseChange: (opts: { nextPhase: string; header?: string }) => Promise<void> };
  startGame?: () => Promise<void> | void;
  startReady?: (isRedraw: boolean) => Promise<void> | void;
  chooseFirstPlayer?: (chosenFirstPlayerId: string) => Promise<void> | void;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  getTargetAnchorProviders: () => TargetAnchorProviders;
  getSlotsFromRaw: (raw: any) => SlotViewModel[];
}) {
  const battleAnimations = new BattleAnimationManager({
    scene: deps.scene,
    anchors: deps.getTargetAnchorProviders(),
    resolveSlotOwnerByPlayer: deps.resolveSlotOwnerByPlayer,
    setSlotVisible: (owner, slotId, visible) => deps.slotControls?.setSlotVisible?.(owner, slotId, visible),
    createSlotSprite: (slot, size) => deps.slotControls?.createSlotSprite?.(slot, size) ?? undefined,
    getSlotsFromRaw: deps.getSlotsFromRaw,
  });
  deps.slotControls?.setPlayAnimations?.(false);
  const cardFlightAnimator = new PlayCardAnimationManager(deps.scene);
  const notificationAnimator = new NotificationAnimationController({
    scene: deps.scene,
    playAnimator: cardFlightAnimator,
    getBaseAnchor: (isOpponent) => deps.getTargetAnchorProviders().getBaseAnchor?.(isOpponent),
    getSlotAreaCenter: (owner) => deps.slotControls?.getSlotAreaCenter?.(owner),
    onSlotAnimationStart: (slotKey) => deps.slotControls?.markStatAnimationPending?.(slotKey),
    onSlotAnimationEnd: (slotKey) => deps.slotControls?.releaseStatAnimation?.(slotKey),
    renderHandPreview: (container, card) => deps.handControls?.renderPreviewCard?.(container, card),
    showCardPopup: (card, opts) =>
      deps.drawPopupDialog?.showDrawPopup({
        card,
        header: opts.header,
        fadeInMs: opts.fadeInMs,
        holdMs: opts.holdMs,
        fadeOutMs: opts.fadeOutMs,
        centerY: opts.centerY,
        showOverlay: false,
      }) ?? Promise.resolve(),
    setSlotVisible: (owner, slotId, visible) => deps.slotControls?.setSlotVisible?.(owner, slotId, visible),
  });
  const attackIndicatorController = new AttackIndicatorController({
    scene: deps.scene,
    resolveSlotOwnerByPlayer: deps.resolveSlotOwnerByPlayer,
    anchorsProvider: () => deps.getTargetAnchorProviders(),
  });
  const animationQueue = new AnimationQueue({
    cardPlayAnimator: notificationAnimator,
    battleAnimator: battleAnimations,
    attackIndicator: attackIndicatorController,
    phasePopup: deps.phaseChangeDialog
      ? { showPhaseChange: (nextPhase) => deps.phaseChangeDialog?.showPhaseChange({ nextPhase }) }
      : undefined,
    mulliganDialog: deps.mulliganDialog,
    chooseFirstPlayerDialog: deps.chooseFirstPlayerDialog,
    turnOrderStatusDialog: deps.turnOrderStatusDialog,
    waitingOpponentDialog: deps.waitingOpponentDialog,
    mulliganWaitingDialog: deps.mulliganWaitingDialog,
    coinFlipOverlay: deps.coinFlipOverlay,
    startGame: deps.startGame,
    startReady: deps.startReady,
    chooseFirstPlayer: deps.chooseFirstPlayer,
    slotControls: deps.slotControls,
  });
  const slotAnimationRender = new SlotAnimationRenderController(deps.getSlotsFromRaw);

  return {
    battleAnimations,
    cardFlightAnimator,
    notificationAnimator,
    attackIndicatorController,
    animationQueue,
    slotAnimationRender,
  };
}
