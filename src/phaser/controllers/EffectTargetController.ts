import { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import Phaser from "phaser";
import { mapAvailableTargetsToSlotTargets } from "./TargetSlotMapper";

type ShowManualOpts = {
  targets: SlotViewModel[];
  header?: string;
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  showCloseButton?: boolean;
};

export class EffectTargetController {
  private activeEffectChoiceId?: string;
  private manualOpen = false;

  constructor(
    private deps: {
      dialog: EffectTargetDialog;
      slotPresenter: SlotPresenter;
      gameContext: GameContext;
      engine: GameEngine;
      api: ApiManager;
      scene: Phaser.Scene;
      getSlotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
    },
  ) {}

  async syncFromSnapshot(raw: any) {
    if (this.manualOpen) {
      return;
    }
    const selfId = this.deps.gameContext.playerId;
    const processing: any[] = raw?.gameEnv?.processingQueue || [];
    const pending = processing.find((p) => p?.data?.userDecisionMade === false && (!p.playerId || p.playerId === selfId));
    if (pending?.type?.toString().toUpperCase() === "BLOCKER_CHOICE") {
      return;
    }
    if (!pending) {
      this.activeEffectChoiceId = undefined;
      await this.deps.dialog.hide();
      return;
    }
    if (this.activeEffectChoiceId === pending.id && this.deps.dialog.isOpen()) {
      return;
    }

    const slotTargets = mapAvailableTargetsToSlotTargets(
      this.deps.slotPresenter,
      raw,
      pending.data?.availableTargets || [],
      selfId,
    );
    const targets = slotTargets.map((entry) => entry.slot);
    if (!targets.length) return;

    const players = raw?.gameEnv?.players || {};
    const allIds = Object.keys(players);
    const otherId = allIds.find((id) => id !== selfId);
    const availableTargets: any[] = pending.data?.availableTargets || [];

    this.activeEffectChoiceId = pending.id;
    this.deps.dialog.show({
      targets,
      header: "Choose a Target",
      onSelect: async (slot) => {
        const targetUid = slot?.unit?.cardUid || slot?.pilot?.cardUid;
        const zone = slot?.slotId || "";
        const ownerPlayerId = slot?.owner === "player" ? selfId : otherId || "";
        const matched = availableTargets.find(
          (t) =>
            (t.carduid && t.carduid === targetUid) ||
            (t.cardUid && t.cardUid === targetUid) ||
            (t.zone && t.zone === zone && t.playerId === ownerPlayerId),
        );
        const carduid = matched?.carduid || matched?.cardUid || targetUid;
        const payload = {
          gameId: this.deps.gameContext.gameId || "",
          playerId: selfId || "",
          eventId: pending.id,
          selectedTargets: [
            {
              carduid: carduid || "",
              zone: matched?.zone || zone,
              playerId: matched?.playerId || ownerPlayerId || "",
            },
          ],
        };

        try {
          await this.deps.api.confirmTargetChoice(payload);
          await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
        } catch (err) {
          console.warn("confirmTargetChoice failed", err);
        } finally {
          this.activeEffectChoiceId = undefined;
          await this.deps.dialog.hide();
        }
      },
    });
  }

  async showManualTargets(opts: ShowManualOpts) {
    this.manualOpen = true;
    this.activeEffectChoiceId = undefined;
    this.deps.dialog.show({
      targets: opts.targets,
      header: opts.header ?? "Choose a Target",
      showCloseButton: opts.showCloseButton ?? false,
      onSelect: async (slot) => {
        try {
          await opts.onSelect(slot);
        } finally {
          this.manualOpen = false;
        }
      },
      onClose: () => {
        this.manualOpen = false;
      },
    });
  }

}
