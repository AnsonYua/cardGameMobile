import type { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { EffectTargetController } from "./EffectTargetController";
import type { ActionControls } from "./ControllerTypes";
import { mapAvailableTargetsToSlotTargets, type SlotTarget } from "./TargetSlotMapper";
import type { SlotPresenter } from "../ui/SlotPresenter";
import { SlotInteractionGate } from "./SlotInteractionGate";

type BlockerDeps = {
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  slotPresenter: SlotPresenter;
  actionControls?: ActionControls | null;
  effectTargetController?: EffectTargetController | null;
  refreshActions: () => void;
  slotGate: SlotInteractionGate;
};

export class BlockerFlowManager {
  private queueEntry?: any;
  private requestPending = false;
  private slotTargets: SlotTarget[] = [];
  private notificationId?: string;

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
    this.slotTargets = mapAvailableTargetsToSlotTargets(
      this.deps.slotPresenter,
      raw,
      entry?.data?.availableTargets || [],
      this.deps.gameContext.playerId,
    );
    this.notificationId = this.extractNotificationId(raw);
    this.requestPending = false;
    return entry;
  }

  applyActionBar() {
    if (!this.queueEntry) return false;
    const selfId = this.deps.gameContext.playerId;
    const isDefender = this.queueEntry.playerId === selfId;
    this.deps.slotGate.disable("blocker-choice");
    if (!isDefender) {
      this.deps.actionControls?.setWaitingForOpponent?.(true);
      return true;
    }
    this.deps.actionControls?.setWaitingForOpponent?.(false);
    this.deps.actionControls?.setState?.({
      descriptors: [
        {
          label: "Choose Blocker",
          primary: true,
          enabled: !this.requestPending && this.slotTargets.length > 0,
          onClick: () => this.openBlockerChoiceDialog(),
        },
        {
          label: "Skip Blocker Phase",
          enabled: !this.requestPending,
          onClick: () => this.skipBlockerStep(),
        },
      ],
    });
    return true;
  }

  isActive() {
    return !!this.queueEntry;
  }

  isWaitingForOpponent() {
    return !!this.queueEntry && this.queueEntry.playerId !== this.deps.gameContext.playerId;
  }

  async skipBlockerStep() {
    if (!this.queueEntry) return;
    await this.postBlockChoice([]);
  }

  private async openBlockerChoiceDialog() {
    if (!this.deps.effectTargetController || !this.slotTargets.length) return;
    await this.deps.effectTargetController.showManualTargets({
      targets: this.slotTargets.map((entry) => entry.slot),
      header: "Choose a Blocker",
      showCloseButton: true,
      onSelect: async (slot) => {
        await this.submitBlockChoiceForSlot(slot);
      },
    });
  }

  private async submitBlockChoiceForSlot(slot: SlotViewModel) {
    if (!this.queueEntry) return;
    const target = this.findMatchingTarget(slot);
    if (!target) return;
    const payload = this.buildTargetPayload(slot, target);
    if (!payload) return;
    await this.postBlockChoice([payload]);
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
      notificationId: this.notificationId,
      selectedTargets: targets,
    });
      await this.deps.engine.updateGameStatus(gameId, playerId);
    } catch (error) {
      console.warn("confirmBlockerChoice failed", error);
    } finally {
      this.requestPending = false;
      this.clear();
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

  private findMatchingTarget(slot: SlotViewModel) {
    const zoneKey = `${slot.owner}-${slot.slotId}`;
    const cardUid = slot.unit?.cardUid || slot.pilot?.cardUid;
    return this.slotTargets.find((entry) => {
      const entryKey = `${entry.slot.owner}-${entry.slot.slotId}`;
      if (entryKey === zoneKey) return true;
      const candidateUid = (entry.data?.carduid || entry.data?.cardUid || entry.data?.uid || entry.data?.id || "").toString();
      if (cardUid && candidateUid && cardUid === candidateUid) return true;
      return false;
    })?.data;
  }

  private buildTargetPayload(slot: SlotViewModel, target: any) {
    const selfId = this.deps.gameContext.playerId;
    const zone = target?.zone || slot.slotId || "";
    const playerId = target?.playerId || (slot.owner === "player" ? selfId : this.queueEntry?.playerId || "");
    const cardUid = target?.carduid || target?.cardUid || slot.unit?.cardUid || slot.pilot?.cardUid || "";
    if (!playerId) return null;
    return {
      carduid: cardUid,
      zone,
      playerId,
    };
  }

  private clear() {
    this.queueEntry = undefined;
    this.slotTargets = [];
    this.notificationId = undefined;
    this.deps.slotGate.enable("blocker-choice");
  }

  private extractNotificationId(raw: any) {
    const notifications = raw?.gameEnv?.notificationQueue ?? [];
    if (!Array.isArray(notifications) || notifications.length === 0) return undefined;
    const last = notifications[notifications.length - 1];
    if (!last || typeof last?.id !== "string") return undefined;
    return last.id;
  }
}
