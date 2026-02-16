import {
  BASE_H,
  HAND_AREA_HEIGHT,
  HAND_CARD_ASPECT,
  HAND_GAP_X,
  HAND_PADDING_X,
  HAND_INNER_PADDING_X,
  HAND_TARGET_CARD_W,
  HAND_VISIBLE_COUNT,
} from "../../config/gameLayout";
import type { Offset } from "./types";

export type HandLayoutState = {
  cardW: number;
  cardH: number;
  gapX: number;
  viewW: number;
  viewH: number;
  viewX: number;
  viewY: number;
  centerY: number;
  innerPaddingX: number;
  minScrollX: number;
  maxScrollX: number;
};

export type HandLayoutParams = {
  offset: Offset;
  camW: number;
  handCount: number;
};

export function buildHandLayout({ offset, camW, handCount }: HandLayoutParams): HandLayoutState {
  const gapX = HAND_GAP_X;
  const paddingX = HAND_PADDING_X;
  const innerPaddingX = HAND_INNER_PADDING_X;
  const maxVisible = HAND_VISIBLE_COUNT;
  const viewW = Math.max(120, camW * 0.95 - paddingX * 2);
  const cardW = Math.max(60, Math.min(HAND_TARGET_CARD_W, (viewW - gapX * (maxVisible - 1)) / maxVisible));
  const cardH = cardW * HAND_CARD_ASPECT;
  const viewH = Math.max(cardH + 6, HAND_AREA_HEIGHT);
  const viewX = (camW - viewW) / 2;
  // Keep the same hand area size, but sit it slightly lower to avoid crowding status text.
  const viewY = BASE_H - viewH - 6 + offset.y;
  const centerY = viewY + viewH / 2;
  const totalW = handCount ? innerPaddingX * 2 + handCount * cardW + gapX * (handCount - 1) : 0;
  const centeredX = totalW < viewW ? (viewW - totalW) / 2 : 0;
  const minScrollX = totalW < viewW ? centeredX : Math.min(0, viewW - totalW);
  const maxScrollX = totalW < viewW ? centeredX : 0;

  return { cardW, cardH, gapX, viewW, viewH, viewX, viewY, centerY, innerPaddingX, minScrollX, maxScrollX };
}
