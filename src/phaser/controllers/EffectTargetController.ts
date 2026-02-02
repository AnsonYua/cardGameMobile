import { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import Phaser from "phaser";
import { mapAvailableTargetsToSlotTargets } from "./TargetSlotMapper";
import type { SlotNotification } from "../animations/NotificationAnimationController";

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
      onPlayerAction?: () => void;
    },
  ) {}

  async handleTargetChoiceNotification(note: SlotNotification, raw: any): Promise<void> {
    if (this.manualOpen) return;
    if (!raw) return;

    const selfId = this.deps.gameContext.playerId;
    const payload = note?.payload ?? {};
    const allowEmptySelection = payload?.allowEmptySelection === true;
    const event = payload?.event ?? payload;
    const eventType = (event?.type ?? note?.type ?? "").toString().toUpperCase();
    if (eventType !== "TARGET_CHOICE") return;

    const eventId = (event?.id ?? note?.id ?? "").toString();
    if (!eventId) return;

    const playerId = event?.playerId ?? payload?.playerId;
    if (playerId && selfId && playerId !== selfId) {
      // Not our decision.
      if (this.activeEffectChoiceId === eventId) {
        this.activeEffectChoiceId = undefined;
        await this.deps.dialog.hide();
      }
      return;
    }

    const data = event?.data ?? {};
    const userDecisionMade = data?.userDecisionMade;
    const status = (event?.status ?? "").toString().toUpperCase();
    if (userDecisionMade !== false || (status && status !== "DECLARED")) {
      if (this.activeEffectChoiceId) {
        this.activeEffectChoiceId = undefined;
        await this.deps.dialog.hide();
      }
      return;
    }

    if (this.activeEffectChoiceId === eventId && this.deps.dialog.isOpen()) {
      // Already showing this choice; don't block the queue again.
      return;
    }

    const availableTargets: any[] = Array.isArray(data?.availableTargets) ? data.availableTargets : [];
    const players = raw?.gameEnv?.players || {};
    const allIds = Object.keys(players);
    const otherId = allIds.find((id) => id !== selfId) || "";
    const slotTargets = mapAvailableTargetsToSlotTargets(
      this.deps.slotPresenter,
      raw,
      availableTargets,
      selfId ?? "",
    );
    const targets = slotTargets.map((entry) => entry.slot);
    if (!targets.length) {
      if (allowEmptySelection && selfId) {
        try {
          await this.deps.api.confirmTargetChoice({
            gameId: this.deps.gameContext.gameId || "",
            playerId: selfId || "",
            eventId,
            selectedTargets: [],
          });
          this.deps.onPlayerAction?.();
          await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
        } catch (err) {
          void err;
        }
      }
      return;
    }

    this.activeEffectChoiceId = eventId;
    await new Promise<void>((resolve) => {
      const finish = async () => {
        this.activeEffectChoiceId = undefined;
        await this.deps.dialog.hide();
        resolve();
      };
      this.deps.dialog.show({
        targets,
        header: "Choose a Target",
        showCloseButton: allowEmptySelection,
        onClose: () => {
          if (!allowEmptySelection || !selfId) {
            void finish();
            return;
          }
          void (async () => {
            try {
              await this.deps.api.confirmTargetChoice({
                gameId: this.deps.gameContext.gameId || "",
                playerId: selfId || "",
                eventId,
                selectedTargets: [],
              });
              this.deps.onPlayerAction?.();
              await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
            } catch (err) {
              void err;
            } finally {
              await finish();
            }
          })();
        },
        onSelect: async (slot) => {
          if (!selfId) {
            await finish();
            return;
          }
          const targetUid = slot?.unit?.cardUid || slot?.pilot?.cardUid;
          const zone = slot?.slotId || "";
          const ownerPlayerId = slot?.owner === "player" ? selfId : otherId;
          const matched = availableTargets.find(
            (t) =>
              ((t?.carduid || t?.cardUid) && targetUid && (t?.carduid || t?.cardUid) === targetUid) ||
              (t?.zone && t?.playerId && t.zone === zone && t.playerId === ownerPlayerId),
          );
          try {
            await this.deps.api.confirmTargetChoice({
              gameId: this.deps.gameContext.gameId || "",
              playerId: selfId || "",
              eventId,
              selectedTargets: [
                {
                  carduid: matched?.carduid || matched?.cardUid || targetUid || "",
                  zone: matched?.zone || zone,
                  playerId: matched?.playerId || ownerPlayerId || "",
                },
              ],
            });
            this.deps.onPlayerAction?.();
            await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
          } catch (err) {
            void err;
          } finally {
            await finish();
          }
        },
      });
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
          this.deps.onPlayerAction?.();
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
