import type { AnimationContext } from "./AnimationTypes";
import type { SlotOwner, SlotPositionMap, SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";
import type { EffectTargetController } from "../controllers/EffectTargetController";
import type { GameEndInfo } from "../scene/gameEndHelpers";
import { buildNotificationHandlers, type NotificationHandler } from "./NotificationHandlers";
import { orderNotificationsForAnimation } from "./NotificationOrdering";
import { isDebugFlagEnabled } from "../utils/debugFlags";

type QueueItem = {
  event: SlotNotification;
  ctx: AnimationContext;
};

export class AnimationQueue {
  private queue: QueueItem[] = [];
  private running = false;
  private pendingIds = new Set<string>();
  private completedIds = new Set<string>();
  private completedOrder: string[] = [];
  private incompleteCommandPlayIds = new Set<string>();
  private replayedCompletedCommandIds = new Set<string>();
  private onIdle?: () => void;
  private onEventStart?: (event: SlotNotification, ctx: AnimationContext) => void;
  private onEventEnd?: (event: SlotNotification, ctx: AnimationContext) => void;
  private handlers: Map<string, NotificationHandler>;
  private readonly debug = isDebugFlagEnabled("debugAnimationQueue");

  constructor(
    private deps: {
      cardPlayAnimator: NotificationAnimationController;
      battleAnimator: BattleAnimationManager;
      attackIndicator: AttackIndicatorController;
      effectTargetController?: EffectTargetController;
      onGameEnded?: (info: GameEndInfo) => void;
      burstChoiceFlow?: import("../controllers/BurstChoiceFlowManager").BurstChoiceFlowManager;
      burstChoiceGroupFlow?: import("../controllers/BurstChoiceGroupFlowManager").BurstChoiceGroupFlowManager;
      optionChoiceFlow?: import("../controllers/OptionChoiceFlowManager").OptionChoiceFlowManager;
      promptChoiceFlow?: import("../controllers/PromptChoiceFlowManager").PromptChoiceFlowManager;
      tokenChoiceFlow?: import("../controllers/TokenChoiceFlowManager").TokenChoiceFlowManager;
      refreshSnapshot?: (event: SlotNotification, ctx: AnimationContext) => Promise<any> | any;
      getSlotsFromRaw?: (raw: any) => SlotViewModel[];
      phasePopup?: { showPhaseChange: (nextPhase: string) => Promise<void> | void };
      mulliganDialog?: {
        showPrompt: (opts: { prompt?: string; onYes?: () => Promise<void> | void; onNo?: () => Promise<void> | void }) => Promise<boolean>;
      };
      chooseFirstPlayerDialog?: {
        showPrompt: (opts: {
          onFirst?: () => Promise<void> | void;
          onSecond?: () => Promise<void> | void;
        }) => Promise<boolean>;
      };
      onTurnStartDrawPopupStart?: () => void;
      onTurnStartDrawPopupEnd?: () => void;
      turnOrderStatusDialog?: { showMessage: (promptText: string, headerText?: string) => void; hide: () => void };
      waitingOpponentDialog?: { hide: () => void };
      mulliganWaitingDialog?: { hide: () => void };
      coinFlipOverlay?: { play: () => Promise<void> | void };
      startGame?: () => Promise<void> | void;
      startReady?: (isRedraw: boolean) => Promise<void> | void;
      chooseFirstPlayer?: (chosenFirstPlayerId: string) => Promise<void> | void;
      slotControls?: { playStatPulse?: (slotKey: string, delta: number) => Promise<void> | void } | null;
    },
    private opts: {
      maxProcessed?: number;
    } = {},
  ) {
    this.handlers = buildNotificationHandlers(this.deps, {
      triggerStatPulse: this.triggerStatPulse.bind(this),
    });
  }

  setOnIdle(handler?: () => void) {
    this.onIdle = handler;
  }

  setOnEventStart(handler?: (event: SlotNotification, ctx: AnimationContext) => void) {
    this.onEventStart = handler;
  }

  setOnEventEnd(handler?: (event: SlotNotification, ctx: AnimationContext) => void) {
    this.onEventEnd = handler;
  }

  isRunning() {
    return this.running;
  }

  clearAttackIndicator() {
    this.deps.attackIndicator.clear();
  }

  async syncAttackIndicator(
    event: SlotNotification | undefined,
    slots: SlotViewModel[],
    boardSlotPositions?: SlotPositionMap | null,
  ) {
    await this.deps.attackIndicator.updateFromNotification(event, slots, boardSlotPositions ?? undefined);
  }

  isProcessed(id: string) {
    return this.completedIds.has(id);
  }

  private isNewEventId(id: string) {
    return !this.pendingIds.has(id) && !this.completedIds.has(id);
  }

  buildEvents(notificationQueue: SlotNotification[]): SlotNotification[] {
    if (!Array.isArray(notificationQueue) || notificationQueue.length === 0) {
      return [];
    }
    const orderedQueue = orderNotificationsForAnimation(notificationQueue);
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[AnimationQueue] buildEvents queue", orderedQueue.map((n) => `${n.type}:${n.id}`));
    }
    const hasBurstGroup = orderedQueue.some(
      (note) => (note?.type ?? "").toString().toUpperCase() === "BURST_EFFECT_CHOICE_GROUP",
    );

    const events: SlotNotification[] = [];
    orderedQueue.forEach((note) => {
      if (!note || !note.id) return;
      const type = (note.type || "").toUpperCase();
      const replayCompletedCommand = this.shouldReplayCompletedCommand(note);
      if (hasBurstGroup && (type === "BURST_EFFECT_CHOICE" || type === "BURST_EFFECT_CHOICE_RESOLVED")) {
        return;
      }
      // Only return events that will actually be enqueued/animated.
      // BoardScene uses this list to seed render snapshots; including already-processed events can
      // cause stale "ghost" visuals (e.g. destroyed units reappearing briefly).
      if (!this.isNewEventId(note.id) && !replayCompletedCommand) {
        return;
      }
      if (!this.handlers.has(type)) return;
      if (replayCompletedCommand) {
        this.replayedCompletedCommandIds.add(note.id);
      }
      events.push(note);
    });
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[AnimationQueue] buildEvents events", events.map((n) => `${n.type}:${n.id}`));
    }
    return events;
  }

  enqueue(events: SlotNotification[], ctx: AnimationContext) {
    events.forEach((event) => {
      if (!event.id) return;
      if (!this.isNewEventId(event.id)) return;
      this.markPending(event.id);
      this.queue.push({ event, ctx });
    });
    this.runIfIdle();
  }

  private runIfIdle() {
    if (this.running) return;
    if (this.queue.length === 0) {
      this.onIdle?.();
      return;
    }
    this.running = true;
    this.runNext();
  }

  private async runNext() {
    const item = this.queue.shift();
    if (!item) {
      this.running = false;
      this.onIdle?.();
      return;
    }
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[AnimationQueue] runNext", { type: item.event?.type, id: item.event?.id });
    }
    this.onEventStart?.(item.event, item.ctx);
    try {
      await this.runEvent(item.event, item.ctx);
    } catch (err) {
      void err;
    } finally {
      if (item.event?.id) {
        this.markCompleted(item.event);
      }
      this.onEventEnd?.(item.event, item.ctx);
      this.runNext();
    }
  }

  private markPending(id: string) {
    this.pendingIds.add(id);
  }

  private markCompleted(event: SlotNotification) {
    const id = event.id;
    this.pendingIds.delete(id);
    this.completedIds.add(id);
    this.completedOrder.push(id);
    this.trackCommandPlayLifecycle(event);
    const max = this.opts.maxProcessed ?? 1000;
    while (this.completedOrder.length > max) {
      const oldest = this.completedOrder.shift();
      if (oldest) {
        this.completedIds.delete(oldest);
      }
    }
  }

  private async runEvent(event: SlotNotification, ctx: AnimationContext): Promise<void> {
    const type = (event.type || "").toUpperCase();
    const handler = this.handlers.get(type);
    if (!handler) return;
    await handler(event, ctx);
  }

  private shouldReplayCompletedCommand(note: SlotNotification): boolean {
    if (!note?.id) return false;
    if (this.pendingIds.has(note.id)) return false;
    if (!this.completedIds.has(note.id)) return false;
    if (this.replayedCompletedCommandIds.has(note.id)) return false;
    if (!this.incompleteCommandPlayIds.has(note.id)) return false;
    return this.isCompletedCommandPlay(note);
  }

  private trackCommandPlayLifecycle(note: SlotNotification) {
    if (!note?.id) return;
    if (this.isIncompleteCommandPlay(note)) {
      this.incompleteCommandPlayIds.add(note.id);
      return;
    }
    if (this.isCompletedCommandPlay(note)) {
      this.replayedCompletedCommandIds.add(note.id);
    }
  }

  private isIncompleteCommandPlay(note: SlotNotification): boolean {
    if (!this.isCommandPlayType(note)) return false;
    const payload: any = note.payload ?? {};
    return payload?.isCompleted === false;
  }

  private isCompletedCommandPlay(note: SlotNotification): boolean {
    if (!this.isCommandPlayType(note)) return false;
    const payload: any = note.payload ?? {};
    return payload?.isCompleted !== false;
  }

  private isCommandPlayType(note: SlotNotification): boolean {
    const type = (note?.type ?? "").toString().toUpperCase();
    if (type !== "CARD_PLAYED" && type !== "CARD_PLAYED_COMPLETED") return false;
    const playAs = (note?.payload as any)?.playAs;
    return (playAs ?? "").toString().toLowerCase() === "command";
  }

  private async triggerStatPulse(event: SlotNotification, ctx: AnimationContext) {
    const payload = event.payload ?? {};
    const delta = this.normalizeDelta(payload);
    if (delta === 0) return;
    const slotKey = this.resolveSlotKey(payload, ctx.slots, ctx.resolveSlotOwnerByPlayer);
    if (!slotKey) return;
    const pulse = this.deps.slotControls?.playStatPulse;
    if (!pulse) return;
    await Promise.resolve(pulse(slotKey, delta));
  }

  private normalizeDelta(payload: any): number {
    const delta = payload?.delta ?? payload?.modifierValue;
    if (typeof delta === "number") return delta;
    const parsed = Number(delta);
    if (Number.isFinite(parsed)) return parsed;

    // Damage events provide "damage" and should pulse as a negative HP delta.
    const damage = payload?.damage;
    const damageNum = typeof damage === "number" ? damage : Number(damage);
    if (Number.isFinite(damageNum) && damageNum !== 0) {
      return -damageNum;
    }

    return 0;
  }

  private resolveSlotKey(
    payload: any,
    slots: SlotViewModel[],
    resolveOwner?: (playerId?: string) => SlotOwner | undefined,
  ): string | undefined {
    const owner = resolveOwner?.(payload?.playerId);
    const zone = typeof payload?.zone === "string" ? payload.zone : undefined;
    const slotId = zone || payload?.slotId || payload?.slot;
    if (owner && slotId) {
      return `${owner}-${slotId}`;
    }
    const cardUid = payload?.carduid ?? payload?.cardUid;
    if (cardUid) {
      const slot = slots.find((entry) => entry.unit?.cardUid === cardUid || entry.pilot?.cardUid === cardUid);
      if (slot) {
        return `${slot.owner}-${slot.slotId}`;
      }
    }
    return undefined;
  }
}
