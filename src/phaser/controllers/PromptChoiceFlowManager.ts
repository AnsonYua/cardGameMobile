import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { PromptChoiceDialog } from "../ui/PromptChoiceDialog";
import { createLogger } from "../utils/logger";
import { buildChoiceEntryFromNotification, findActiveChoiceEntryFromRaw } from "./choice/ChoiceFlowUtils";

type PromptChoiceDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  promptChoiceDialog?: PromptChoiceDialog | null;
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

    const selfId = this.deps.gameContext.playerId;
    const isOwner = entry.playerId === selfId;
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
    const selfId = this.deps.gameContext.playerId;
    const isOwner = this.queueEntry.playerId === selfId;
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
    this.deps.promptChoiceDialog?.hide();
    this.deps.onTimerResume?.();
    this.deps.actionControls?.setWaitingForOpponent?.(false);
    this.deps.actionControls?.setState?.({ descriptors: [] });
  }

  private showDialog() {
    const dialog = this.deps.promptChoiceDialog;
    if (!dialog || !this.queueEntry) return;
    if (this.shownEntryId === this.queueEntry.id && dialog.isOpen()) return;

    const selfId = this.deps.gameContext.playerId;
    const isOwner = this.queueEntry.playerId === selfId;
    const headerText = (this.queueEntry?.data?.headerText ?? "Choose Option").toString();
    if (!isOwner) {
      dialog.show({
        headerText,
        promptText: "Opponent is deciding...",
        buttons: [],
        showOverlay: true,
        showTimer: false,
      });
      this.shownEntryId = this.queueEntry.id;
      return;
    }

    const promptText = (this.queueEntry?.data?.promptText ?? "").toString();
    const options = Array.isArray(this.queueEntry?.data?.availableOptions) ? this.queueEntry.data.availableOptions : [];
    const buttons = options.map((o: any) => ({
      label: (o?.label ?? "").toString() || `Option ${Number(o?.index ?? 0) + 1}`,
      enabled: o?.enabled !== false,
      onClick: async () => {
        await this.submitChoice(Number(o?.index ?? 0));
      },
    }));

    dialog.show({
      headerText,
      promptText,
      buttons,
      showOverlay: true,
      showTimer: true,
      onTimeout: async () => {
        const idx = this.resolveTimeoutIndex(options);
        await this.submitChoice(idx);
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
    this.deps.promptChoiceDialog?.hide();
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
    this.deps.promptChoiceDialog?.hide();
    this.deps.onTimerResume?.();
  }
}
