const ACTION_TO_CHOICE_KIND: Record<string, string> = {
  discardFromHand: "DISCARD_FROM_HAND",
  moveFromHandToDeckBottom: "MOVE_FROM_HAND_TO_DECK_BOTTOM",
  moveFromTrashToDeck: "MOVE_FROM_TRASH_TO_DECK",
  exileFromTrash: "EXILE_FROM_TRASH",
  destroy: "DESTROY",
  returnToHand: "RETURN_TO_HAND",
  addToHand: "ADD_TO_HAND",
  rest: "REST",
  setActive: "SET_ACTIVE",
  restrict_attack: "RESTRICT_ATTACK",
  prevent_battle_damage: "PREVENT_BATTLE_DAMAGE",
  prevent_set_active_next_turn: "PREVENT_SET_ACTIVE_NEXT_TURN",
  allow_attack_target: "ALLOW_ATTACK_TARGET",
  damage: "DAMAGE",
  damageShield: "DAMAGE_SHIELD",
  heal: "HEAL",
  modifyAP: "MODIFY_AP",
  modifyHP: "MODIFY_HP",
  deploy_from_hand: "DEPLOY_FROM_HAND",
  pair_from_hand: "PAIR_FROM_HAND",
  pair_from_trash: "PAIR_FROM_TRASH",
  grant_keyword: "GRANT_KEYWORD",
  grant_breach: "GRANT_BREACH",
  prevent_shield_damage: "PREVENT_SHIELD_DAMAGE",
  scry_top_deck: "SCRY_TOP_DECK",
  addBasicEnergy: "ADD_BASIC_ENERGY",
  addExtraEnergy: "ADD_EXTRA_ENERGY",
  conditionalTokenDeploy: "CONDITIONAL_TOKEN_DEPLOY",
};

export function normalizeChoiceKind(choiceKind: unknown): string | undefined {
  const kind = (choiceKind ?? "").toString().trim().toUpperCase();
  if (!kind) return undefined;
  if (kind.startsWith("SEQUENCE_")) return kind.slice("SEQUENCE_".length);
  return kind;
}

export function mapActionToChoiceKind(action: unknown): string | undefined {
  const key = typeof action === "string" ? action.trim() : "";
  if (!key) return undefined;
  return ACTION_TO_CHOICE_KIND[key];
}
