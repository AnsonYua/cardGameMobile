import type { CardInteractable, CardUiSnapshot } from "./AutomationTypes";

export function buildInteractables(snapshot: CardUiSnapshot): CardInteractable[] {
  const interactables: CardInteractable[] = [];

  snapshot.ui.actionBar.buttons.forEach((button) => {
    interactables.push({
      id: `action:index:${button.index}`,
      type: "action",
      label: button.label,
      enabled: button.enabled,
      meta: { index: button.index, primary: button.primary },
    });
  });

  const primary = snapshot.ui.actionBar.buttons.find((button) => button.primary);
  if (primary) {
    interactables.push({
      id: "action:primary",
      type: "action",
      label: primary.label,
      enabled: primary.enabled,
      meta: { index: primary.index },
    });
  }

  snapshot.ui.hand.cards.forEach((card, index) => {
    interactables.push({
      id: `hand:uid:${card.uid ?? index}`,
      type: "hand",
      label: card.cardId ?? card.uid ?? `hand-${index}`,
      enabled: !!card.uid,
      meta: { uid: card.uid, index, cardId: card.cardId },
    });
  });

  snapshot.ui.slots.slots.forEach((slot) => {
    interactables.push({
      id: `slot:${slot.owner}:${slot.slotId}`,
      type: "slot",
      label: `${slot.owner}:${slot.slotId}`,
      enabled: true,
      meta: { owner: slot.owner, slotId: slot.slotId },
    });
  });

  if (snapshot.ui.base.player.exists) {
    interactables.push({
      id: "base:player",
      type: "base",
      label: "player base",
      enabled: true,
      meta: { side: "player" },
    });
  }
  if (snapshot.ui.base.opponent.exists) {
    interactables.push({
      id: "base:opponent",
      type: "base",
      label: "opponent base",
      enabled: true,
      meta: { side: "opponent" },
    });
  }

  snapshot.ui.dialogs.forEach((dialog) => {
    if (dialog.type === "PROMPT_CHOICE") {
      dialog.buttons.forEach((button, index) => {
        interactables.push({
          id: `dialog:prompt:${index}`,
          type: "dialog",
          label: button.label,
          enabled: button.enabled,
          meta: { dialog: dialog.type, index },
        });
      });
    }
    if (dialog.type === "OPTION_CHOICE") {
      dialog.choices.forEach((choice) => {
        interactables.push({
          id: `dialog:option:${choice.index}`,
          type: "dialog",
          label: `option:${choice.index}`,
          enabled: choice.enabled,
          meta: { dialog: dialog.type, index: choice.index, cardId: choice.cardId },
        });
      });
    }
    if (dialog.type === "TOKEN_CHOICE") {
      dialog.choices.forEach((choice) => {
        interactables.push({
          id: `dialog:token:${choice.index}`,
          type: "dialog",
          label: `token:${choice.index}`,
          enabled: choice.enabled,
          meta: { dialog: dialog.type, index: choice.index, cardId: choice.cardId },
        });
      });
    }
    if (dialog.type === "MULLIGAN") {
      interactables.push({
        id: "dialog:mulligan:yes",
        type: "dialog",
        label: "mulligan yes",
        enabled: true,
        meta: { dialog: dialog.type, decision: "yes" },
      });
      interactables.push({
        id: "dialog:mulligan:no",
        type: "dialog",
        label: "mulligan no",
        enabled: true,
        meta: { dialog: dialog.type, decision: "no" },
      });
    }
    if (dialog.type === "CHOOSE_FIRST_PLAYER") {
      interactables.push({
        id: "dialog:first:first",
        type: "dialog",
        label: "go first",
        enabled: true,
        meta: { dialog: dialog.type, decision: "first" },
      });
      interactables.push({
        id: "dialog:first:second",
        type: "dialog",
        label: "go second",
        enabled: true,
        meta: { dialog: dialog.type, decision: "second" },
      });
    }
    if (dialog.type === "BURST_CHOICE") {
      interactables.push({
        id: "dialog:burst:trigger",
        type: "dialog",
        label: "trigger burst",
        enabled: dialog.showButtons,
        meta: { dialog: dialog.type, decision: "trigger" },
      });
      interactables.push({
        id: "dialog:burst:cancel",
        type: "dialog",
        label: "cancel burst",
        enabled: dialog.showButtons,
        meta: { dialog: dialog.type, decision: "cancel" },
      });
    }
    if (dialog.type === "PILOT_TARGET") {
      for (let index = 0; index < dialog.targets; index += 1) {
        interactables.push({
          id: `dialog:pilot:${index}`,
          type: "dialog",
          label: `pilot target ${index}`,
          enabled: true,
          meta: { dialog: dialog.type, index },
        });
      }
    }
    if (dialog.type === "EFFECT_TARGET") {
      for (let index = 0; index < dialog.targets; index += 1) {
        interactables.push({
          id: `dialog:effect:${index}`,
          type: "dialog",
          label: `effect target ${index}`,
          enabled: true,
          meta: { dialog: dialog.type, index },
        });
      }
    }
  });

  return interactables;
}
