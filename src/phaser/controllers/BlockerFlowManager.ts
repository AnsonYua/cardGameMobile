import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { ActionControls, SlotControls } from "./ControllerTypes";
import { slotKey } from "./ControllerTypes";

type BlockerDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  actionControls?: ActionControls | null;
  slotControls?: SlotControls | null;
  refreshActions: () => void;
};

export class BlockerFlowManager {
  private queueEntry?: any;
  private selectedSlot?: SlotViewModel;
  private allowedSlots = new Set<string>();
  private requestPending = false;

  constructor(private deps: BlockerDeps) {}

  handleSnapshot(raw: any) {
    const entry = this.getActiveQueueEntry(raw);
    if (!entry || !this.isBlockerChoiceEntry(entry)) {
      this.clear();
      return null;
    }
    if (this.queueEntry?.id === entry.id) {
      return entry;
    }
    this.queueEntry = entry;
    this.selectedSlot = undefined;
    this.allowedSlots.clear();
    (entry?.data?.availableTargets || []).forEach((target: any) => {
      if (!target?.zone) return;
      this.allowedSlots.add(`${target.playerId === this.deps.gameContext.playerId ? "player" : "opponent"}-${target.zone}`);
    });
    this.requestPending = false;
    return entry;
  }

  applyActionBar() {
    if (!this.queueEntry) return false;
    const selfId = this.deps.gameContext.playerId;
    const isDefender = this.queueEntry.playerId === selfId;
    if (!isDefender) {
      this.deps.actionControls?.setWaitingForOpponent?.(true);
      return true;
    }
    if (this.selectedSlot) {
      this.deps.actionControls?.setWaitingForOpponent?.(false);
      this.deps.actionControls?.setState?.({
        descriptors: [
          {
            label: "Block",
            primary: true,
            enabled: !this.requestPending,
            onClick: () => this.submitBlockChoice(),
          },
          {
            label: "Cancel",
            enabled: !this.requestPending,
            onClick: () => this.resetSelection(),
          },
        ],
      });
      return true;
    }
    this.deps.actionControls?.setWaitingForOpponent?.(false, [
      {
        label: "Skip Blocker Step",
        primary: true,
        enabled: !this.requestPending,
        onClick: () => this.skipBlockerStep(),
      },
    ]);
    return true;
  }

  isActive() {
    return !!this.queueEntry;
  }

  isWaitingForOpponent() {
    return !!this.queueEntry && this.queueEntry.playerId !== this.deps.gameContext.playerId;
  }

  isAllowedSlot(slot: SlotViewModel) {
    return this.allowedSlots.has(slotKey(slot));
  }

  selectSlot(slot: SlotViewModel) {
    this.selectedSlot = slot;
    this.deps.refreshActions();
  }

  resetSelection() {
    this.selectedSlot = undefined;
    this.deps.refreshActions();
  }

  async submitBlockChoice() {
    if (!this.queueEntry || !this.selectedSlot) return;
    await this.postBlockChoice([
      {
        carduid: this.selectedSlot.unit?.cardUid || "",
        zone: this.selectedSlot.slotId || "",
        playerId: this.queueEntry.playerId || "",
      },
    ]);
  }

  async skipBlockerStep() {
    if (!this.queueEntry) return;
    await this.postBlockChoice([]);
  }

  private async postBlockChoice(targets: Array<{ carduid: string; zone: string; playerId: string }>) {
    if (!this.queueEntry) return;
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    this.requestPending = true;
    this.deps.refreshActions();
    try {
      await this.deps.api.confirmBlockerChoice({
        gameId,
        playerId,
        eventId: this.queueEntry.id,
        selectedTargets: targets,
      });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (error) {
      console.warn("confirmBlockerChoice failed", error);
    } finally {
      this.requestPending = false;
      this.selectedSlot = undefined;
      this.allowedSlots.clear();
      this.queueEntry = undefined;
      this.deps.refreshActions();
    }
  }

  private getActiveQueueEntry(raw: any) {
    const queue = raw?.gameEnv?.processingQueue ?? raw?.processingQueue;
    if (!Array.isArray(queue)) return undefined;
    return queue.find((entry) => (entry?.status || "").toString().toUpperCase() !== "RESOLVED");
  }

  private isBlockerChoiceEntry(entry?: any) {
    return !!entry && ((entry.type || "").toString().toUpperCase() === "BLOCKER_CHOICE");
  }

  private clear() {
    this.queueEntry = undefined;
    this.selectedSlot = undefined;
    this.allowedSlots.clear();
    this.requestPending = false;
  }
}
