import type { AnimationQueue } from "../animations/AnimationQueue";
import type { DebugControls } from "../controllers/DebugControls";
import type { SelectionActionController } from "../controllers/SelectionActionController";
import type { GameEngine } from "../game/GameEngine";
import type { GameContextStore } from "../game/GameContextStore";
import type { HandPresenter } from "../ui/HandPresenter";
import type { HandControls } from "../ui/boardUiControls";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotOwner } from "../ui/SlotTypes";

export type BridgeDeps = {
  engine: GameEngine;
  contextStore: GameContextStore;
  selectionAction?: SelectionActionController;
  handPresenter: HandPresenter;
  slotPresenter: SlotPresenter;
  controls: {
    actionControls?: {
      getAutomationState?: () => {
        visible: boolean;
        waitingMode: boolean;
        waitingLabel: string;
        buttons: Array<{ label: string; enabled: boolean; primary?: boolean }>;
      };
      invokeByIndex?: (index: number) => Promise<boolean> | boolean;
      invokePrimary?: () => Promise<boolean> | boolean;
    } | null;
    handControls?: (HandControls & {
      getAutomationState?: () => { visible: boolean; selectedUid?: string; cards: any[] };
      clickCard?: (uid: string) => boolean;
    }) | null;
    slotControls?: {
      getAutomationState?: () => {
        slots: any[];
        selectedKey?: string;
        clicksEnabled: boolean;
        previewEnabled: boolean;
      };
      clickSlot?: (owner: SlotOwner, slotId: string) => boolean;
    } | null;
  };
  dialogs: {
    promptChoiceDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        promptText: string;
        buttons: Array<{ label: string; enabled: boolean }>;
      } | null;
      choose?: (labelOrIndex: string | number) => Promise<boolean>;
    } | null;
    optionChoiceDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        choices: Array<{ index: number; cardId?: string; enabled: boolean }>;
        isOwnerView: boolean;
      } | null;
      choose?: (index: number) => Promise<boolean>;
    } | null;
    tokenChoiceDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        choices: Array<{ index: number; cardId?: string; enabled: boolean }>;
        isOwnerView: boolean;
      } | null;
      choose?: (index: number) => Promise<boolean>;
    } | null;
    burstChoiceDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        showButtons: boolean;
      } | null;
      choose?: (decision: "trigger" | "cancel") => Promise<boolean>;
    } | null;
    pilotTargetDialog?: {
      isOpen?: () => boolean;
      selectTarget?: (index?: number) => Promise<boolean>;
      getAutomationState?: () => { open: boolean; targets: number } | null;
    } | null;
    effectTargetDialog?: {
      isOpen?: () => boolean;
      selectTarget?: (index?: number) => Promise<boolean>;
      getAutomationState?: () => { open: boolean; targets: number } | null;
    } | null;
    mulliganDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        promptText: string;
        buttons: Array<{ label: string; enabled: boolean }>;
      } | null;
      choose?: (decision: "yes" | "no") => Promise<boolean>;
    } | null;
    chooseFirstPlayerDialog?: {
      getAutomationState?: () => {
        open: boolean;
        headerText: string;
        promptText: string;
        buttons: Array<{ label: string; enabled: boolean }>;
      } | null;
      choose?: (decision: "first" | "second") => Promise<boolean>;
    } | null;
  };
  debugControls?: DebugControls;
  animationQueue?: AnimationQueue;
  offlineFallback?: () => boolean;
};
