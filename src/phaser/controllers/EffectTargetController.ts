import { ApiManager } from "../api/ApiManager";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import Phaser from "phaser";
import { mapAvailableTargetsToSlotTargets } from "./TargetSlotMapper";
import type { SlotNotification } from "../animations/NotificationAnimationController";
import { isDebugFlagEnabled } from "../utils/debugFlags";
import { mapSlotToApiTargetRef } from "./targeting/TargetChoiceMapping";
import { resolveTargetChoiceHeader } from "./targeting/TargetChoiceTitles";

type ShowManualOpts = {
  targets: SlotViewModel[];
  header?: string;
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  showCloseButton?: boolean;
};

export class EffectTargetController {
  private activeEffectChoiceId?: string;
  private manualOpen = false;
  private debug = isDebugFlagEnabled("debugTargets");

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
    const notificationId = (note?.id ?? "").toString();
    const payload = note?.payload ?? {};
    const allowEmptySelection = payload?.allowEmptySelection === true;
    const targetCount = payload?.targetCount ?? payload?.targetcount ?? undefined;
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
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[EffectTargetController] TARGET_CHOICE", {
        eventId,
        allowEmptySelection,
        targetCount,
        availableTargets: availableTargets.map((t) => ({
          carduid: t?.carduid ?? t?.cardUid,
          playerId: t?.playerId,
          zone: t?.zone,
          location: t?.location,
          zoneType: t?.zoneType,
          cardId: t?.cardData?.id,
          cardType: t?.cardData?.cardType,
        })),
        mappedTargets: slotTargets.map((t) => ({
          owner: t.slot.owner,
          slotId: t.slot.slotId,
          hasUnit: !!t.slot.unit,
          hasPilot: !!t.slot.pilot,
          cardUid: t.slot.unit?.cardUid ?? t.slot.pilot?.cardUid,
        })),
      });
    }
    if (!targets.length) {
      if (allowEmptySelection && selfId) {
        try {
          await this.deps.api.cancelChoice({
            gameId: this.deps.gameContext.gameId || "",
            playerId: selfId || "",
            eventId,
          });
          if (notificationId) {
            await this.deps.api.acknowledgeEvents({
              gameId: this.deps.gameContext.gameId || "",
              playerId: selfId || "",
              eventIds: [notificationId],
            });
          }
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
      const parsedMin = Number(targetCount?.min ?? targetCount?.MIN ?? targetCount?.minimum ?? 1);
      const parsedMax = Number(targetCount?.max ?? targetCount?.MAX ?? targetCount?.maximum ?? parsedMin ?? 1);
      const min = Number.isFinite(parsedMin) ? parsedMin : 1;
      const max = Number.isFinite(parsedMax) ? parsedMax : min;
      const isMulti = max > 1 || min > 1;
      const header = resolveTargetChoiceHeader({
        choiceKind: payload?.choiceKind ?? data?.choiceKind ?? event?.choiceKind,
        isMulti,
      });

      const confirmEmptyIfAllowed = () => {
        if (!allowEmptySelection || !selfId) {
          void finish();
          return;
        }
        void (async () => {
          try {
            await this.deps.api.cancelChoice({
              gameId: this.deps.gameContext.gameId || "",
              playerId: selfId || "",
              eventId,
            });
            if (notificationId) {
              await this.deps.api.acknowledgeEvents({
                gameId: this.deps.gameContext.gameId || "",
                playerId: selfId || "",
                eventIds: [notificationId],
              });
            }
            this.deps.onPlayerAction?.();
            await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
          } catch (err) {
            void err;
          } finally {
            await finish();
          }
        })();
      };

      const mapSlotToTarget = (slot: SlotViewModel) => {
        return mapSlotToApiTargetRef({
          slot,
          availableTargets,
          selfPlayerId: selfId ?? "",
          otherPlayerId: otherId,
        });
      };

      if (isMulti) {
        try {
          this.deps.dialog.showMulti({
            targets,
            header,
            // Optional effects can be declined by closing; the minimum selection still applies
            // when the player confirms.
            showCloseButton: allowEmptySelection,
            closeOnBackdrop: allowEmptySelection,
            allowPiloted: true,
            min,
            max: max,
            onClose: confirmEmptyIfAllowed,
            onConfirm: async (slots) => {
              if (!selfId) {
                await finish();
                return;
              }
              const selectedTargets = slots
                .map((slot) => mapSlotToTarget(slot))
                .filter((t) => t.carduid && t.zone && t.playerId);
              const deduped = Array.from(
                new Map(selectedTargets.map((t) => [`${t.carduid}:${t.zone}:${t.playerId}`, t] as const)).values(),
              );
              try {
                await this.deps.api.confirmTargetChoice({
                  gameId: this.deps.gameContext.gameId || "",
                  playerId: selfId || "",
                  eventId,
                  selectedTargets: deduped,
                });
                if (notificationId) {
                  await this.deps.api.acknowledgeEvents({
                    gameId: this.deps.gameContext.gameId || "",
                    playerId: selfId || "",
                    eventIds: [notificationId],
                  });
                }
                this.deps.onPlayerAction?.();
                await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
              } catch (err) {
                void err;
              } finally {
                await finish();
              }
            },
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[EffectTargetController] showMulti failed", err);
          void finish();
        }
        return;
      }

      try {
        this.deps.dialog.show({
          targets,
          header,
          showCloseButton: allowEmptySelection,
          allowPiloted: true,
          onClose: confirmEmptyIfAllowed,
          onSelect: async (slot) => {
            if (!selfId) {
              await finish();
              return;
            }
            try {
              await this.deps.api.confirmTargetChoice({
                gameId: this.deps.gameContext.gameId || "",
                playerId: selfId || "",
                eventId,
                selectedTargets: [mapSlotToTarget(slot)],
              });
              if (notificationId) {
                await this.deps.api.acknowledgeEvents({
                  gameId: this.deps.gameContext.gameId || "",
                  playerId: selfId || "",
                  eventIds: [notificationId],
                });
              }
              this.deps.onPlayerAction?.();
              await this.deps.engine.updateGameStatus(this.deps.gameContext.gameId ?? undefined, selfId ?? undefined);
            } catch (err) {
              void err;
            } finally {
              await finish();
            }
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[EffectTargetController] show failed", err);
        void finish();
      }
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
