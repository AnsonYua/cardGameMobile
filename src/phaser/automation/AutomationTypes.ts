import type { ActionSource } from "../game/GameEngine";
import type { GameMode } from "../game/GameSessionService";
import type { SelectionTarget } from "../game/SelectionStore";
import type { HandCardView } from "../ui/HandTypes";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";

export type WaitOpts = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type ActionButtonSnapshot = {
  index: number;
  label: string;
  enabled: boolean;
  primary?: boolean;
};

export type HandCardSnapshot = {
  uid?: string;
  cardId?: string;
  cardType?: string;
  cost?: number | string;
  ap?: number;
  hp?: number;
  textureKey?: string;
  fromPilotDesignation?: boolean;
};

export type SlotSnapshot = {
  owner: SlotOwner;
  slotId: string;
  isRested?: boolean;
  ap?: number;
  hp?: number;
  unit?: {
    id?: string;
    cardUid?: string;
    cardType?: string;
    canAttackThisTurn?: boolean;
    isRested?: boolean;
    textureKey?: string;
  };
  pilot?: {
    id?: string;
    cardUid?: string;
    cardType?: string;
    canAttackThisTurn?: boolean;
    isRested?: boolean;
    textureKey?: string;
  };
};

export type BaseSnapshot = {
  side: "player" | "opponent";
  ownerPlayerId?: string;
  exists: boolean;
  cardId?: string;
  status?: string;
  visible?: boolean;
  shieldCount?: number;
  fieldCardValue?: {
    totalAP?: number;
    totalHP?: number;
    totalOriginalAP?: number;
    totalOriginalHP?: number;
  };
};

export type PromptDialogSnapshot = {
  type: "PROMPT_CHOICE";
  open: boolean;
  headerText: string;
  promptText: string;
  buttons: Array<{ label: string; enabled: boolean }>;
};

export type OptionDialogSnapshot = {
  type: "OPTION_CHOICE";
  open: boolean;
  headerText: string;
  choices: Array<{ index: number; cardId?: string; enabled: boolean }>;
  isOwnerView: boolean;
};

export type TokenDialogSnapshot = {
  type: "TOKEN_CHOICE";
  open: boolean;
  headerText: string;
  choices: Array<{ index: number; cardId?: string; enabled: boolean }>;
  isOwnerView: boolean;
};

export type BurstDialogSnapshot = {
  type: "BURST_CHOICE";
  open: boolean;
  headerText: string;
  showButtons: boolean;
};

export type TimedDialogSnapshot = {
  type: "MULLIGAN" | "CHOOSE_FIRST_PLAYER";
  open: boolean;
  headerText: string;
  promptText: string;
  buttons: Array<{ label: string; enabled: boolean }>;
};

export type PilotDialogSnapshot = {
  type: "PILOT_TARGET" | "EFFECT_TARGET";
  open: boolean;
  targets: number;
};

export type DialogSnapshot =
  | PromptDialogSnapshot
  | OptionDialogSnapshot
  | TokenDialogSnapshot
  | BurstDialogSnapshot
  | TimedDialogSnapshot
  | PilotDialogSnapshot;

export type CardUiSnapshot = {
  ts: number;
  route: "game";
  context: {
    mode: GameMode;
    gameId: string | null;
    playerId: string;
    playerName: string;
    joinToken?: string | null;
    aiMode: boolean;
    isAutoPolling: boolean;
    offlineFallback: boolean;
  };
  engine: {
    status: any;
    phase: any;
    currentPlayer: any;
    battle?: any;
    version?: number | string;
  };
  selection: SelectionTarget | null;
  ui: {
    actionBar: {
      visible: boolean;
      waitingMode: boolean;
      waitingLabel: string;
      buttons: ActionButtonSnapshot[];
    };
    hand: {
      visible: boolean;
      selectedUid: string | null;
      cards: HandCardSnapshot[];
    };
    slots: {
      selected: { owner: SlotOwner; slotId: string } | null;
      slots: SlotSnapshot[];
    };
    base: {
      player: BaseSnapshot;
      opponent: BaseSnapshot;
    };
    dialogs: DialogSnapshot[];
  };
};

export type CardInteractable = {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  meta?: Record<string, any>;
};

export type ClickTarget =
  | string
  | { kind: "actionIndex"; index: number }
  | { kind: "actionPrimary"; source?: ActionSource }
  | { kind: "actionId"; id: string; source?: ActionSource }
  | { kind: "hand"; uid: string }
  | { kind: "slot"; owner: SlotOwner; slotId: string }
  | { kind: "base"; side: "player" | "opponent" }
  | { kind: "prompt"; labelOrIndex: string | number }
  | { kind: "option"; index: number }
  | { kind: "token"; index: number }
  | { kind: "burst"; decision: "trigger" | "cancel" }
  | { kind: "pilotTarget"; index: number }
  | { kind: "effectTarget"; index: number }
  | { kind: "mulligan"; decision: "yes" | "no" }
  | { kind: "chooseFirstPlayer"; decision: "first" | "second" };

export type HandAutomationState = {
  visible: boolean;
  selectedUid?: string;
  cards: HandCardView[];
};

export type SlotAutomationState = {
  slots: SlotViewModel[];
  selectedKey?: string;
  clicksEnabled: boolean;
  previewEnabled: boolean;
};

export type CardAutomation = {
  version: string;
  enabled: true;
  snapshot: () => CardUiSnapshot;
  list: () => CardInteractable[];
  click: (target: ClickTarget) => Promise<boolean>;
  waitFor: (predicate: (snapshot: CardUiSnapshot) => boolean, opts?: WaitOpts) => Promise<CardUiSnapshot>;
  waitForIdle: (opts?: WaitOpts) => Promise<CardUiSnapshot>;
  action: {
    list: () => ActionButtonSnapshot[];
    clickPrimary: (source?: ActionSource) => Promise<boolean>;
    clickByLabel: (label: string) => Promise<boolean>;
    clickByIndex: (index: number) => Promise<boolean>;
    run: (id: string, source?: ActionSource) => Promise<boolean>;
  };
  hand: {
    list: () => HandCardSnapshot[];
    select: (uid: string) => boolean;
    click: (uid: string) => Promise<boolean>;
    getSelectedUid: () => string | null;
  };
  slot: {
    list: () => SlotSnapshot[];
    click: (owner: SlotOwner, slotId: string) => Promise<boolean>;
    getSelected: () => { owner: SlotOwner; slotId: string } | null;
  };
  base: {
    click: (side: "player" | "opponent") => Promise<boolean>;
    get: (side: "player" | "opponent") => BaseSnapshot;
  };
  dialogs: {
    list: () => DialogSnapshot[];
    promptChoose: (labelOrIndex: string | number) => Promise<boolean>;
    optionChoose: (index: number) => Promise<boolean>;
    tokenChoose: (index: number) => Promise<boolean>;
    burstChoose: (decision: "trigger" | "cancel") => Promise<boolean>;
    pilotTargetChoose: (index: number) => Promise<boolean>;
    effectTargetChoose: (index: number) => Promise<boolean>;
    mulliganChoose: (decision: "yes" | "no") => Promise<boolean>;
    chooseFirstPlayer: (decision: "first" | "second") => Promise<boolean>;
  };
  engine: {
    pollOnce: () => Promise<void>;
    startAutoPolling: () => Promise<void>;
    stopAutoPolling: () => Promise<void>;
    setScenario: (path: string) => Promise<void>;
  };
};
