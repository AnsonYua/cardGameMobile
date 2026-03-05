import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import { findCardByUid } from "../utils/CardLookup";
import { findActiveBurstChoiceNotification } from "../utils/NotificationUtils";
import { createLogger } from "../utils/logger";
import { withInteractionLoading } from "./InteractionHooks";
import type { InteractionHooks } from "./InteractionHooks";

type BurstChoiceDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  burstChoiceDialog?: BurstChoiceDialog | null;
  refreshActions: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
} & InteractionHooks;

export class BurstChoiceFlowManager {
  private readonly log = createLogger("BurstChoiceFlow");
  private queueEntry?: any;
  private requestPending = false;
  private shownEntryId?: string;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;
  private pendingNotificationId?: string;

  constructor(private deps: BurstChoiceDeps) {}

  /**
   * Keep burst dialog state aligned with snapshot progress without opening new prompts.
   * Used when another blocking choice currently owns queue progression.
   */
  reconcileResolvedState(raw: any) {
    const notifications = this.getNotificationQueue(raw);
    const preferChoiceKey = this.queueEntry?.eventId ?? this.queueEntry?.id;
    const active = findActiveBurstChoiceNotification(notifications, { preferChoiceKey });
    if (active) return;

    const dialogOpen = this.deps.burstChoiceDialog?.isOpen?.() === true;
    if (!this.queueEntry && !this.pendingResolve && !dialogOpen) {
      return;
    }

    this.log.debug("reconcileResolvedState clear stale burst dialog", {
      entryId: this.queueEntry?.id,
      dialogOpen,
    });
    this.resolvePending();
    this.clear();
  }

  syncDecisionState(raw: any) {
    const notifications = this.getNotificationQueue(raw);
    const preferChoiceKey = this.queueEntry?.eventId ?? this.queueEntry?.id;
    const active = findActiveBurstChoiceNotification(notifications, { preferChoiceKey });
    if (!active) {
      if (this.queueEntry || this.pendingResolve) {
        if (this.queueEntry) {
          this.log.debug("burst prompt cleared from snapshot", { entryId: this.queueEntry?.id });
        }
        this.resolvePending();
        this.clear();
      }
      return;
    }

    const entry = this.buildEntryFromNotification(active);
    if (!entry || !this.isBurstChoiceEntry(entry)) return;
    const decisionMade = entry?.data?.userDecisionMade === true;
    if (decisionMade) {
      this.log.warn("resolve burst from snapshot (decision made)", {
        entryId: entry?.id,
        notificationId: entry?.notificationId,
      });
      this.resolvePending();
      this.clear();
      return;
    }

    const switching = !this.queueEntry || this.queueEntry.id !== entry.id;
    if (switching) {
      this.log.debug("burst active prompt sync", { from: this.queueEntry?.id, to: entry.id });
      this.resolvePending();
      this.queueEntry = entry;
      this.requestPending = false;
      this.pendingNotificationId = entry.notificationId;
      this.shownEntryId = undefined;
    }

    // Ensure UI (action bar + dialog) stays aligned with the active unresolved prompt.
    this.applyActionBar();
    this.showDialog(raw);
  }

  async handleNotification(notification: any, raw: any): Promise<void> {
    const entry = this.buildEntryFromNotification(notification);
    if (!entry || !this.isBurstChoiceEntry(entry)) return;
    this.queueEntry = entry;
    this.requestPending = false;
    this.pendingNotificationId = entry.notificationId;
    this.shownEntryId = undefined;
    const decisionMade = entry?.data?.userDecisionMade === true;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = entry.playerId === selfId;
    this.log.warn("burst notification start", {
      entryId: entry.id,
      notificationId: entry.notificationId,
      playerId: entry.playerId,
      isOwner,
      decisionMade,
    });
    if (decisionMade) {
      return;
    }
    this.applyActionBar();
    if (!isOwner) {
      // Opponent should still see which burst card was revealed, but cannot act on it.
      this.showDialog(raw);
      return;
    }
    this.pendingPromise =
      this.pendingPromise ??
      new Promise<void>((resolve) => {
        this.pendingResolve = resolve;
      });
    this.showDialog(raw);
    await this.pendingPromise;
  }

  async handleResolvedNotification(notification: any): Promise<void> {
    const payload = notification?.payload ?? {};
    const eventId = payload?.eventId;
    if (!this.queueEntry) return;
    if (eventId && this.queueEntry.eventId && eventId !== this.queueEntry.eventId) {
      return;
    }
    this.log.warn("burst resolved notification", {
      entryId: this.queueEntry.id,
      notificationId: notification?.id,
      eventId,
      userDecision: payload?.userDecision,
    });
    this.resolvePending();
    this.clear();
  }

  applyActionBar() {
    if (!this.queueEntry) return false;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = this.queueEntry.playerId === selfId;
    this.log.debug("applyActionBar", { entryId: this.queueEntry.id, isOwner });
    if (!isOwner) {
      this.deps.onTimerPause?.();
      this.deps.actionControls?.setWaitingForOpponent?.(true);
      this.deps.actionControls?.setState?.({ descriptors: [] });
      return true;
    }
    this.deps.actionControls?.setWaitingForOpponent?.(false);
    this.deps.actionControls?.setState?.({ descriptors: [] });
    return true;
  }

  isActive() {
    return !!this.queueEntry;
  }

  private showDialog(raw: any) {
    const dialog = this.deps.burstChoiceDialog;
    if (!dialog || !this.queueEntry) {
      this.log.debug("showDialog skipped: missing dialog or entry", {
        hasDialog: Boolean(dialog),
        hasEntry: Boolean(this.queueEntry),
      });
      return;
    }
    if (this.shownEntryId === this.queueEntry.id && dialog.isOpen()) {
      this.log.debug("showDialog skipped: already open", {
        entryId: this.queueEntry.id,
      });
      return;
    }
    const selfId = this.deps.gameContext.playerId;
    const isOwner = this.queueEntry.playerId === selfId;
    const card = this.resolveCard(raw);
    if (!card) {
      this.log.debug("showDialog skipped: card not resolved", {
        entryId: this.queueEntry.id,
        carduid: this.queueEntry?.data?.carduid,
        targetCount: Array.isArray(this.queueEntry?.data?.availableTargets)
          ? this.queueEntry.data.availableTargets.length
          : 0,
      });
      return;
    }
    this.log.debug("showDialog", {
      entryId: this.queueEntry.id,
      isOwner,
      carduid: card?.carduid ?? card?.cardUid ?? card?.uid ?? card?.id,
      cardId: card?.cardId ?? card?.id,
    });

    dialog.show({
      card,
      header: "Burst Card",
      showButtons: isOwner,
      showTimer: isOwner,
      showOverlay: false,
      onTrigger: async () => {
        if (!isOwner) return;
        await this.submitChoice("ACTIVATE");
      },
      onCancel: async () => {
        if (!isOwner) return;
        await this.submitChoice("DECLINE");
      },
      onTimeout: async () => {
        if (!isOwner) return;
        await this.submitChoice("ACTIVATE");
      },
    });
    this.shownEntryId = this.queueEntry.id;
  }

  private resolvePending() {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.pendingPromise = undefined;
    resolve();
  }

  private resolveCard(raw: any) {
    const data = this.queueEntry?.data;
    const carduid = data?.carduid;
    const targets = Array.isArray(data?.availableTargets) ? data.availableTargets : [];
    if (carduid) {
      const match = targets.find((target: any) => target?.carduid === carduid);
      if (match) return match;
      const lookup = findCardByUid(raw, carduid);
      if (lookup) {
        return {
          carduid: lookup.cardUid ?? carduid,
          cardId: lookup.id,
          cardData: lookup.cardData,
        };
      }
    }
    return targets[0];
  }

  private async submitChoice(userDecision: "ACTIVATE" | "DECLINE") {
    if (!this.queueEntry || this.requestPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    const eventId = this.queueEntry.eventId ?? this.queueEntry.id;
    this.requestPending = true;
    const confirmed = userDecision === "ACTIVATE";
    this.log.debug("submitChoice", {
      entryId: this.queueEntry.id,
      userDecision,
      confirmed,
      playerId,
      gameId,
    });
    this.deps.burstChoiceDialog?.hide();
    this.shownEntryId = this.queueEntry.id;
    this.deps.refreshActions();
    try {
      await withInteractionLoading(this.deps, async () => {
        await this.deps.api.confirmBurstChoice({
          gameId,
          playerId,
          eventId,
          confirmed,
        });
        await this.deps.engine.updateGameStatus(gameId, playerId);
      });
      this.resolvePending();
      this.clear();
    } catch (err) {
      this.deps.onReportError?.(err, { headerText: "Action Failed" });
      console.error("[BurstChoiceFlowManager] confirmBurstChoice failed", {
        gameId,
        playerId,
        eventId,
        userDecision,
        error: err,
      });
      this.requestPending = false;
      this.deps.refreshActions();
      return;
    } finally {
      this.requestPending = false;
      this.deps.refreshActions();
    }
  }

  private getNotificationQueue(raw: any) {
    const queue = raw?.gameEnv?.notificationQueue ?? raw?.notificationQueue;
    return Array.isArray(queue) ? queue : [];
  }

  private buildEntryFromNotification(note: any) {
    if (!note) return undefined;
    const event = note?.payload?.event ?? note?.payload ?? {};
    return {
      id: event?.id ?? note?.id,
      eventId: event?.id,
      notificationId: note?.id,
      type: event?.type ?? note?.type,
      status: event?.status,
      playerId: event?.playerId ?? note?.payload?.playerId,
      data: event?.data ?? note?.payload?.data,
      rawNotification: note,
    };
  }

  private isBurstChoiceEntry(entry?: any) {
    return !!entry && ((entry.type || "").toString().toUpperCase() === "BURST_EFFECT_CHOICE");
  }


  private clear() {
    this.queueEntry = undefined;
    this.requestPending = false;
    this.shownEntryId = undefined;
    this.pendingNotificationId = undefined;
    this.pendingPromise = undefined;
    this.pendingResolve = undefined;
    this.log.debug("cleared");
    this.deps.burstChoiceDialog?.hide();
    this.deps.onTimerResume?.();
  }
}
