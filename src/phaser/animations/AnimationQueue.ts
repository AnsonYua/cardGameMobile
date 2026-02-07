import type { AnimationContext } from "./AnimationTypes";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";
import type { EffectTargetController } from "../controllers/EffectTargetController";
import type { GameEndInfo } from "../scene/gameEndHelpers";
import { buildNotificationHandlers, type NotificationHandler } from "./NotificationHandlers";

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
  private onIdle?: () => void;
  private onEventStart?: (event: SlotNotification, ctx: AnimationContext) => void;
  private onEventEnd?: (event: SlotNotification, ctx: AnimationContext) => void;
  private handlers: Map<string, NotificationHandler>;

  constructor(
    private deps: {
      cardPlayAnimator: NotificationAnimationController;
    battleAnimator: BattleAnimationManager;
    attackIndicator: AttackIndicatorController;
    effectTargetController?: EffectTargetController;
    onGameEnded?: (info: GameEndInfo) => void;
    burstChoiceFlow?: import("../controllers/BurstChoiceFlowManager").BurstChoiceFlowManager;
    burstChoiceGroupFlow?: import("../controllers/BurstChoiceGroupFlowManager").BurstChoiceGroupFlowManager;
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

  isProcessed(id: string) {
    return this.completedIds.has(id);
  }

  buildEvents(notificationQueue: SlotNotification[]): SlotNotification[] {
    if (!Array.isArray(notificationQueue) || notificationQueue.length === 0) {
      return [];
    }
    const hasBurstGroup = notificationQueue.some(
      (note) => (note?.type ?? "").toString().toUpperCase() === "BURST_EFFECT_CHOICE_GROUP",
    );
    const events: SlotNotification[] = [];
    notificationQueue.forEach((note) => {
      if (!note || !note.id) return;
      const type = (note.type || "").toUpperCase();
      if (hasBurstGroup && (type === "BURST_EFFECT_CHOICE" || type === "BURST_EFFECT_CHOICE_RESOLVED")) {
        return;
      }
      if (!this.handlers.has(type)) return;
      events.push(note);
    });
    // Prefer resolving stat changes before starting battle animations; battle animations hide the real slot
    // containers while their clones animate on top.
    const nonBattleResolved = events.filter((e) => (e?.type ?? "").toString().toUpperCase() !== "BATTLE_RESOLVED");
    const battleResolved = events.filter((e) => (e?.type ?? "").toString().toUpperCase() === "BATTLE_RESOLVED");
    return nonBattleResolved.concat(battleResolved);
  }

  enqueue(events: SlotNotification[], ctx: AnimationContext) {
    events.forEach((event) => {
      if (!event.id) return;
      if (this.pendingIds.has(event.id) || this.completedIds.has(event.id)) return;
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
    this.onEventStart?.(item.event, item.ctx);
    try {
      await this.runEvent(item.event, item.ctx);
    } catch (err) {
      void err;
    } finally {
      if (item.event?.id) {
        this.markCompleted(item.event.id);
      }
      this.onEventEnd?.(item.event, item.ctx);
      this.runNext();
    }
  }

  private markPending(id: string) {
    this.pendingIds.add(id);
  }

  private markCompleted(id: string) {
    this.pendingIds.delete(id);
    this.completedIds.add(id);
    this.completedOrder.push(id);
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
      const slot = slots.find(
        (entry) => entry.unit?.cardUid === cardUid || entry.pilot?.cardUid === cardUid,
      );
      if (slot) {
        return `${slot.owner}-${slot.slotId}`;
      }
    }
    return undefined;
  }
}
