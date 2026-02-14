import { HAND_CARD_ASPECT, HAND_GAP_X, HAND_PADDING_X, HAND_TARGET_CARD_W, HAND_VISIBLE_COUNT } from "../../config/gameLayout";

export function computeHandCardSize(camW: number) {
  const viewW = Math.max(120, camW * 0.95 - HAND_PADDING_X * 2);
  const cardW = Math.max(
    60,
    Math.min(HAND_TARGET_CARD_W, (viewW - HAND_GAP_X * (HAND_VISIBLE_COUNT - 1)) / HAND_VISIBLE_COUNT),
  );
  const cardH = cardW * HAND_CARD_ASPECT;
  return { w: cardW, h: cardH };
}
