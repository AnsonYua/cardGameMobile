import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { TokenChoiceDialog } from "../ui/TokenChoiceDialog";
import { createLogger } from "../utils/logger";
import {
  findActiveTokenChoiceFromRaw,
  findLatestTokenChoiceFromRaw,
  normalizeTokenChoiceNotification,
  type TokenChoiceNote,
} from "../utils/TokenChoiceNotificationUtils";

type TokenChoiceDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  tokenChoiceDialog?: TokenChoiceDialog | null;
  refreshActions: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
};

export class TokenChoiceFlowManager {
  private readonly log = createLogger("TokenChoiceFlow");
  private note?: TokenChoiceNote;
  private requestPending = false;
  private shownId?: string;
  private submittedId?: string;
  private submittedAt?: number;
  private ackPending = false;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;

  constructor(private deps: TokenChoiceDeps) {}

  async handleNotification(notification: any, raw: any): Promise<void> {
    const note = normalizeTokenChoiceNotification(notification);
    if (!note) return;

    this.note = note;
    this.requestPending = false;
    this.shownId = undefined;
    if (this.submittedId && this.submittedId !== note.id) {
      this.submittedId = undefined;
      this.submittedAt = undefined;
    }

    this.log.warn("token choice notification start", {
      id: note.id,
      playerId: note.playerId,
      isCompleted: note.isCompleted,
      decisionMade: note.decisionMade,
    });

    if (note.isCompleted) return;
    if (note.decisionMade) return;

    this.applyActionBar();
    this.showDialog();

    const selfId = this.deps.gameContext.playerId;
    const isOwner = !!selfId && note.playerId === selfId;
    if (!isOwner) {
      void raw;
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
    const note = findActiveTokenChoiceFromRaw(raw, { preferId: this.note?.id });
    if (!note) {
      if (this.note) {
        this.log.debug("token choice cleared from snapshot", { id: this.note.id });
        this.resolvePending();
        this.clear();
      }
      return;
    }

    const switching = !this.note || this.note.id !== note.id;
    if (switching) {
      this.log.debug("token choice active prompt sync", { from: this.note?.id, to: note.id });
      this.note = note;
      this.resolvePending();
      this.requestPending = false;
      this.shownId = undefined;
      this.submittedId = undefined;
      this.submittedAt = undefined;
      this.ackPending = false;
    }

    if (note.isCompleted) {
      void this.onCompleted(note);
      return;
    }

    // If the backend accepted the choice but hasn't flipped `isCompleted` yet, keep the owner from acting.
    if (note.decisionMade) {
      this.applyPostSubmitState();
      return;
    }

    if (this.note?.id && this.submittedId === this.note.id) {
      const ageMs = Date.now() - (this.submittedAt ?? 0);
      if (!Number.isFinite(ageMs) || ageMs < 4000) {
        this.applyPostSubmitState();
        return;
      }
      this.log.warn("token choice still unresolved after submit; allow retry", {
        id: this.note.id,
        ageMs,
      });
      this.submittedId = undefined;
      this.submittedAt = undefined;
      this.shownId = undefined;
    }

    this.applyActionBar();
    this.showDialog();
  }

  applyActionBar() {
    if (!this.note) return false;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = !!selfId && this.note.playerId === selfId;
    this.log.debug("applyActionBar", { id: this.note.id, isOwner });
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
    return !!this.note;
  }

  private applyPostSubmitState() {
    this.deps.tokenChoiceDialog?.hide();
    this.deps.onTimerResume?.();
    this.deps.actionControls?.setWaitingForOpponent?.(false);
    this.deps.actionControls?.setState?.({ descriptors: [] });
  }

  private showDialog() {
    const dialog = this.deps.tokenChoiceDialog;
    if (!dialog || !this.note) return;
    if (this.shownId === this.note.id && dialog.isOpen()) return;

    const selfId = this.deps.gameContext.playerId;
    const isOwner = !!selfId && this.note.playerId === selfId;
    if (!isOwner) {
      dialog.show({
        headerText: "Choose token to play",
        choices: [],
        showChoices: false,
        showOverlay: true,
        showTimer: false,
      });
      this.shownId = this.note.id;
      return;
    }

    const choices = Array.isArray(this.note.data?.availableChoices) ? this.note.data.availableChoices : [];
    const dialogChoices = choices.map((choice: any) => ({
      index: Number(choice?.index ?? 0),
      cardId: (choice?.tokenData?.id ?? choice?.token?.cardId ?? "").toString() || undefined,
      enabled: choice?.enabled !== false,
    }));

    dialog.show({
      headerText: "Choose token to play",
      choices: dialogChoices,
      showChoices: true,
      showOverlay: true,
      showTimer: true,
      onSelect: async (index) => {
        await this.submitChoice(index);
      },
      onTimeout: async () => {
        const index = this.resolveTimeoutIndex(choices);
        await this.submitChoice(index);
      },
    });
    this.shownId = this.note.id;
  }

  private resolveTimeoutIndex(choices: any[]): number {
    const normalized = Array.isArray(choices) ? choices : [];
    const firstEnabled = normalized.find((c) => c?.enabled !== false);
    if (firstEnabled && typeof firstEnabled.index === "number") return firstEnabled.index;
    const first = normalized[0];
    return typeof first?.index === "number" ? first.index : 0;
  }

  private async submitChoice(selectedChoiceIndex: number) {
    if (!this.note || this.requestPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    this.requestPending = true;
    this.submittedId = this.note.id;
    this.submittedAt = Date.now();
    this.deps.tokenChoiceDialog?.hide();
    this.shownId = this.note.id;
    this.deps.refreshActions();
    try {
      await this.deps.api.confirmTokenChoice({
        gameId,
        playerId,
        eventId: this.note.id,
        selectedChoiceIndex,
      });
      await this.deps.engine.updateGameStatus(gameId, playerId);
      // If the backend immediately marked the notification complete, acknowledge right away.
      const latest = findLatestTokenChoiceFromRaw(this.deps.engine.getSnapshot().raw, { preferId: this.note?.id });
      if (latest?.id === this.note.id && latest.isCompleted) {
        await this.onCompleted(latest);
      }
    } catch (err) {
      void err;
      this.submittedId = undefined;
      this.submittedAt = undefined;
      this.shownId = undefined;
    } finally {
      this.requestPending = false;
      this.resolvePending();
      this.deps.refreshActions();
    }
  }

  private async onCompleted(note: TokenChoiceNote) {
    if (this.ackPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) {
      this.resolvePending();
      this.clear();
      return;
    }
    this.ackPending = true;
    this.deps.tokenChoiceDialog?.hide();
    this.deps.refreshActions();
    try {
      await this.deps.engine.updateGameStatus(gameId, playerId);
      await this.deps.api.acknowledgeEvents({ gameId, playerId, eventIds: [note.id] });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (err) {
      void err;
    } finally {
      this.ackPending = false;
      this.resolvePending();
      this.clear();
      this.deps.onTimerResume?.();
      this.deps.refreshActions();
    }
  }

  private resolvePending() {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.pendingPromise = undefined;
    resolve();
  }

  private clear() {
    this.note = undefined;
    this.requestPending = false;
    this.shownId = undefined;
    this.submittedId = undefined;
    this.submittedAt = undefined;
    this.ackPending = false;
  }
}
