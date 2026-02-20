import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { OptionChoiceDialog } from "../ui/OptionChoiceDialog";
import { createLogger } from "../utils/logger";
import { buildChoiceEntryFromNotification, findActiveChoiceEntryFromRaw } from "./choice/ChoiceFlowUtils";
import { resolveOptionCardId } from "./choice/OptionChoiceCardResolver";
import { applyChoiceActionBarState, cleanupDialog, isChoiceOwner } from "./choice/ChoiceUiLifecycle";

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

export type OptionDialogChoiceView = {
  index: number;
  mode: "card" | "text";
  cardId?: string;
  label?: string;
  enabled: boolean;
};

export function mapOptionChoiceToDialogView(raw: any, option: any): OptionDialogChoiceView {
  const display = option?.display && typeof option.display === "object" ? option.display : {};
  const explicitMode = (display?.mode ?? "").toString().toLowerCase();
  const modeFromContract = explicitMode === "card" || explicitMode === "text" ? (explicitMode as "card" | "text") : undefined;

  const payload = option?.payload ?? {};
  const cardId =
    (display?.cardId ?? payload?.cardId ?? payload?.sourceCardId ?? payload?.source?.cardId ?? option?.cardId ?? undefined) ||
    resolveOptionCardId(raw, option);

  const inferredMode: "card" | "text" = cardId ? "card" : "text";
  const mode = modeFromContract ?? inferredMode;
  const label = (display?.label ?? option?.label ?? "").toString() || undefined;

  return {
    index: Number(option?.index ?? 0),
    mode,
    cardId: cardId ? String(cardId) : undefined,
    label,
    enabled: option?.enabled !== false,
  };
}

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
    const entry = buildChoiceEntryFromNotification(notification);
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

    const isOwner = isChoiceOwner(entry.playerId, this.deps.gameContext.playerId);
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
    const entry = findActiveChoiceEntryFromRaw(raw, "OPTION_CHOICE");
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
    const isOwner = isChoiceOwner(this.queueEntry.playerId, this.deps.gameContext.playerId);
    this.log.debug("applyActionBar", { entryId: this.queueEntry.id, isOwner });
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
    cleanupDialog(this.deps.optionChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
  }

  private applyPostSubmitState() {
    // Keep the game from feeling "stuck": close the modal, and resume the timer since the player already acted.
    cleanupDialog(this.deps.optionChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
  }

  private showDialog(raw: any) {
    const dialog = this.deps.optionChoiceDialog;
    if (!dialog || !this.queueEntry) return;
    if (this.shownEntryId === this.queueEntry.id && dialog.isOpen()) return;

    const isOwner = isChoiceOwner(this.queueEntry.playerId, this.deps.gameContext.playerId);
    if (!isOwner) {
      dialog.hide();
      this.shownEntryId = undefined;
      return;
    }

    const options = Array.isArray(this.queueEntry?.data?.availableOptions) ? this.queueEntry.data.availableOptions : [];
    const dialogChoices = options.map((o: any) => mapOptionChoiceToDialogView(raw, o));

    dialog.show({
      headerText: "Choose Option",
      choices: dialogChoices,
      showChoices: isOwner,
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
    cleanupDialog(this.deps.optionChoiceDialog, this.deps.actionControls, this.deps.onTimerResume);
  }
}
