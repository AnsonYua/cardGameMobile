import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { BurstChoiceGroupDialog } from "../ui/BurstChoiceGroupDialog";
import { getNotificationQueue, findActiveBurstChoiceGroupNotification } from "../utils/NotificationUtils";
import {
  buildGroupDialogRows,
  findGroupEvent,
  getBurstSourceInfo,
  getGroupEvents,
  isGroupEventDone,
  type BurstGroupEvent,
} from "../utils/burstChoiceGroupUtils";
import { resolveBurstChoiceCard } from "../utils/burstChoiceCardResolver";
import { createLogger } from "../utils/logger";

type GroupDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  groupDialog?: BurstChoiceGroupDialog | null;
  burstChoiceDialog?: BurstChoiceDialog | null;
  refreshActions: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
};

type GroupNote = {
  id: string;
  payload: any;
  metadata?: any;
};

export class BurstChoiceGroupFlowManager {
  private readonly log = createLogger("BurstChoiceGroupFlow");
  private groupNotificationId?: string;
  private active = false;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;
  private selectionResolve?: (eventId: string) => void;
  private selectionPromise?: Promise<string>;
  private view: "group" | "single" = "group";
  private requestPending = false;

  constructor(private deps: GroupDeps) {}

  isActive() {
    return this.active;
  }

  applyActionBar(): boolean {
    if (!this.active) return false;
    const actions = this.deps.actionControls;
    if (!actions) return true;
    const raw = this.deps.engine.getSnapshot().raw as any;
    const note = this.findGroupNote(raw);
    const ownerId = note?.payload?.playerId;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = !!ownerId && ownerId === selfId;
    if (!isOwner) {
      this.deps.onTimerPause?.();
      actions.setWaitingForOpponent?.(true);
      actions.setWaitingLabel?.("Waiting for opponent to resolve Burst...");
      actions.setState?.({ descriptors: [] });
      return true;
    }
    // Owner: group dialog controls input; clear action bar.
    actions.setWaitingForOpponent?.(false);
    actions.setState?.({ descriptors: [] });
    return true;
  }

  syncSnapshotState(raw: any) {
    const note = this.findGroupNote(raw);
    if (!note) {
      if (this.active) {
        this.log.debug("group cleared from snapshot");
        void this.hideAll();
        this.resolvePending();
        this.clear();
      }
      return;
    }

    const ownerId = note.payload?.playerId;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = !!ownerId && ownerId === selfId;

    // Keep flow active while a group notification exists (for either player).
    this.active = true;
    this.groupNotificationId = note.id;

    // If user backed out of single choice, ensure group list is visible again for the owner.
    if (isOwner && this.view === "group" && !this.deps.groupDialog?.isOpen()) {
      this.showGroupDialog(note);
    }

    // Completion handling: acknowledge only when backend says completed.
    if (isOwner && note.payload?.isCompleted === true) {
      this.log.debug("group completed from snapshot", { notificationId: note.id });
      void this.onGroupCompleted(note);
    }
  }

  async handleNotification(notification: any, raw: any): Promise<void> {
    const note = this.normalizeGroupNote(notification);
    if (!note) return;
    this.active = true;
    this.groupNotificationId = note.id;
    this.view = "group";
    this.clearSelectionWait();
    this.requestPending = false;

    const selfId = this.deps.gameContext.playerId;
    const ownerId = note.payload?.playerId;
    const isOwner = !!ownerId && ownerId === selfId;

    this.log.warn("group notification start", { notificationId: note.id, isOwner, eventCount: (note.payload?.events ?? []).length });

    if (!isOwner) {
      // Non-owner: don't block animation queue; just apply action bar waiting state via normal refresh loop.
      return;
    }

    this.pendingPromise =
      this.pendingPromise ??
      new Promise<void>((resolve) => {
        this.pendingResolve = resolve;
      });

    await this.runOwnerLoop(note, raw);
    await this.pendingPromise;
  }

  private async runOwnerLoop(initialNote: GroupNote, raw: any) {
    let note: GroupNote | undefined = initialNote;
    while (note) {
      const payload = note.payload ?? {};
      const events: BurstGroupEvent[] = getGroupEvents(payload);
      if (payload.isCompleted === true || events.length === 0) {
        await this.onGroupCompleted(note);
        return;
      }

      // Show group selection dialog and wait for a selection.
      this.view = "group";
      this.clearSelectionWait();
      await this.deps.burstChoiceDialog?.hide();
      this.showGroupDialog(note);
      const selectedId = await this.waitForSelectionId();
      if (!selectedId) {
        // Should not happen (no close), but keep looping if it does.
        note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any) ?? undefined;
        continue;
      }

      const event = findGroupEvent(events, selectedId);
      if (!event || isGroupEventDone(payload, event)) {
        note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any) ?? undefined;
        continue;
      }

      // Enter single-burst UI for selected event; allow back navigation.
      this.view = "single";
      await this.deps.groupDialog?.hide();
      await this.showSingleBurstChoice(event, raw);

      // Wait for next poll via updateGameStatus inside submitChoice. Then reload note from snapshot.
      note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any) ?? undefined;
      raw = this.deps.engine.getSnapshot().raw as any;
    }
  }

  private showGroupDialog(note: GroupNote) {
    const dialog = this.deps.groupDialog;
    if (!dialog) return;
    const payload = note.payload ?? {};
    const events: BurstGroupEvent[] = getGroupEvents(payload);
    const rows = buildGroupDialogRows(payload, events, (eventId) => {
      this.selectionResolve?.(eventId);
    });

    dialog.show({
      headerText: "Resolve Burst Effects",
      promptText: "Select a burst to resolve.",
      rows,
    });
  }

  private async waitForSelectionId(): Promise<string | undefined> {
    if (!this.selectionPromise) {
      this.selectionPromise = new Promise<string>((resolve) => {
        this.selectionResolve = resolve;
      });
    }
    try {
      return await this.selectionPromise;
    } finally {
      this.clearSelectionWait();
    }
  }

  private clearSelectionWait() {
    this.selectionResolve = undefined;
    this.selectionPromise = undefined;
  }

  private async showSingleBurstChoice(event: BurstGroupEvent, raw: any) {
    const dialog = this.deps.burstChoiceDialog;
    if (!dialog) return;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = event?.playerId === selfId || event?.data?.playerId === selfId;
    if (!isOwner) {
      return;
    }
    const info = getBurstSourceInfo(event);
    const card = resolveBurstChoiceCard(raw, { carduid: info.carduid, availableTargets: event?.data?.availableTargets });
    if (!card) {
      this.log.warn("single burst skipped: card not resolved", { eventId: event?.id });
      return;
    }
    const eventId = String(event.id);

    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      const openList = async () => {
        this.view = "group";
        await dialog.hide();
        const note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any);
        if (note) this.showGroupDialog(note);
        finish();
      };
      const submit = async (confirmed: boolean) => {
        await this.submitChoice(eventId, confirmed);
        finish();
      };

      dialog.show({
        card,
        header: "Burst Card",
        showButtons: true,
        showBack: true,
        showTimer: true,
        showOverlay: false,
        onBack: openList,
        onTrigger: async () => {
          await submit(true);
        },
        onCancel: async () => {
          await submit(false);
        },
        onTimeout: async () => {
          await submit(true);
        },
      });
    });
  }

  private async submitChoice(eventId: string, confirmed: boolean) {
    if (this.requestPending) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    this.requestPending = true;
    this.deps.refreshActions();
    try {
      await this.deps.api.confirmBurstChoice({ gameId, playerId, eventId, confirmed });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (err) {
      void err;
    } finally {
      this.requestPending = false;
      await this.deps.burstChoiceDialog?.hide();
      // After the poll, if group still exists and isn't completed, the loop will show the list again.
      this.deps.refreshActions();
    }
  }

  private async onGroupCompleted(note: GroupNote) {
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) {
      this.resolvePending();
      this.clear();
      return;
    }
    await this.hideAll();
    try {
      await this.deps.api.acknowledgeEvents({ gameId, playerId, eventIds: [note.id] });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (err) {
      void err;
    } finally {
      this.resolvePending();
      this.clear();
      this.deps.onTimerResume?.();
      this.deps.refreshActions();
    }
  }

  private async hideAll() {
    await this.deps.groupDialog?.hide();
    await this.deps.burstChoiceDialog?.hide();
  }

  private resolvePending() {
    if (!this.pendingResolve) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = undefined;
    this.pendingPromise = undefined;
    resolve();
  }

  private clear() {
    this.active = false;
    this.groupNotificationId = undefined;
    this.view = "group";
    this.clearSelectionWait();
    this.requestPending = false;
    this.pendingPromise = undefined;
    this.pendingResolve = undefined;
  }

  private getQueue(raw: any) {
    return getNotificationQueue(raw);
  }

  private normalizeGroupNote(notification: any): GroupNote | undefined {
    if (!notification) return undefined;
    const type = (notification?.type ?? "").toString().toUpperCase();
    if (type !== "BURST_EFFECT_CHOICE_GROUP") return undefined;
    return {
      id: String(notification?.id ?? ""),
      payload: notification?.payload ?? {},
      metadata: notification?.metadata,
    };
  }

  private findGroupNote(raw: any): GroupNote | undefined {
    const queue = this.getQueue(raw);
    const note = findActiveBurstChoiceGroupNotification(queue, { includeCompleted: true });
    if (!note) return undefined;
    const normalized = this.normalizeGroupNote(note);
    if (!normalized) return undefined;
    if (this.groupNotificationId && normalized.id !== this.groupNotificationId) {
      // If we already locked onto a group, prefer it until it completes to prevent flicker.
      const preferred = queue.find((n: any) => String(n?.id ?? "") === String(this.groupNotificationId));
      const preferredNorm = preferred ? this.normalizeGroupNote(preferred) : undefined;
      return preferredNorm ?? normalized;
    }
    return normalized;
  }
}
