import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { OptionChoiceDialog } from "../ui/OptionChoiceDialog";
import { findCardByUid } from "../utils/CardLookup";
import { getNotificationQueue } from "../utils/NotificationUtils";
import { findTopDeckViewedCard } from "../utils/TutorNotificationUtils";
import { createLogger } from "../utils/logger";

type OptionChoiceDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  optionChoiceDialog?: OptionChoiceDialog | null;
  refreshActions: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
};

export class OptionChoiceFlowManager {
  private readonly log = createLogger("OptionChoiceFlow");
  private queueEntry?: any;
  private requestPending = false;
  private shownEntryId?: string;
  private submittedEntryId?: string;
  private submittedAt?: number;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;

  constructor(private deps: OptionChoiceDeps) {}

  async handleNotification(notification: any, raw: any): Promise<void> {
    const entry = this.buildEntryFromNotification(notification);
    if (!entry || !this.isOptionChoiceEntry(entry)) return;
    const decisionMade = entry?.data?.userDecisionMade === true;
    this.queueEntry = entry;
    this.requestPending = false;
    this.shownEntryId = undefined;
    if (this.submittedEntryId && this.submittedEntryId !== entry.id) {
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
    }
    this.log.warn("option choice notification start", {
      entryId: entry.id,
      playerId: entry.playerId,
      decisionMade,
    });
    if (decisionMade) return;

    const selfId = this.deps.gameContext.playerId;
    const isOwner = entry.playerId === selfId;
    this.applyActionBar();
    this.showDialog(raw);
    if (!isOwner) {
      return;
    }
    this.pendingPromise =
      this.pendingPromise ??
      new Promise<void>((resolve) => {
        this.pendingResolve = resolve;
      });
    await this.pendingPromise;
  }

  syncDecisionState(raw: any) {
    const active = this.getActiveChoiceEntry(raw);
    const entry = active?.entry;
    if (!entry || !this.isOptionChoiceEntry(entry)) {
      if (this.queueEntry) {
        this.log.debug("option choice cleared from snapshot", { entryId: this.queueEntry?.id });
        this.resolvePending();
        this.clear();
      }
      return;
    }

    const decisionMade = entry?.data?.userDecisionMade === true;
    if (decisionMade) {
      this.resolvePending();
      this.clear();
      return;
    }

    const switching = !this.queueEntry || this.queueEntry.id !== entry.id;
    if (switching) {
      this.log.debug("option choice active prompt sync", { from: this.queueEntry?.id, to: entry.id });
      this.queueEntry = entry;
      this.resolvePending();
      this.requestPending = false;
      this.shownEntryId = undefined;
      if (this.submittedEntryId && this.submittedEntryId !== entry.id) {
        this.submittedEntryId = undefined;
        this.submittedAt = undefined;
      }
    }

    // If the user already submitted a choice, keep the dialog hidden until it resolves.
    if (this.queueEntry?.id && this.submittedEntryId === this.queueEntry.id) {
      const ageMs = Date.now() - (this.submittedAt ?? 0);
      // Safety valve: if the backend didn't accept/resolve for a while, allow the user to re-open and retry.
      if (!Number.isFinite(ageMs) || ageMs < 4000) {
        this.applyPostSubmitState();
        return;
      }
      this.log.warn("option choice still unresolved after submit; allow retry", {
        entryId: this.queueEntry.id,
        ageMs,
      });
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
      this.shownEntryId = undefined;
    }

    this.applyActionBar();
    this.showDialog(raw);
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

  private applyPostSubmitState() {
    // Keep the game from feeling "stuck": close the modal, and resume the timer since the player already acted.
    this.deps.optionChoiceDialog?.hide();
    this.deps.onTimerResume?.();
    this.deps.actionControls?.setWaitingForOpponent?.(false);
    this.deps.actionControls?.setState?.({ descriptors: [] });
  }

  private showDialog(raw: any) {
    const dialog = this.deps.optionChoiceDialog;
    if (!dialog || !this.queueEntry) return;
    if (this.shownEntryId === this.queueEntry.id && dialog.isOpen()) return;

    const selfId = this.deps.gameContext.playerId;
    const isOwner = this.queueEntry.playerId === selfId;
    if (!isOwner) {
      // Opponent shouldn't see the looked-at card/options (pre-reveal). Action bar already shows waiting state.
      dialog.hide();
      this.shownEntryId = this.queueEntry.id;
      return;
    }

    const options = Array.isArray(this.queueEntry?.data?.availableOptions) ? this.queueEntry.data.availableOptions : [];
    const dialogOptions = options.map((o: any) => ({
      index: Number(o?.index ?? 0),
      label: String(o?.label ?? `Option ${o?.index ?? ""}`),
      enabled: o?.enabled !== false,
    }));

    const looked = this.queueEntry?.data?.context?.tutor?.lookedCarduids;
    const lookedUid = Array.isArray(looked) ? looked[0] : undefined;
    const card = isOwner ? this.resolveLookedCard(raw, lookedUid) : undefined;

    dialog.show({
      headerText: "Choose Option",
      card,
      options: dialogOptions,
      showButtons: isOwner,
      showOverlay: true,
      showTimer: true,
      onSelect: async (index) => {
        await this.submitChoice(index);
      },
      onTimeout: async () => {
        const index = this.resolveTimeoutIndex(options);
        await this.submitChoice(index);
      },
    });
    this.shownEntryId = this.queueEntry.id;
  }

  private resolveTimeoutIndex(options: any[]): number {
    const normalized = Array.isArray(options) ? options : [];
    const bottom = normalized.find((o) => {
      const payloadAction = (o?.payload?.action ?? "").toString().toUpperCase();
      if (payloadAction === "BOTTOM") return true;
      const label = (o?.label ?? "").toString().toLowerCase();
      return label.includes("bottom");
    });
    if (bottom && typeof bottom.index === "number") return bottom.index;
    const firstEnabled = normalized.find((o) => o?.enabled !== false);
    if (firstEnabled && typeof firstEnabled.index === "number") return firstEnabled.index;
    const first = normalized[0];
    return typeof first?.index === "number" ? first.index : 0;
  }

  private resolveLookedCard(raw: any, cardUid?: string) {
    if (!cardUid) return undefined;
    const lookup = findCardByUid(raw, cardUid);
    if (lookup) {
      return { carduid: lookup.cardUid, cardId: lookup.id, cardData: lookup.cardData };
    }
    const notifications = getNotificationQueue(raw);
    const match = findTopDeckViewedCard(notifications as any, {
      playerId: this.queueEntry?.playerId,
      effectId: this.queueEntry?.data?.effect?.effectId ?? this.queueEntry?.data?.effectId,
      cardUid,
    });
    if (match) {
      const id = match?.cardId ?? match?.id ?? cardUid;
      const cardData = match?.cardData ?? match;
      return { carduid: cardUid, cardId: id, cardData };
    }
    return undefined;
  }

  private async submitChoice(selectedOptionIndex: number) {
    if (!this.queueEntry || this.requestPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    this.requestPending = true;
    this.submittedEntryId = this.queueEntry.id;
    this.submittedAt = Date.now();
    this.deps.optionChoiceDialog?.hide();
    this.shownEntryId = this.queueEntry.id;
    this.deps.refreshActions();
    try {
      await this.deps.api.confirmOptionChoice({
        gameId,
        playerId,
        eventId: this.queueEntry.id,
        selectedOptionIndex,
      });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (err) {
      void err;
      // If submit failed, allow immediate retry.
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
      this.shownEntryId = undefined;
    } finally {
      this.requestPending = false;
      this.resolvePending();
      this.deps.refreshActions();
    }
  }

  private getActiveChoiceEntry(raw: any): { entry: any } | undefined {
    const processingQueue = raw?.gameEnv?.processingQueue ?? raw?.processingQueue;
    if (Array.isArray(processingQueue) && processingQueue.length) {
      for (let i = processingQueue.length - 1; i >= 0; i -= 1) {
        const entry: any = processingQueue[i];
        if (!entry) continue;
        if (!this.isOptionChoiceEntry(entry)) continue;
        const status = (entry?.status ?? "").toString().toUpperCase();
        if (status && status === "RESOLVED") continue;
        const decision = entry?.data?.userDecisionMade;
        if (decision !== false) continue;
        return { entry };
      }
    }

    const notifications = getNotificationQueue(raw);
    for (let i = notifications.length - 1; i >= 0; i -= 1) {
      const note: any = notifications[i];
      if (!note) continue;
      const type = (note?.type ?? "").toString().toUpperCase();
      if (type !== "OPTION_CHOICE") continue;
      const payload = note.payload ?? {};
      const event = payload.event ?? payload;
      if (!this.isOptionChoiceEntry(event)) continue;
      const status = (event?.status ?? "").toString().toUpperCase();
      if (status && status === "RESOLVED") continue;
      const decision = event?.data?.userDecisionMade;
      if (decision !== false) continue;
      return { entry: event };
    }
    return undefined;
  }

  private isOptionChoiceEntry(entry?: any) {
    return !!entry && ((entry.type || "").toString().toUpperCase() === "OPTION_CHOICE");
  }

  private resolvePending() {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.pendingPromise = undefined;
    resolve();
  }

  private buildEntryFromNotification(note: any) {
    if (!note) return undefined;
    const event = note?.payload?.event ?? note?.payload ?? {};
    return {
      id: event?.id ?? note?.id,
      type: event?.type ?? note?.type,
      status: event?.status,
      playerId: event?.playerId ?? note?.payload?.playerId,
      data: event?.data ?? note?.payload?.data,
      rawNotification: note,
    };
  }

  private clear() {
    const entryId = this.queueEntry?.id;
    this.queueEntry = undefined;
    this.requestPending = false;
    this.shownEntryId = undefined;
    this.submittedEntryId = undefined;
    this.submittedAt = undefined;
    this.pendingPromise = undefined;
    this.pendingResolve = undefined;
    this.log.debug("cleared", { entryId });
    this.deps.optionChoiceDialog?.hide();
    this.deps.onTimerResume?.();
  }
}
