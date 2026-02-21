export const CHOICE_KIND_TITLES: Record<string, string> = {
  DISCARD_FROM_HAND: "Choose a card to discard",
  MOVE_FROM_HAND_TO_DECK_BOTTOM: "Choose a card to put on the bottom of your deck",
  MOVE_FROM_TRASH_TO_DECK: "Choose a card in your trash to put into your deck",
  EXILE_FROM_TRASH: "Choose a card in your trash to exile",
  DESTROY: "Choose a target to destroy",
  RETURN_TO_HAND: "Choose a target to return to hand",
  ADD_TO_HAND: "Choose a card to add to your hand",
  REST: "Choose a target to rest",
  SET_ACTIVE: "Choose a target to set active",
  RESTRICT_ATTACK: "Choose a unit to apply an attack restriction",
  PREVENT_BATTLE_DAMAGE: "Choose a unit to prevent battle damage",
  PREVENT_SET_ACTIVE_NEXT_TURN: "Choose a unit that can't be set active next turn",
  ALLOW_ATTACK_TARGET: "Choose an attack target",
  DAMAGE: "Choose a target to deal damage to",
  DAMAGE_SHIELD: "Choose a shield to damage",
  HEAL: "Choose a target to heal",
  MODIFY_AP: "Choose a target to modify AP",
  MODIFY_HP: "Choose a target to modify HP",
  DEPLOY_FROM_HAND: "Choose a card to deploy from your hand",
  PAIR_FROM_HAND: "Choose a Pilot in your hand to pair",
  PAIR_FROM_TRASH: "Choose a Pilot in your trash to pair",
  GRANT_KEYWORD: "Choose a target to gain a keyword",
  GRANT_BREACH: "Choose a target to gain Breach",
  PREVENT_SHIELD_DAMAGE: "Choose a player/side to prevent shield damage",
  SCRY_TOP_DECK: "Look at the top cards of your deck",
  ADD_BASIC_ENERGY: "Add basic energy",
  ADD_EXTRA_ENERGY: "Add extra energy",
  CONDITIONAL_TOKEN_DEPLOY: "Choose where to deploy the token",
  REDIRECT_ATTACK: "Choose an attack target to redirect",
  EFFECT_TARGET_CHOICE: "Choose a target",
};

export function getTitleForChoiceKind(choiceKind?: string): string | undefined {
  if (!choiceKind) return undefined;
  return CHOICE_KIND_TITLES[choiceKind];
}
