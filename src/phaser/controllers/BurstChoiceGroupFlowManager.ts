import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionControls } from "./ControllerTypes";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { BurstChoiceGroupDialog } from "../ui/BurstChoiceGroupDialog";
import { getNotificationQueue, findActiveBurstChoiceGroupNotification } from "../utils/NotificationUtils";
import { findCardByUid } from "../utils/CardLookup";
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

type GroupEvent = {
  id: string;
  type?: string;
  status?: string;
  playerId?: string;
  data?: any;
};

export class BurstChoiceGroupFlowManager {
  private readonly log = createLogger("BurstChoiceGroupFlow");
  private groupNotificationId?: string;
  private active = false;
  private pendingResolve?: () => void;
  private pendingPromise?: Promise<void>;
  private selectedEventId?: string;
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
    if (isOwner && !this.selectedEventId && !this.deps.groupDialog?.isOpen()) {
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
    this.selectedEventId = undefined;
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
      const events: GroupEvent[] = Array.isArray(payload.events) ? payload.events : [];
      if (payload.isCompleted === true || events.length === 0) {
        await this.onGroupCompleted(note);
        return;
      }

      // Show group selection dialog and wait for a selection.
      this.selectedEventId = undefined;
      await this.deps.burstChoiceDialog?.hide();
      this.showGroupDialog(note);
      const selectedId = await this.waitForSelection();
      if (!selectedId) {
        // Should not happen (no close), but keep looping if it does.
        note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any) ?? undefined;
        continue;
      }

      const event = events.find((e) => String(e?.id ?? "") === String(selectedId));
      if (!event || this.isDoneRow(payload, event)) {
        note = this.findGroupNote(this.deps.engine.getSnapshot().raw as any) ?? undefined;
        continue;
      }

      // Enter single-burst UI for selected event; allow back navigation.
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
    const events: GroupEvent[] = Array.isArray(payload.events) ? payload.events : [];
    const rows = events.map((e) => {
      const burstSource = e?.data?.burstSource ?? {};
      const name = burstSource?.name ?? e?.data?.displayName ?? "Burst";
      const cardId = burstSource?.cardId ?? burstSource?.id ?? "";
      const cardType = burstSource?.cardType ? String(burstSource.cardType) : "";
      const zone = burstSource?.sourceZone ? String(burstSource.sourceZone) : "";
      const attack = burstSource?.attackContext ?? {};
      const attackSuffix =
        attack?.attackingPlayerId && attack?.attackerSlot
          ? ""
          : "";
      const metaSuffix = [cardId, cardType, zone].filter(Boolean).join(" · ");
      const label = `${name}${metaSuffix ? ` — ${metaSuffix}` : ""}${attackSuffix}`;
      const done = this.isDoneRow(payload, e);
      const enabled = !done;
      return {
        id: String(e?.id ?? ""),
        label,
        done,
        enabled,
        onClick: async () => {
          this.selectedEventId = String(e?.id ?? "");
        },
      };
    });

    dialog.show({
      headerText: "Resolve Burst Effects",
      promptText: "Select a burst to resolve.",
      rows,
    });
  }

  private isDoneRow(groupPayload: any, event: GroupEvent): boolean {
    const resolvedIds: string[] = Array.isArray(groupPayload?.resolvedEventIds) ? groupPayload.resolvedEventIds : [];
    const id = String(event?.id ?? "");
    if (resolvedIds.includes(id)) return true;
    if ((event?.status ?? "").toString().toUpperCase() === "RESOLVED") return true;
    if (event?.data?.userDecisionMade === true) return true;
    return false;
  }

  private async waitForSelection(): Promise<string | undefined> {
    // No close button; selection is made by setting `selectedEventId` via row click.
    const maxWaitMs = 1000 * 60 * 60;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (this.selectedEventId) return this.selectedEventId;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    return undefined;
  }

  private async showSingleBurstChoice(event: GroupEvent, raw: any) {
    const dialog = this.deps.burstChoiceDialog;
    if (!dialog) return;
    const selfId = this.deps.gameContext.playerId;
    const isOwner = event?.playerId === selfId || event?.data?.playerId === selfId;
    if (!isOwner) {
      return;
    }
    const card = this.resolveCardFromGroupEvent(raw, event);
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
        this.selectedEventId = undefined;
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

  private resolveCardFromGroupEvent(raw: any, event: GroupEvent) {
    const data = event?.data ?? {};
    const carduid = data?.carduid ?? data?.burstSource?.carduid;
    const targets = Array.isArray(data?.availableTargets) ? data.availableTargets : [];
    if (carduid) {
      const match = targets.find((t: any) => t?.carduid === carduid);
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
    this.selectedEventId = undefined;
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
