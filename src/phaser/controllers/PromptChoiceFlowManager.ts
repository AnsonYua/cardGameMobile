import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { PromptChoiceDialog } from "../ui/PromptChoiceDialog";
import type { TutorTopDeckRevealDialog } from "../ui/TutorTopDeckRevealDialog";
import { createLogger } from "../utils/logger";
import { buildChoiceEntryFromNotification, findActiveChoiceEntryFromRaw } from "./choice/ChoiceFlowUtils";
import { applyChoiceActionBarState, cleanupDialog, isChoiceOwner } from "./choice/ChoiceUiLifecycle";
import { hidePromptChoiceDialogs, isPromptChoiceDialogOpen, showPromptChoiceDialog } from "./choice/PromptChoiceDialogRouter";

type PromptChoiceDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  promptChoiceDialog?: PromptChoiceDialog | null;
  tutorTopDeckRevealDialog?: TutorTopDeckRevealDialog | null;
  refreshActions: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
};

export class PromptChoiceFlowManager {
  private readonly log = createLogger("PromptChoiceFlow");
  private queueEntry?: any;
  private requestPending = false;
  private shownEntryId?: string;
  private submittedEntryId?: string;
  private submittedAt?: number;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;

  constructor(private deps: PromptChoiceDeps) {}

  async handleNotification(notification: any, raw: any): Promise<void> {
    const entry = buildChoiceEntryFromNotification(notification);
    if (!entry || !this.isPromptChoiceEntry(entry)) return;
    const decisionMade = entry?.data?.userDecisionMade === true;
    this.queueEntry = entry;
    this.requestPending = false;
    this.shownEntryId = undefined;
    if (this.submittedEntryId && this.submittedEntryId !== entry.id) {
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
    }
    this.log.warn("prompt choice notification start", {
      entryId: entry.id,
      playerId: entry.playerId,
      decisionMade,
    });
    if (decisionMade) return;

    const isOwner = isChoiceOwner(entry.playerId, this.deps.gameContext.playerId);
    this.applyActionBar();
    this.showDialog();
    if (!isOwner) return;

    this.pendingPromise =
      this.pendingPromise ??
      new Promise<void>((resolve) => {
        this.pendingResolve = resolve;
      });
    await this.pendingPromise;
  }

  syncDecisionState(raw: any) {
    const entry = findActiveChoiceEntryFromRaw(raw, "PROMPT_CHOICE");
    if (!entry || !this.isPromptChoiceEntry(entry)) {
      if (this.queueEntry) {
        this.log.debug("prompt choice cleared from snapshot", { entryId: this.queueEntry?.id });
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
      this.log.debug("prompt choice active prompt sync", { from: this.queueEntry?.id, to: entry.id });
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
      if (!Number.isFinite(ageMs) || ageMs < 4000) {
        this.applyPostSubmitState();
        return;
      }
      this.log.warn("prompt choice still unresolved after submit; allow retry", {
        entryId: this.queueEntry.id,
        ageMs,
      });
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
      this.shownEntryId = undefined;
    }

    this.applyActionBar();
    this.showDialog();
  }

  applyActionBar() {
    if (!this.queueEntry) return false;
    applyChoiceActionBarState({
      ownerPlayerId: this.queueEntry.playerId,
      selfPlayerId: this.deps.gameContext.playerId,
      actionControls: this.deps.actionControls,
      onTimerPause: this.deps.onTimerPause,
      onTimerResume: this.deps.onTimerResume,
    });
    return true;
  }

  isActive() {
    return !!this.queueEntry;
  }

  ensureInactiveUi() {
    if (this.queueEntry) return;
    cleanupDialog(this.deps.promptChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
    hidePromptChoiceDialogs(this.deps);
  }

  private applyPostSubmitState() {
    cleanupDialog(this.deps.promptChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
    hidePromptChoiceDialogs(this.deps);
  }

  private showDialog() {
    if (!this.queueEntry) return;
    const hasDialog = this.deps.promptChoiceDialog || this.deps.tutorTopDeckRevealDialog;
    if (!hasDialog) return;
    if (this.shownEntryId === this.queueEntry.id && isPromptChoiceDialogOpen(this.queueEntry, this.deps)) return;

    const isOwner = isChoiceOwner(this.queueEntry.playerId, this.deps.gameContext.playerId);
    if (!isOwner) {
      hidePromptChoiceDialogs(this.deps);
      this.shownEntryId = undefined;
      return;
    }

    showPromptChoiceDialog({
      entry: this.queueEntry,
      promptChoiceDialog: this.deps.promptChoiceDialog,
      tutorTopDeckRevealDialog: this.deps.tutorTopDeckRevealDialog,
      resolveTimeoutIndex: (options) => this.resolveTimeoutIndex(options),
      onSubmit: async (index) => {
        await this.submitChoice(index);
      },
    });
    this.shownEntryId = this.queueEntry.id;
  }

  private resolveTimeoutIndex(options: any[]): number {
    const fallback = Number(this.queueEntry?.data?.defaultOptionIndex ?? NaN);
    if (Number.isFinite(fallback)) return fallback;
    const firstEnabled = options.find((o) => o?.enabled !== false);
    if (firstEnabled && typeof firstEnabled.index === "number") return firstEnabled.index;
    const first = options[0];
    return typeof first?.index === "number" ? first.index : 0;
  }

  private async submitChoice(selectedOptionIndex: number) {
    if (!this.queueEntry || this.requestPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    this.requestPending = true;
    this.submittedEntryId = this.queueEntry.id;
    this.submittedAt = Date.now();
    hidePromptChoiceDialogs(this.deps);
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
      this.submittedEntryId = undefined;
      this.submittedAt = undefined;
      this.shownEntryId = undefined;
    } finally {
      this.requestPending = false;
      this.resolvePending();
      this.deps.refreshActions();
    }
  }

  private isPromptChoiceEntry(entry?: any) {
    return !!entry && ((entry.type || "").toString().toUpperCase() === "PROMPT_CHOICE");
  }

  private resolvePending() {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.pendingPromise = undefined;
    resolve();
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
    cleanupDialog(this.deps.promptChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
    hidePromptChoiceDialogs(this.deps);
  }
}
