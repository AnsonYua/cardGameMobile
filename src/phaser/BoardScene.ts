import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";
import { ShuffleAnimationManager } from "./animations/ShuffleAnimationManager";
import { DrawHelpers } from "./ui/HeaderHandler";
import { ShieldAreaStatus } from "./ui/ShieldAreaHandler";
import { ApiManager } from "./api/ApiManager";
import { GameSessionService, GameStatus, GameMode } from "./game/GameSessionService";
import { MatchStateMachine } from "./game/MatchStateMachine";
import { GameEngine, type GameStatusSnapshot, type ActionSource } from "./game/GameEngine";
import type { GameStatusResponse } from "./game/GameTypes";
import { ActionDispatcher } from "./controllers/ActionDispatcher";
import { GameContextStore } from "./game/GameContextStore";
import { parseSessionParams } from "./game/SessionParams";
import { ENGINE_EVENTS } from "./game/EngineEvents";
import { DebugControls } from "./controllers/DebugControls";
import { TurnStateController } from "./game/TurnStateController";
import { HandPresenter } from "./ui/HandPresenter";
import { SlotPresenter } from "./ui/SlotPresenter";
import type { SlotViewModel, SlotCardView, SlotOwner, SlotPositionMap, SlotPosition } from "./ui/SlotTypes";
import { toPreviewKey } from "./ui/HandTypes";
import { PilotTargetDialog } from "./ui/PilotTargetDialog";
import { PilotDesignationDialog } from "./ui/PilotDesignationDialog";
import { EffectTargetDialog } from "./ui/EffectTargetDialog";
import { PilotFlowController } from "./controllers/PilotFlowController";
import { CommandFlowController } from "./controllers/CommandFlowController";
import { UnitFlowController } from "./controllers/UnitFlowController";
import { SelectionActionController } from "./controllers/SelectionActionController";
import { EffectTargetController } from "./controllers/EffectTargetController";
import { PlayCardAnimationManager } from "./animations/PlayCardAnimationManager";
import { NotificationAnimationController, type SlotNotification } from "./animations/NotificationAnimationController";
import { AttackIndicator, type AttackIndicatorStyle } from "./animations/AttackIndicator";

const colors = {
  bg: "#ffffff",
  board: "#1a1d26",
  slot: "#2a2d38",
  accent: "#d0d5e0",
  pill: "#2f3342",
  text: "#f5f6fb",
ink: "#0f1118",
};

type BattleSpriteSeed = {
  owner: SlotOwner;
  slotId?: string;
  card: SlotCardView;
  position: { x: number; y: number };
  size: { w: number; h: number };
  isOpponent?: boolean;
};

type PendingBattleSnapshot = {
  attacker?: BattleSpriteSeed;
  target?: BattleSpriteSeed;
  targetPoint: { x: number; y: number };
};

export class BoardScene extends Phaser.Scene {
  constructor() {
    super("BoardScene");
  }

  preload() {
    this.load.image("deckBack", "/cardback.png");
    this.load.image("baseCard", "/ex-base.png");
    this.load.image("playmat", "/playmart.png");
  }

  private offset = { x: 0, y: 0 };
  private ui: BoardUI | null = null;
  private shuffleManager: ShuffleAnimationManager | null = null;
  private playerBaseStatus: ShieldAreaStatus = "normal";
  private playerShieldCount = 6;
  private offlineFallback = false;
  private baseControls: ReturnType<BoardUI["getBaseControls"]> | null = null;
  private energyControls: ReturnType<BoardUI["getEnergyControls"]> | null = null;
  private statusControls: ReturnType<BoardUI["getStatusControls"]> | null = null;
  private handControls: ReturnType<BoardUI["getHandControls"]> | null = null;
  private actionControls: ReturnType<BoardUI["getActionControls"]> | null = null;
  private api = new ApiManager();
  private session = new GameSessionService(this.api);
  private match = new MatchStateMachine(this.session);
  private contextStore = new GameContextStore();
  private engine = new GameEngine(this, this.match, this.contextStore);
  private gameContext = this.contextStore.get();
  private handPresenter = new HandPresenter();
  private slotPresenter = new SlotPresenter();
  private turnController = new TurnStateController();

  private headerControls: ReturnType<BoardUI["getHeaderControls"]> | null = null;
  private actionDispatcher = new ActionDispatcher();
  private uiVisible = true;
  private errorText?: Phaser.GameObjects.Text;
  private debugControls?: DebugControls;
  private loadingText?: Phaser.GameObjects.Text;
  private slotControls: ReturnType<BoardUI["getSlotControls"]> | null = null;
  private selectionAction?: SelectionActionController;
  private effectTargetController?: EffectTargetController;
  private pilotTargetDialogUi?: PilotTargetDialog;
  private pilotDesignationDialogUi?: PilotDesignationDialog;
  private effectTargetDialogUi?: EffectTargetDialog;
  private pilotFlow?: PilotFlowController;
  private commandFlow?: CommandFlowController;
  private unitFlow?: UnitFlowController;
  private attackIndicator?: AttackIndicator;
  private activeAttackNotificationId?: string;
  private activeAttackTargetKey?: string;
  private pendingBattleSnapshots = new Map<string, PendingBattleSnapshot>();
  private processedBattleResolutionIds = new Set<string>();
  private battleAnimationQueue: Promise<void> = Promise.resolve();
  private battleAnimationLayer?: Phaser.GameObjects.Container;
  // Global switch for slot entry animations (true = animate when allowed by update context).
  private playAnimations = true;
  private cardFlightAnimator: PlayCardAnimationManager | null = null;
  private notificationAnimator: NotificationAnimationController | null = null;

  create() {
    // Center everything based on the actual viewport, not just BASE_W/H.
    const cam = this.cameras.main;
    this.offset.x = cam.centerX - BASE_W / 2;
    this.offset.y = cam.centerY - BASE_H / 2;
    console.log("offset y ", cam.centerY)



    this.cameras.main.setBackgroundColor(colors.bg);
    this.ui = new BoardUI(this, {
      ink: colors.ink,
      slot: colors.slot,
      accent: colors.accent,
      text: colors.text,
      bg: colors.bg,
    });
    this.shuffleManager = new ShuffleAnimationManager(this, new DrawHelpers(this), this.offset);
    this.baseControls = this.ui.getBaseControls();
    this.energyControls = this.ui.getEnergyControls();
    this.statusControls = this.ui.getStatusControls();
    this.handControls = this.ui.getHandControls();
    this.slotControls = this.ui.getSlotControls();
    this.slotControls?.setPlayAnimations?.(false);
    const palette = { ink: colors.ink, slot: colors.slot, accent: colors.accent, text: colors.text, bg: colors.bg };
    this.cardFlightAnimator = new PlayCardAnimationManager(this, palette, new DrawHelpers(this));
    this.notificationAnimator = new NotificationAnimationController({
      scene: this,
      playAnimator: this.cardFlightAnimator,
      getBaseAnchor: (isOpponent) => this.baseControls?.getBaseAnchor(isOpponent),
      getSlotAreaCenter: (owner) => this.slotControls?.getSlotAreaCenter?.(owner),
      onSlotAnimationStart: (slotKey) => this.slotControls?.markStatAnimationPending?.(slotKey),
      onSlotAnimationEnd: (slotKey) => this.slotControls?.releaseStatAnimation?.(slotKey),
    });
    this.attackIndicator = new AttackIndicator(this);
    this.headerControls = this.ui.getHeaderControls();
    this.actionControls = this.ui.getActionControls();
    this.debugControls = new DebugControls(this, this.match, this.engine, this.gameContext);
    this.engine.events.on(ENGINE_EVENTS.BATTLE_STATE_CHANGED, (payload: { active: boolean; status: string }) => {
      const status = (payload.status || "").toUpperCase();
      if (payload.active && status === "ACTION_STEP") {
        this.headerControls?.setStatusFromEngine?.("Action Step", { offlineFallback: this.offlineFallback });
      }
    });
    this.engine.events.on(ENGINE_EVENTS.PHASE_REDRAW, () => {
      this.startGame();
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE, (snapshot: GameStatusSnapshot) => {
      this.mainPhaseUpdate(false, snapshot);
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, (snapshot: GameStatusSnapshot) => {
      this.mainPhaseUpdate(true, snapshot);
    });
    this.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_ENTER, () => {
      this.selectionAction?.refreshActions("neutral");
    });
    this.engine.events.on(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, () => {
      this.pilotFlow?.showPilotDesignationDialog();
    });
    this.engine.events.on(ENGINE_EVENTS.PILOT_TARGET_DIALOG, () => {
      this.pilotFlow?.showPilotTargetDialog("playPilotFromHand");
    });
    this.engine.events.on(ENGINE_EVENTS.GAME_RESOURCE, (payload: any) => {
      console.log("Game resources fetched", payload?.resources);
    });
    this.engine.events.on(ENGINE_EVENTS.LOADING_START, () => this.showLoading());
    this.engine.events.on(ENGINE_EVENTS.LOADING_END, () => this.hideLoading());
    this.pilotTargetDialogUi = new PilotTargetDialog(this);
    this.pilotDesignationDialogUi = new PilotDesignationDialog(this);
    this.effectTargetDialogUi = new EffectTargetDialog(this);
    this.effectTargetController = new EffectTargetController({
      dialog: this.effectTargetDialogUi,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      engine: this.engine,
      api: this.api,
      scene: this,
      getSlotAreaCenter: (owner) => this.slotControls?.getSlotAreaCenter?.(owner),
    });
    this.selectionAction = new SelectionActionController({
      engine: this.engine,
      api: this.api,
      slotPresenter: this.slotPresenter,
      handPresenter: this.handPresenter,
      handControls: this.handControls,
      slotControls: this.slotControls,
      actionControls: this.actionControls,
      effectTargetController: this.effectTargetController,
      gameContext: this.gameContext,
      refreshPhase: (skipFade) => this.refreshPhase(skipFade),
    });
    this.pilotFlow = new PilotFlowController({
      scene: this,
      engine: this.engine,
      slotPresenter: this.slotPresenter,
      gameContext: this.gameContext,
      pilotTargetDialog: this.pilotTargetDialogUi,
      pilotDesignationDialog: this.pilotDesignationDialogUi,
      runActionThenRefresh: this.runActionThenRefresh.bind(this),
    });
    this.commandFlow = new CommandFlowController(this.engine);
    this.unitFlow = new UnitFlowController();
    this.engine.setFlowControllers({ commandFlow: this.commandFlow, unitFlow: this.unitFlow, pilotFlow: this.pilotFlow });
    this.debugControls.exposeTestHooks(this.buildTestHooks());

    this.setupActions();
    this.wireUiHandlers();
    this.ui.drawAll(this.offset);
    this.battleAnimationLayer = this.add.container(0, 0);
    this.battleAnimationLayer.setDepth(900);
    this.hideDefaultUI();

    // Kick off game session on load (host flow placeholder).
    this.initSession();
  }

  private buildTestHooks() {
    const selectHandCard = (uid?: string) => {
      if (!uid) return false;
      const snapshot = this.engine.getSnapshot();
      const raw = snapshot.raw as any;
      if (!raw) return false;
      const cards = this.handPresenter.toHandCards(raw, this.gameContext.playerId);
      const target = cards.find((c) => c.uid === uid);
      if (!target) return false;
      this.selectionAction?.handleHandCardSelected(target);
      return true;
    };
    const clickPrimaryAction = async (source: ActionSource = "hand") => {
      const actions = this.engine.getAvailableActions(source);
      const primary = actions.find((a) => a.primary) || actions[0];
      if (!primary) return false;
      await this.runActionThenRefresh(primary.id, source);
      return true;
    };
    const runAction = async (id: string, source: ActionSource = "neutral") => {
      await this.runActionThenRefresh(id, source);
      return true;
    };
    const selectEffectTarget = async (targetIndex = 0) => {
      const selected = await this.effectTargetDialogUi?.selectTarget(targetIndex);
      if (selected) {
        await this.effectTargetDialogUi?.hide();
        return true;
      }
      console.warn("Effect target dialog is not open; cannot select target");
      return false;
    };
    const selectPilotTarget = async (targetIndex = 0, actionId = "playPilotDesignationAsPilot") => {
      // Drive the real dialog callback; avoid snapshot/fallback logic to mirror UI flow.
      const selectedInDialog = await this.pilotTargetDialogUi?.selectTarget(targetIndex);
      if (selectedInDialog) {
        await this.pilotTargetDialogUi?.hide();
        return true;
      }
      console.warn("Pilot target dialog is not open; cannot select target");
      return false;
    };
    const choosePilotDesignationPilot = async () => {
      this.pilotFlow?.showPilotTargetDialog("playPilotDesignationAsPilot");
      return true;
    };
    const choosePilotDesignationCommand = async () => {
      await this.runActionThenRefresh("playPilotDesignationAsCommand", "neutral");
      return true;
    };
    const hooks = {
      selectHandCard,
      clickPrimaryAction,
      runAction,
      selectEffectTarget,
      selectPilotTarget,
      choosePilotDesignationPilot,
      choosePilotDesignationCommand,
    };
    return hooks;
  }
   
  public startGame() {
    this.session.markInMatch();
    this.hideDefaultUI();
    const promise = this.shuffleManager?.play();
    if (promise && typeof promise.then === "function") {
      promise
        .then(() => {
          this.showDefaultUI();
          this.refreshPhase(false);
        })
        .then(() => console.log("Shuffle animation finished"));
    } else {
      this.showDefaultUI();
      this.refreshPhase(false);
    }
  }

  public mainPhaseUpdate(skipAnimation = true, snapshot?: GameStatusSnapshot) {
    if (snapshot) {
      this.gameContext.lastStatus = snapshot.status;
    }
    this.refreshPhase(skipAnimation);
  }

  private refreshPhase(skipAnimation: boolean) {
    const reason: "scenario" | "live" = skipAnimation ? "scenario" : "live";
    const animationPolicy = { allowAnimations: !skipAnimation && this.playAnimations, reason };
    const raw = this.engine.getSnapshot().raw as any;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    console.log("[refreshPhase] skipAnimation", skipAnimation, "battle?", battle);
    this.updateHeaderPhaseStatus(raw);
    this.updateMainPhaseUI(raw, skipAnimation, animationPolicy);
    if (raw) {
      void this.effectTargetController?.syncFromSnapshot(raw);
    }
  }

  private updateMainPhaseUI(raw: any, skipAnimation: boolean, animationPolicy: { allowAnimations: boolean; reason: "scenario" | "live" }) {
    this.updateHeaderOpponentHand(raw);
    this.updateEnergyStatus(raw);
    this.showUI(!skipAnimation);
    this.updateHandArea({ skipAnimation });
    this.updateSlots({ skipAnimation, animation: animationPolicy });
    this.updateBaseAndShield({ fade: !skipAnimation, animation: animationPolicy });
    this.refreshActionBarState(raw, skipAnimation);
  }

  // Placeholder helpers so the flow is explicit; wire up to real UI show/hide logic later.
  private hideDefaultUI() {
    this.hideUI();
  }

  private showDefaultUI() {
    this.showUI(true);
  }

  // Directly control UI chrome visibility; base/shield rendering is handled separately.
  private showUI(fade: boolean) {
    const energy = this.energyControls;
    const status = this.statusControls;
    const hand = this.handControls;
    const actions = this.actionControls;

    energy?.setVisible(true);
    status?.setVisible(true);
    hand?.setVisible(true);
    actions?.setVisible(true);

    if (fade) {
      energy?.fadeIn();
      status?.fadeIn();
      hand?.fadeIn();
      //actions?.fadeIn?.();
    }
  }

  private hideUI() {
    const base = this.baseControls;
    const energy = this.energyControls;
    const status = this.statusControls;
    const hand = this.handControls;
    const actions = this.actionControls;
    base?.setBaseTowerVisible(true, false, false);
    base?.setBaseTowerVisible(false, false, false);
    energy?.setVisible(false);
    status?.setVisible(false);
    hand?.setVisible(false);
    actions?.setVisible(false);
  }

  private updateHeaderOpponentHand(raw: any) {
    const players = raw?.gameEnv?.players || {};
    const playerIds = Object.keys(players);
    const selfId =
      (this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : undefined) ||
      playerIds[0];
    const opponentId = playerIds.find((id) => id !== selfId) || playerIds[0] || "playerId_1";
    const opponent = players?.[opponentId] || {};
    const hand = opponent?.deck?.hand;
    const handUids = opponent?.deck?.handUids;
    let opponentHand: number | string = "-";
    if (typeof hand?.length === "number") {
      opponentHand = hand.length;
    } else if (Array.isArray(hand)) {
      opponentHand = hand.length;
    } else if (hand && typeof hand === "object") {
      opponentHand = Object.keys(hand).length;
    } else if (Array.isArray(handUids)) {
      opponentHand = handUids.length;
    }
    this.ui?.updateHeader({ opponentHand });
  }

  private updateEnergyStatus(raw: any) {
    const players = raw?.gameEnv?.players || {};
    const ids = Object.keys(players);
    if (!ids.length) return;
    const selfId = (this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : undefined) || ids[0];
    const opponentId = ids.find((id) => id !== selfId) || ids[0];
    const summarize = (player: any) => {
      const zones = player?.zones || player?.zone || {};
      const shieldArea = zones.shieldArea || player?.shieldArea || [];
      const energyArea = zones.energyArea || player?.energyArea || [];
      const shield = Array.isArray(shieldArea) ? shieldArea.length : 0;
      const energies = Array.isArray(energyArea) ? energyArea : [];
      const active = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === false).length;
      const rested = energies.filter((e) => e && e.isRested === true && e.isExtraEnergy === false).length;
      const extra = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === true).length;
      return { shield, active, rested, extra };
    };
    const selfStatus = summarize(players[selfId]);
    const oppStatus = summarize(players[opponentId]);
    this.energyControls?.update?.(false, selfStatus);
    this.energyControls?.update?.(true, oppStatus);
  }

  private updateHandArea(opts: { skipAnimation?: boolean } = {}) {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    this.updateHeaderOpponentHand(raw);
    this.updateEnergyStatus(raw);
    const playerId = this.gameContext.playerId;
    const cards = this.handPresenter.toHandCards(raw, playerId);
    if (!cards.length) return;
    const selectedUid = this.selectionAction?.getSelectedHandCard()?.uid;
    this.handControls?.setHand(cards, { preserveSelectionUid: selectedUid });
    this.handControls?.setVisible(true);
    if (!opts.skipAnimation) {
      this.handControls?.fadeIn();
    }
  }

  private updateSlots(opts: { skipAnimation?: boolean; animation?: { allowAnimations: boolean } } = {}) {
    const snapshot = this.engine.getSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return;
    const playerId = this.gameContext.playerId;
    const slots = this.slotPresenter.toSlots(raw, playerId);
    const allowAnimations = opts.animation?.allowAnimations ?? (!opts.skipAnimation && this.playAnimations);

    const notificationQueue = this.getNotificationQueue(raw);
    const positions = this.slotControls?.getSlotPositions?.();
    const currentAttackNote = this.findActiveAttackNotification(notificationQueue);
    if (currentAttackNote && positions) {
      this.cacheBattleSnapshot(currentAttackNote, slots, positions);
    }
    this.processBattleResolutionNotifications(notificationQueue);
    this.notificationAnimator?.process({
      notifications: notificationQueue,
      slots,
      slotPositions: positions,
      slotAreaCenter: (owner) => this.slotControls?.getSlotAreaCenter?.(owner),
      raw,
      allowAnimations,
      currentPlayerId: this.gameContext.playerId,
    });
    this.slotControls?.setSlots(slots);
    this.updateAttackIndicatorFromNotifications(notificationQueue, slots, positions, currentAttackNote);
  }

  private updateHeaderPhaseStatus(raw: any) {
    const phase = raw?.gameEnv?.phase;
    if (phase) {
      this.headerControls?.setStatusFromEngine?.(phase, { offlineFallback: this.offlineFallback });
    }
  }

  private refreshActionBarState(raw: any, skipAnimation: boolean) {
    const playerId = this.gameContext.playerId;
    const isLocalTurn = this.turnController.update(raw, playerId);
    this.selectionAction?.updateActionBarForPhase(raw, { isLocalTurn });
  }

  private getNotificationQueue(raw: any): SlotNotification[] {
    const queue = raw?.notificationQueue ?? raw?.gameEnv?.notificationQueue;
    if (!Array.isArray(queue)) return [];
    return queue;
  }

  private updateAttackIndicatorFromNotifications(
    notifications: SlotNotification[],
    slots: SlotViewModel[],
    positions?: SlotPositionMap | null,
    attackNote?: SlotNotification,
  ) {
    if (!this.attackIndicator) return;
    const note = attackNote ?? this.findActiveAttackNotification(notifications);
    if (!note) {
      this.hideAttackIndicator();
      return;
    }

    if (!positions) {
      this.hideAttackIndicator();
      return;
    }

    const payload = note.payload || {};
    const targetKey = this.buildAttackTargetKey(payload);
    if (this.activeAttackNotificationId === note.id && this.activeAttackTargetKey === targetKey) {
      return;
    }

    const attackerOwner = this.resolveSlotOwnerByPlayer(payload.attackingPlayerId);
    const defenderOwner = this.resolveSlotOwnerByPlayer(payload.defendingPlayerId) || (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attackerSlot || payload.attackerSlotName;
    const attackerSlotVm = this.findSlotForAttack(slots, payload.attackerCarduid, attackerOwner, attackerSlotId);
    const attackerCenter = this.getSlotCenterFromMap(positions, attackerSlotVm, attackerOwner, attackerSlotId);
    const targetPoint = this.resolveAttackTargetPoint(payload, slots, positions, defenderOwner);
    if (!attackerCenter || !targetPoint) {
      this.hideAttackIndicator();
      return;
    }
    const attackStyle: AttackIndicatorStyle = attackerOwner ?? "player";
    this.attackIndicator.show({ from: attackerCenter, to: targetPoint, style: attackStyle });
    this.activeAttackNotificationId = note.id;
    this.activeAttackTargetKey = targetKey;
  }

  private resolveSlotOwnerByPlayer(playerId?: string): SlotOwner | undefined {
    if (!playerId) return undefined;
    if (playerId === this.gameContext.playerId) {
      return "player";
    }
    return "opponent";
  }

  private findSlotForAttack(slots: SlotViewModel[], cardUid?: string, owner?: SlotOwner, fallbackSlot?: string) {
    if (cardUid) {
      const found = slots.find((slot) => slot.unit?.cardUid === cardUid || slot.pilot?.cardUid === cardUid);
      if (found) return found;
    }
    if (owner && fallbackSlot) {
      return slots.find((slot) => slot.owner === owner && slot.slotId === fallbackSlot);
    }
    return undefined;
  }

  private getSlotCenterFromMap(
    positions?: SlotPositionMap | null,
    slot?: SlotViewModel,
    owner?: SlotOwner,
    fallbackSlotId?: string,
  ) {
    if (!positions) return undefined;
    const resolvedOwner = slot?.owner ?? owner;
    const slotId = slot?.slotId ?? fallbackSlotId;
    if (!resolvedOwner || !slotId) return undefined;
    const entry = positions[resolvedOwner]?.[slotId];
    if (!entry) return undefined;
    return { x: entry.x, y: entry.y };
  }

  private resolveAttackTargetPoint(
    payload: any,
    slots: SlotViewModel[],
    positions: SlotPositionMap | null | undefined,
    defenderOwner: SlotOwner,
  ) {
    const targetSlotId =
      payload.forcedTargetZone ??
      payload.targetSlotName ??
      payload.targetSlot ??
      undefined;
    const normalizedSlot = (targetSlotId ?? "").toLowerCase();
    const normalizedName = (payload.targetName ?? "").toLowerCase();
    const targetPlayerId = payload.forcedTargetPlayerId ?? payload.targetPlayerId ?? payload.defendingPlayerId;
    const targetOwner = this.resolveSlotOwnerByPlayer(targetPlayerId) ?? defenderOwner;
    const isOpponentTarget = targetOwner === "opponent";

    if (this.isBaseTarget(normalizedSlot, normalizedName)) {
      const anchor = this.baseControls?.getBaseAnchor(isOpponentTarget);
      if (anchor) {
        return { x: anchor.x, y: anchor.y };
      }
    }

    if (this.isShieldTarget(normalizedSlot, normalizedName)) {
      const anchor = this.baseControls?.getShieldTopAnchor(isOpponentTarget);
      if (anchor) {
        return anchor;
      }
      const fallbackAnchor = this.baseControls?.getBaseAnchor(isOpponentTarget);
      if (fallbackAnchor) {
        return { x: fallbackAnchor.x, y: fallbackAnchor.y };
      }
    }

    const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const slotVm = this.findSlotForAttack(slots, targetCarduid, targetOwner, targetSlotId);
    return this.getSlotCenterFromMap(positions, slotVm, targetOwner, targetSlotId);
  }

  private isBaseTarget(normalizedSlot: string, normalizedName: string) {
    return normalizedSlot === "base" || normalizedName === "base";
  }

  private isShieldTarget(normalizedSlot: string, normalizedName: string) {
    return normalizedSlot === "shield" || normalizedName.includes("shield");
  }

  private hideAttackIndicator() {
    if (!this.attackIndicator) return;
    if (!this.activeAttackNotificationId) return;
    this.attackIndicator.hide({ fadeDuration: 180 });
    this.activeAttackNotificationId = undefined;
    this.activeAttackTargetKey = undefined;
  }

  private async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    await this.selectionAction?.runActionThenRefresh(actionId, actionSource);
  }

  private buildAttackTargetKey(payload: any) {
    const attacker = payload.attackerCarduid ?? payload.attackerUnitUid ?? "";
    const target = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid ?? "";
    const slot = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot ?? "";
    const player = payload.forcedTargetPlayerId ?? payload.targetPlayerId ?? "";
    return `${attacker}|${target}|${slot}|${player}`;
  }

  private cacheBattleSnapshot(note: SlotNotification, slots: SlotViewModel[], positions: SlotPositionMap) {
    const payload = note.payload || {};
    const attackerOwner = this.resolveSlotOwnerByPlayer(payload.attackingPlayerId);
    const defenderOwner =
      this.resolveSlotOwnerByPlayer(payload.defendingPlayerId) || (attackerOwner === "player" ? "opponent" : "player");
    const attackerSlotId = payload.attackerSlot || payload.attackerSlotName;
    const attackerSlot = this.findSlotForAttack(slots, payload.attackerCarduid, attackerOwner, attackerSlotId);
    const attackerPosition = this.getSlotPositionEntry(positions, attackerSlot, attackerOwner, attackerSlotId);
    const targetPoint = this.resolveAttackTargetPoint(payload, slots, positions, defenderOwner ?? "opponent");
    if (!attackerPosition || !targetPoint) {
      return;
    }

    const targetSlotId = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot;
    const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
    const targetSlot = this.findSlotForAttack(slots, targetCarduid, defenderOwner, targetSlotId);
    const targetPosition = this.getSlotPositionEntry(positions, targetSlot, defenderOwner, targetSlotId);

    const attackerSeed = this.buildBattleSpriteSeed(attackerSlot, attackerPosition);
    if (!attackerSeed) {
      return;
    }
    const targetSeed = this.buildBattleSpriteSeed(targetSlot, targetPosition);
    this.pendingBattleSnapshots.set(note.id, {
      attacker: attackerSeed,
      target: targetSeed,
      targetPoint,
    });
  }

  private getSlotPositionEntry(
    positions?: SlotPositionMap | null,
    slot?: SlotViewModel,
    owner?: SlotOwner,
    fallbackSlotId?: string,
  ): SlotPosition | undefined {
    if (!positions) return undefined;
    const resolvedOwner = slot?.owner ?? owner;
    const slotId = slot?.slotId ?? fallbackSlotId;
    if (!resolvedOwner || !slotId) return undefined;
    return positions[resolvedOwner]?.[slotId];
  }

  private buildBattleSpriteSeed(slot?: SlotViewModel, slotPosition?: SlotPosition): BattleSpriteSeed | undefined {
    if (!slot || !slotPosition) return undefined;
    const card = slot.unit ?? slot.pilot;
    if (!card) return undefined;
    const base = Math.min(slotPosition.w, slotPosition.h) * 0.8;
    return {
      owner: slot.owner,
      slotId: slot.slotId,
      card,
      position: { x: slotPosition.x, y: slotPosition.y },
      size: { w: base, h: base * 1.4 },
      isOpponent: slotPosition.isOpponent ?? slot.owner === "opponent",
    };
  }

  private findActiveAttackNotification(notifications: SlotNotification[]) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return undefined;
    }
    for (let i = notifications.length - 1; i >= 0; i -= 1) {
      const note = notifications[i];
      if (!note) continue;
      if ((note.type || "").toUpperCase() !== "UNIT_ATTACK_DECLARED") continue;
      if (note.payload?.battleEnd === true) continue;
      return note;
    }
    return undefined;
  }

  private processBattleResolutionNotifications(notifications: SlotNotification[]) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return;
    }
    notifications.forEach((note) => {
      if (!note) return;
      if ((note.type || "").toUpperCase() !== "BATTLE_RESOLVED") return;
      if (this.processedBattleResolutionIds.has(note.id)) return;
      this.processedBattleResolutionIds.add(note.id);
      this.queueBattleResolution(note);
    });
  }

  private queueBattleResolution(note: SlotNotification) {
    const payload = note.payload || {};
    const attackId = payload.attackNotificationId;
    if (!attackId) return;
    const snapshot = this.pendingBattleSnapshots.get(attackId);
    if (!snapshot) return;
    this.battleAnimationQueue = this.battleAnimationQueue
      .then(() => this.playBattleResolutionAnimation(attackId, snapshot, payload))
      .catch((err) => console.warn("battle animation failed", err));
  }

  private async playBattleResolutionAnimation(
    attackId: string,
    snapshot: PendingBattleSnapshot,
    payload: any,
  ): Promise<void> {
    const attackerSeed = snapshot.attacker;
    if (!attackerSeed) {
      this.pendingBattleSnapshots.delete(attackId);
      return;
    }
    const attackerSprite = this.createBattleSprite(attackerSeed);
    if (!attackerSprite) {
      this.pendingBattleSnapshots.delete(attackId);
      return;
    }
    const targetSprite = snapshot.target ? this.createBattleSprite(snapshot.target) : undefined;
    const targetPoint = snapshot.target?.position ?? snapshot.targetPoint;
    const releaseVisibility: Array<() => void> = [];
    const hideSlot = (seed?: BattleSpriteSeed) => {
      if (!seed?.slotId) return;
      this.setSlotVisible(seed.owner, seed.slotId, false);
      releaseVisibility.push(() => {
        this.setSlotVisible(seed.owner, seed.slotId, true);
      });
    };
    hideSlot(attackerSeed);
    hideSlot(snapshot.target);
    try {
      await this.runTween({
        targets: attackerSprite,
        x: targetPoint.x,
        y: targetPoint.y,
        duration: 320,
        ease: "Sine.easeIn",
      });

      const result = payload?.result || {};
      const cleanupTasks: Promise<void>[] = [];
      if (result.attackerDestroyed) {
        cleanupTasks.push(this.fadeOutAndDestroy(attackerSprite));
      } else {
        cleanupTasks.push(
          this.runTween({
            targets: attackerSprite,
            x: attackerSeed.position.x,
            y: attackerSeed.position.y,
            duration: 260,
            ease: "Sine.easeOut",
          }),
        );
      }

      if (targetSprite) {
        if (result.defenderDestroyed) {
          cleanupTasks.push(this.fadeOutAndDestroy(targetSprite));
        } else {
          cleanupTasks.push(this.pulseSprite(targetSprite));
        }
      }

      await Promise.all(cleanupTasks);
      this.destroyBattleSprite(attackerSprite);
      this.destroyBattleSprite(targetSprite);
      this.pendingBattleSnapshots.delete(attackId);
    } finally {
      releaseVisibility.forEach((fn) => fn());
    }
  }

  private ensureBattleAnimationLayer() {
    if (!this.battleAnimationLayer) {
      this.battleAnimationLayer = this.add.container(0, 0);
      this.battleAnimationLayer.setDepth(900);
    }
    return this.battleAnimationLayer;
  }

  private createBattleSprite(seed: BattleSpriteSeed) {
    const layer = this.ensureBattleAnimationLayer();
    if (!seed.card) return undefined;
    const container = this.add.container(seed.position.x, seed.position.y);
    container.setDepth(seed.isOpponent ? 905 : 915);
    layer?.add(container);

    const width = seed.size.w;
    const height = seed.size.h;
    if (seed.card.textureKey && this.textures.exists(seed.card.textureKey)) {
      const img = this.add.image(0, 0, seed.card.textureKey);
      img.setDisplaySize(width, height);
      img.setOrigin(0.5);
      container.add(img);
    } else {
      const rect = this.add.rectangle(0, 0, width, height, 0x2f3342, 0.95);
      rect.setStrokeStyle(2, 0x111926, 0.9);
      container.add(rect);
      if (seed.card.id) {
        const label = this.add
          .text(0, 0, seed.card.id, {
            fontSize: "14px",
            fontFamily: "Arial",
            color: "#f5f6fb",
            align: "center",
          })
          .setOrigin(0.5);
        container.add(label);
      }
    }

    return container;
  }

  private runTween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((resolve) => {
      const {
        onComplete,
        onCompleteScope,
        onCompleteParams,
        ...rest
      } = config as Phaser.Types.Tweens.TweenBuilderConfig & Record<string, any>;
      const tween = this.tweens.add({
        ...rest,
        onComplete: (...args: any[]) => {
          if (typeof onComplete === "function") {
            onComplete.apply(onCompleteScope ?? this, onCompleteParams ?? args);
          }
          resolve();
        },
      });
      if (!tween) {
        resolve();
      }
    });
  }

  private fadeOutAndDestroy(target: Phaser.GameObjects.Container) {
    return this.runTween({
      targets: target,
      alpha: 0,
      duration: 200,
      ease: "Sine.easeIn",
    }).then(() => {
      this.destroyBattleSprite(target);
    });
  }

  private pulseSprite(target: Phaser.GameObjects.Container) {
    return this.runTween({
      targets: target,
      scale: 1.08,
      yoyo: true,
      duration: 140,
      ease: "Sine.easeInOut",
    }).then(() => {
      const meta = target as any;
      if (!meta?.destroyed) {
        target.setScale(1);
      }
    });
  }

  private destroyBattleSprite(target?: Phaser.GameObjects.Container) {
    if (!target) return;
    const meta = target as any;
    if (meta?.destroyed) return;
    target.destroy(true);
  }

  private setSlotVisible(owner?: SlotOwner, slotId?: string, visible = true) {
    if (!owner || !slotId) return;
    this.slotControls?.setSlotVisible?.(owner, slotId, visible);
  }

  private handleEndTurn() {
    console.log("End Turn clicked");
  }

  private updateBaseAndShield(opts: { fade?: boolean; animation?: { allowAnimations: boolean } } = {}) {
    const fade = opts.fade ?? true;
    console.log("show base")
    const snapshot = this.engine.getSnapshot();
    const raw: any = snapshot.raw;
    const players = raw?.gameEnv?.players;
    if (!players) return;

    const allIds = Object.keys(players);
    const selfId = this.gameContext.playerId && players[this.gameContext.playerId] ? this.gameContext.playerId : allIds[0];
    const otherId = allIds.find((id) => id !== selfId);
    console.log("selfId ", selfId , " ",otherId);
    const applySide = (playerId: string | undefined, isOpponent: boolean) => {
      if (!playerId || !players[playerId]) return;
      const side = players[playerId];
      const zones = side.zones || side.zone || {};
      const shieldArea = zones.shieldArea || side.shieldArea;
      const baseArr = zones.base || side.base;
      const shieldCount = Array.isArray(shieldArea) ? shieldArea.length : 0;
      const baseCard = Array.isArray(baseArr) ? baseArr[0] : null;
      const hasBase = Boolean(baseCard);
      const ap = baseCard?.fieldCardValue?.totalAP ?? 0;
      const hp = baseCard?.fieldCardValue?.totalHP ?? 0;
      const rested = baseCard?.fieldCardValue?.isRested ?? false;
      this.baseControls?.setShieldCount(isOpponent, shieldCount);
      if (hasBase) {
        this.baseControls?.setBaseTexture?.(isOpponent, baseCard?.cardId);
        this.baseControls?.setBaseBadgeLabel(isOpponent, `${ap}|${hp}`);
        this.baseControls?.setBaseStatus(isOpponent, rested ? "rested" : "normal");
        this.baseControls?.setBaseTowerVisible(isOpponent, true, fade);
        this.baseControls?.setBaseVisible(isOpponent, true);
        // Base play animations are disabled for now; NotificationAnimationController owns entry effects.
        this.baseControls?.setBasePreviewData?.(isOpponent, baseCard, { allowAnimation: false });
      } else {
        // Hide only the base visuals; keep shields visible. Disable preview.
        this.baseControls?.setBaseTowerVisible(isOpponent, true, fade);
        this.baseControls?.setBaseVisible(isOpponent, false);
        this.baseControls?.setBasePreviewData?.(isOpponent, null, { allowAnimation: false });
      }
    };

    applySide(selfId, false);
    applySide(otherId, true);
  }

  private showLoading() {
    if (this.loadingText) {
      this.loadingText.setVisible(true);
      return;
    }
    const cam = this.cameras.main;
    this.loadingText = this.add
      .text(cam.centerX, cam.centerY, "Loading...", {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(2000);
  }

  private hideLoading() {
    this.loadingText?.setVisible(false);
  }

  // Centralize UI wiring/drawing to reduce call scattering in create().
  private wireUiHandlers() {
    this.ui?.setActionHandler((index) => this.actionDispatcher.dispatch(index));
    this.handControls?.setCardClickHandler?.((card) => this.selectionAction?.handleHandCardSelected(card));
    this.slotControls?.setSlotClickHandler?.((slot) => this.selectionAction?.handleSlotCardSelected(slot));
    this.baseControls?.setBaseClickHandler?.((payload) => this.selectionAction?.handleBaseCardSelected(payload));
    this.headerControls?.setAvatarHandler(() => this.debugControls?.show());
  }
  private async initSession() {
    try {
      this.offlineFallback = false;
      const parsed = parseSessionParams(window.location.search);
      const mode = parsed.mode;
      const gameId = parsed.gameId;
      const playerIdParam = parsed.playerId;
      const playerNameParam = parsed.playerName;

      if (!mode) throw new Error("Invalid mode");

      this.contextStore.update({ mode });
      if (playerIdParam) this.contextStore.update({ playerId: playerIdParam });
      if (gameId) this.contextStore.update({ gameId });

      if (mode === GameMode.Join) {
        if (!gameId) {
          throw new Error("Missing game id for join mode");
        }
        // Default join identity aligns with backend sample if none provided.
        const joinId = playerIdParam || "playerId_1";
        const joinName = playerNameParam || "Demo Opponent";
        this.contextStore.update({ playerId: joinId, playerName: joinName });
        await this.match.joinRoom(gameId, joinId, joinName);
        const resolvedPlayerId = this.gameContext.playerId || joinId;
        const statusPayload = (await this.match.getGameStatus(gameId, resolvedPlayerId)) as GameStatusResponse;
        await this.engine.loadGameResources(gameId, resolvedPlayerId, statusPayload);
        await this.engine.updateGameStatus(gameId, resolvedPlayerId, {
          fromScenario: true,
          silent: true,
          statusPayload,
        });
      } else {
        const hostName = playerNameParam || this.gameContext.playerName || "Demo Player";
        this.contextStore.update({ playerName: hostName });
        await this.match.startAsHost(this.gameContext.playerId, { playerName: hostName });
        // Capture gameId from the match state after hosting is created.
        const state = this.match.getState();
        if (state.gameId) {
          this.contextStore.update({ gameId: state.gameId });
        }
      }
    } catch (err) {
      console.error("Session init failed", err);
      const params = new URLSearchParams(window.location.search);
      const fallbackGameId =
        this.gameContext.mode === GameMode.Join
          ? params.get("gameId") || params.get("roomid") || "join-local"
          : `demo-${Date.now()}`;
      // Fallback to a local ready state so the UI remains usable even if API/host is unreachable.
      this.offlineFallback = true;
      this.gameContext.gameId = fallbackGameId;
      this.headerControls?.setStatusFromEngine?.(GameStatus.Ready, { offlineFallback: true });
      // Keep UI clean; log error only.
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      console.warn("Using offline fallback:", msg);
    }
  }

  private setupActions() {
    const baseControls = this.baseControls;
    this.actionDispatcher.register(0, () => {
      const promise = this.shuffleManager?.play();
      promise?.then(() =>{
        this.showDefaultUI();
      });
    });
    this.actionDispatcher.register(1, () => {
      if (!baseControls) return;
      this.playerBaseStatus = this.playerBaseStatus === "rested" ? "normal" : "rested";
      baseControls.setBaseStatus(true, this.playerBaseStatus);
      baseControls.setBaseBadgeLabel(true, this.playerBaseStatus === "rested" ? "2|3" : "0|3");
    });
    this.actionDispatcher.register(2, () => {
      if (!baseControls) return;
      baseControls.setBaseStatus(true, "normal");
      baseControls.setBaseBadgeLabel(true, "0|0");
    });
    this.actionDispatcher.register(3, () => {
      if (!baseControls) return;
      this.playerShieldCount = (this.playerShieldCount + 1) % 7;
      baseControls.setShieldCount(true, this.playerShieldCount);
      baseControls.setBaseBadgeLabel(true, `${this.playerShieldCount}|6`);
    });
    this.actionDispatcher.register(9, () => this.startGame());
  }



}
