import { parseSessionParams } from "../game/SessionParams";
import { resolvePlayerIds } from "../scene/boardStatusHelpers";
import type { SlotOwner } from "../ui/SlotTypes";
import type { CardUiSnapshot, DialogSnapshot } from "./AutomationTypes";
import type { BridgeDeps } from "./bridgeDeps";

function toSelectedSlot(selectedKey?: string): { owner: SlotOwner; slotId: string } | null {
  if (!selectedKey) return null;
  const parts = selectedKey.split("-");
  if (parts.length < 2) return null;
  const owner = parts[0];
  const slotId = parts.slice(1).join("-");
  if ((owner !== "player" && owner !== "opponent") || !slotId) return null;
  return { owner, slotId } as { owner: SlotOwner; slotId: string };
}

function toEngineActions(deps: BridgeDeps): Array<{ label: string; enabled: boolean; primary?: boolean }> {
  const descriptors = deps.engine.getAvailableActions("neutral");
  return descriptors.map((item) => ({
    label: item.label,
    enabled: item.enabled !== false,
    primary: item.primary,
  }));
}

function getDialogs(deps: BridgeDeps): DialogSnapshot[] {
  const dialogs: DialogSnapshot[] = [];

  const prompt = deps.dialogs.promptChoiceDialog?.getAutomationState?.();
  if (prompt?.open) dialogs.push({ type: "PROMPT_CHOICE", ...prompt });

  const option = deps.dialogs.optionChoiceDialog?.getAutomationState?.();
  if (option?.open) dialogs.push({ type: "OPTION_CHOICE", ...option });

  const token = deps.dialogs.tokenChoiceDialog?.getAutomationState?.();
  if (token?.open) dialogs.push({ type: "TOKEN_CHOICE", ...token });

  const burst = deps.dialogs.burstChoiceDialog?.getAutomationState?.();
  if (burst?.open) dialogs.push({ type: "BURST_CHOICE", ...burst });

  const mulligan = deps.dialogs.mulliganDialog?.getAutomationState?.();
  if (mulligan?.open) dialogs.push({ type: "MULLIGAN", ...mulligan });

  const chooseFirst = deps.dialogs.chooseFirstPlayerDialog?.getAutomationState?.();
  if (chooseFirst?.open) dialogs.push({ type: "CHOOSE_FIRST_PLAYER", ...chooseFirst });

  const pilot = deps.dialogs.pilotTargetDialog?.getAutomationState?.();
  if (pilot?.open) {
    dialogs.push({ type: "PILOT_TARGET", ...pilot });
  } else if (deps.dialogs.pilotTargetDialog?.isOpen?.()) {
    dialogs.push({ type: "PILOT_TARGET", open: true, targets: 0 });
  }

  const effect = deps.dialogs.effectTargetDialog?.getAutomationState?.();
  if (effect?.open) {
    dialogs.push({ type: "EFFECT_TARGET", ...effect });
  } else if (deps.dialogs.effectTargetDialog?.isOpen?.()) {
    dialogs.push({ type: "EFFECT_TARGET", open: true, targets: 0 });
  }

  return dialogs;
}

export function getBaseCard(raw: any, playerId: string) {
  const players = raw?.gameEnv?.players ?? {};
  const player = players[playerId];
  const zones = player?.zones ?? player?.zone ?? {};
  const base = zones.base ?? player?.base;
  if (Array.isArray(base)) return base[0];
  return base;
}

export function buildCardSnapshot(deps: BridgeDeps): CardUiSnapshot {
  const context = deps.contextStore.get();
  const engineSnapshot = deps.engine.getSnapshot();
  const raw = engineSnapshot.raw as any;
  const players = raw?.gameEnv?.players ?? {};
  const parsed = parseSessionParams(typeof window !== "undefined" ? window.location.search : "");

  const playerId = context.playerId;
  const handCards = deps.handPresenter.toHandCards(raw, playerId);
  const slotCards = deps.slotPresenter.toSlots(raw, playerId);

  const actionState = deps.controls.actionControls?.getAutomationState?.() ?? {
    visible: true,
    waitingMode: false,
    waitingLabel: "",
    buttons: toEngineActions(deps),
  };
  const handState = deps.controls.handControls?.getAutomationState?.() ?? {
    visible: true,
    selectedUid: undefined,
    cards: handCards,
  };
  const slotState = deps.controls.slotControls?.getAutomationState?.() ?? {
    slots: slotCards,
    selectedKey: undefined,
    clicksEnabled: true,
    previewEnabled: true,
  };

  const dialogs = getDialogs(deps);
  const selectedSlot = toSelectedSlot(slotState.selectedKey);

  const { selfId, opponentId } = resolvePlayerIds(players, playerId);
  const playerBaseRaw = selfId ? getBaseCard(raw, selfId) : undefined;
  const opponentBaseRaw = opponentId ? getBaseCard(raw, opponentId) : undefined;

  return {
    ts: Date.now(),
    route: "game",
    context: {
      mode: context.mode,
      gameId: context.gameId,
      playerId: context.playerId,
      playerName: context.playerName,
      joinToken: context.joinToken,
      aiMode: parsed.aiMode,
      isAutoPolling: parsed.isAutoPolling,
      offlineFallback: deps.offlineFallback?.() ?? false,
    },
    engine: {
      status: engineSnapshot.status,
      phase: raw?.gameEnv?.phase ?? raw?.phase,
      currentPlayer: raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer,
      battle: raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle,
      version: raw?.gameEnv?.version,
    },
    selection: deps.engine.getSelection() ?? null,
    ui: {
      actionBar: {
        visible: actionState.visible,
        waitingMode: actionState.waitingMode,
        waitingLabel: actionState.waitingLabel,
        buttons: actionState.buttons.map((button, index) => ({
          index,
          label: button.label,
          enabled: button.enabled !== false,
          primary: button.primary === true,
        })),
      },
      hand: {
        visible: handState.visible,
        selectedUid: handState.selectedUid ?? null,
        cards: handCards.map((card) => ({
          uid: card.uid,
          cardId: card.cardId,
          cardType: card.cardType,
          cost: card.cost,
          ap: card.ap,
          hp: card.hp,
          textureKey: card.textureKey,
          fromPilotDesignation: card.fromPilotDesignation,
        })),
      },
      slots: {
        selected: selectedSlot,
        slots: slotCards.map((slot) => ({
          owner: slot.owner,
          slotId: slot.slotId,
          isRested: slot.isRested,
          ap: slot.ap,
          hp: slot.hp,
          unit: slot.unit
            ? {
                id: slot.unit.id,
                cardUid: slot.unit.cardUid,
                cardType: slot.unit.cardType,
                canAttackThisTurn: slot.unit.canAttackThisTurn,
                isRested: slot.unit.isRested,
                textureKey: slot.unit.textureKey,
              }
            : undefined,
          pilot: slot.pilot
            ? {
                id: slot.pilot.id,
                cardUid: slot.pilot.cardUid,
                cardType: slot.pilot.cardType,
                canAttackThisTurn: slot.pilot.canAttackThisTurn,
                isRested: slot.pilot.isRested,
                textureKey: slot.pilot.textureKey,
              }
            : undefined,
        })),
      },
      base: {
        player: {
          side: "player",
          ownerPlayerId: selfId,
          exists: !!playerBaseRaw,
          cardId: playerBaseRaw?.cardId,
          fieldCardValue: playerBaseRaw?.fieldCardValue,
        },
        opponent: {
          side: "opponent",
          ownerPlayerId: opponentId,
          exists: !!opponentBaseRaw,
          cardId: opponentBaseRaw?.cardId,
          fieldCardValue: opponentBaseRaw?.fieldCardValue,
        },
      },
      dialogs,
    },
  };
}
