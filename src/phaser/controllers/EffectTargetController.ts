import { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel, SlotCardView } from "../ui/SlotTypes";
import { toPreviewKey } from "../ui/HandTypes";
import type { HandCardView } from "../ui/HandTypes";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import Phaser from "phaser";

type ShowManualOpts = {
  targets: SlotViewModel[];
  header?: string;
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
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
      enqueueSlotAnimation: (
        owner: "player" | "opponent",
        slotId: string,
        card?: SlotCardView,
        startOverride?: { x: number; y: number; isOpponent?: boolean },
        endOverride?: { x: number; y: number; isOpponent?: boolean },
      ) => void;
      getSlotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
    },
  ) {}

  private pendingSourceCard?: HandCardView;

  setPendingSourceCard(card?: HandCardView) {
    this.pendingSourceCard = card;
  }

  async syncFromSnapshot(raw: any) {
    if (this.manualOpen) {
      return;
    }
    const selfId = this.deps.gameContext.playerId;
    const processing: any[] = raw?.gameEnv?.processingQueue || [];
    const pending = processing.find((p) => p?.data?.userDecisionMade === false && (!p.playerId || p.playerId === selfId));
    if (!pending) {
      this.activeEffectChoiceId = undefined;
      this.pendingSourceCard = undefined;
      await this.deps.dialog.hide();
      return;
    }
    if (this.activeEffectChoiceId === pending.id && this.deps.dialog.isOpen()) {
      return;
    }

    const targets = this.mapAvailableTargetsToSlots(raw, pending.data?.availableTargets || []);
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
          this.enqueueAnimationForSelection(slot);
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
      onSelect: async (slot) => {
        try {
          await opts.onSelect(slot);
          this.enqueueAnimationForSelection(slot);
        } finally {
          this.manualOpen = false;
        }
      },
    });
  }

  private enqueueAnimationForSelection(slot?: SlotViewModel) {
    if (!slot || !this.pendingSourceCard) {
      this.pendingSourceCard = undefined;
      return;
    }
    const card: SlotCardView = {
      id: this.pendingSourceCard.cardId,
      textureKey: toPreviewKey(this.pendingSourceCard.cardId),
      cardType: this.pendingSourceCard.cardType,
      cardUid: this.pendingSourceCard.uid,
      cardData: { cardType: this.pendingSourceCard.cardType, name: (this.pendingSourceCard as any)?.cardData?.name },
    };
    this.deps.enqueueSlotAnimation(
      slot.owner,
      slot.slotId,
      card,
      this.computeCommandStartOverride(slot.owner),
      this.computePlayerSlotCenter(),
    );
    this.pendingSourceCard = undefined;
  }

  private computeCommandStartOverride(targetOwner: "player" | "opponent") {
    // Launch commands from the player's hand side, toward the player's slot area.
    const cam = this.deps.scene.cameras.main;
    return { x: cam.centerX, y: cam.height - 60, isOpponent: false };
  }

  private computePlayerSlotCenter() {
    const center = this.deps.getSlotAreaCenter?.("player");
    if (center) return { ...center, isOpponent: false };
    const cam = this.deps.scene.cameras.main;
    return { x: cam.centerX, y: cam.centerY, isOpponent: false };
  }

  private mapAvailableTargetsToSlots(raw: any, availableTargets: any[]): SlotViewModel[] {
    if (!raw) return [];
    const selfId = this.deps.gameContext.playerId;
    const allSlots = this.deps.slotPresenter.toSlots(raw, selfId);
    const mapped: SlotViewModel[] = [];

    availableTargets.forEach((t: any) => {
      const owner: "player" | "opponent" = t.playerId === selfId ? "player" : "opponent";
      const existing = allSlots.find((s) => s.slotId === t.zone && s.owner === owner);
      if (existing) {
        mapped.push(existing);
        return;
      }

      const cardType = (t.cardData?.cardType || "").toLowerCase();
      const cardView: SlotCardView = {
        id: t.cardData?.id,
        cardType: t.cardData?.cardType,
        textureKey: toPreviewKey(t.cardData?.id),
        cardUid: t.carduid ?? t.cardUid,
        cardData: t.cardData,
      };
      const slot: SlotViewModel = {
        owner,
        slotId: t.zone || "unknown",
        fieldCardValue: { totalAP: t.cardData?.ap ?? 0, totalHP: t.cardData?.hp ?? 0 },
      };
      if (cardType === "pilot" || cardType === "command") {
        slot.pilot = cardView;
      } else {
        slot.unit = cardView;
      }
      mapped.push(slot);
    });

    return mapped;
  }
}
