import { getTitleForChoiceKind } from "./TargetChoiceKindTitles";
import { mapActionToChoiceKind, normalizeChoiceKind } from "./TargetChoiceActionKinds";

export function resolveTargetChoiceHeader(opts: {
  choiceKind?: unknown;
  action?: unknown;
  contextKind?: unknown;
  effectDescription?: unknown;
  isMulti: boolean;
}): string {
  const normalizedKind = normalizeChoiceKind(opts.choiceKind);
  const actionKind = mapActionToChoiceKind(opts.action);
  const kindTitle = getTitleForChoiceKind(normalizedKind);
  const actionTitle = getTitleForChoiceKind(actionKind);
  const effectDescription = typeof opts.effectDescription === "string" ? opts.effectDescription.trim() : "";
  const action = typeof opts.action === "string" ? opts.action.trim() : "";
  const isStatChoice = action === "modifyAP" || action === "modifyHP";
  if (normalizedKind === "EFFECT_TARGET_CHOICE" && isStatChoice && effectDescription) {
    return effectDescription;
  }
  const title =
    normalizedKind === "EFFECT_TARGET_CHOICE" && actionTitle
      ? actionTitle
      : kindTitle ?? actionTitle;
  if (title) return title;
  return opts.isMulti ? "Choose Targets" : "Choose a Target";
}
