import Phaser from "phaser";
import { HandLayoutRenderer } from "./HandLayoutRenderer";
import type { HandCardView } from "./HandTypes";
import type { Offset, Palette } from "./types";
import { buildHandLayout, type HandLayoutState } from "./HandLayout";
import { HandRenderer } from "./HandRenderer";
import { HandScrollController } from "./HandScrollController";
import { PreviewController } from "./PreviewController";
import { UI_LAYOUT } from "./UiLayoutConfig";
import type { DrawHelpers } from "./HeaderHandler";

export class HandAreaHandler {
  private handCards: HandCardView[] = [];
  private lastOffset: Offset = { x: 0, y: 0 };
  private lastHandSignature?: string;
  private selectedCardUid?: string;
  private previewCardUid?: string;
  private layoutState?: HandLayoutState;
  private onCardClick?: (card: HandCardView) => void;
  private debug = true;

  private layout: HandLayoutRenderer;
  private renderer: HandRenderer;
  private scroll: HandScrollController;
  private previewController: PreviewController;

  constructor(private scene: Phaser.Scene, palette: Palette, drawHelpers: DrawHelpers) {
    this.layout = new HandLayoutRenderer(scene, palette, drawHelpers);
    this.renderer = new HandRenderer(scene, this.layout, UI_LAYOUT.hand.arrows);
    this.scroll = new HandScrollController(scene, UI_LAYOUT.hand.scroll, {
      getMaskRect: () => this.renderer.getMaskRect(),
      applyScrollX: (value) => this.renderer.setScrollX(value),
      updateArrows: (scrollX, minScrollX, maxScrollX) => this.renderer.updateArrows(scrollX, minScrollX, maxScrollX),
      onDragSuppress: () => this.cancelPreviewTimer(),
    });
    this.previewController = new PreviewController(scene, {
      overlayAlpha: UI_LAYOUT.hand.preview.overlayAlpha,
      fadeIn: UI_LAYOUT.hand.preview.fadeIn,
      fadeOut: UI_LAYOUT.hand.preview.fadeOut,
      holdDelay: UI_LAYOUT.hand.preview.holdDelay,
      depth: 2000,
    });
    this.renderer.setArrowHandlers(() => this.scroll.scrollByStep(-1), () => this.scroll.scrollByStep(1));
    this.scroll.bind();
  }

  draw(offset: Offset) {
    this.lastOffset = offset;
    const camW = this.scene.scale.width;
    this.layoutState = buildHandLayout({ offset, camW, handCount: this.handCards.length });
    this.renderer.setLayout(this.layoutState);
    this.scroll.setLayout(this.layoutState);

    this.renderer.renderCards(
      this.handCards,
      this.selectedCardUid,
      (card) => this.startPreviewTimer(card),
      (card) => this.handlePointerUp(card),
      () => this.handlePointerOut(),
    );

    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[HandArea] layout", {
        count: this.handCards.length,
        viewW: this.layoutState.viewW,
        viewH: this.layoutState.viewH,
        cardW: this.layoutState.cardW,
        cardH: this.layoutState.cardH,
        viewX: this.layoutState.viewX,
        viewY: this.layoutState.viewY,
        scrollX: this.scroll.getScrollX(),
        minScrollX: this.layoutState.minScrollX,
      });
    }
  }

  setHand(cards: HandCardView[], opts?: { preserveSelectionUid?: string }) {
    const signature = this.buildHandSignature(cards);
    if (signature && signature === this.lastHandSignature) {
      if (this.layoutState) {
        this.scroll.setLayout(this.layoutState);
      }
      return;
    }
    this.lastHandSignature = signature;
    this.handCards = cards;
    if (this.previewController.isActive() && this.previewCardUid) {
      const stillPresent = cards.find((c) => c.uid === this.previewCardUid);
      if (!stillPresent) {
        this.hidePreview(true);
      }
    }
    const maybeKeep = opts?.preserveSelectionUid;
    if (maybeKeep && cards.some((c) => c.uid === maybeKeep)) {
      this.selectedCardUid = maybeKeep;
    } else {
      this.selectedCardUid = undefined;
    }
    this.draw(this.lastOffset);
  }

  clearHand() {
    this.handCards = [];
    this.selectedCardUid = undefined;
    this.hidePreview(true);
    if (this.layoutState) {
      this.scroll.setLayout(this.layoutState);
    }
    this.renderer.renderCards([], undefined, () => {}, () => {}, () => {});
  }

  setVisible(visible: boolean) {
    this.renderer.setVisible(visible);
  }

  clearSelection() {
    if (!this.selectedCardUid) return;
    this.selectedCardUid = undefined;
    this.draw(this.lastOffset);
  }

  setCardClickHandler(handler: (card: HandCardView) => void) {
    this.onCardClick = handler;
  }

  fadeIn() {
    this.renderer.setVisible(true);
  }

  destroy() {
    this.previewController.destroy();
    this.scroll.destroy();
    this.renderer.destroy();
  }

  private startPreviewTimer(card: HandCardView) {
    const cardW = UI_LAYOUT.hand.preview.cardWidth;
    const cardH = cardW * UI_LAYOUT.hand.preview.cardAspect;
    this.previewController.start((container) => {
      this.previewCardUid = card.uid;
      const texKey = this.toTextureKey(card.textureKey);
      const insideLabel = this.getBadgeLabel(card);
      this.layout.renderPreview(container, 0, 0, cardW, cardH, texKey, insideLabel, card, {
        badgeSize: UI_LAYOUT.hand.preview.badgeSize,
        badgeFontSize: UI_LAYOUT.hand.preview.badgeFontSize,
      });
    });
  }

  private handlePointerUp(card?: HandCardView) {
    if (this.scroll.getDragSuppressClick()) {
      this.scroll.resetDragSuppressClick();
      return;
    }
    if (this.previewController.isActive()) return;
    if (card && this.onCardClick) {
      this.selectedCardUid = card.uid || undefined;
      this.onCardClick(card);
      this.draw(this.lastOffset);
    }
    this.previewController.cancelPending();
  }

  private handlePointerOut() {
    if (this.previewController.isActive()) return;
    this.previewController.cancelPending();
  }

  private hidePreview(skipTween = false) {
    this.previewController.hide(skipTween);
    this.previewCardUid = undefined;
  }

  private toTextureKey(textureKey?: string) {
    if (!textureKey) return undefined;
    return textureKey.replace(/-preview$/, "");
  }

  private getBadgeLabel(card: HandCardView) {
    if (!card) return undefined;
    const type = (card.cardType || "").toLowerCase();
    if (type === "command") {
      if (!card.fromPilotDesignation) return undefined;
      const ap = Number(card.ap ?? 0);
      const hp = Number(card.hp ?? 0);
      return `${ap}|${hp}`;
    }
    if (type === "unit" || type === "pilot" || type === "base" || card.fromPilotDesignation) {
      const ap = Number(card.ap ?? 0);
      const hp = Number(card.hp ?? 0);
      return `${ap}|${hp}`;
    }
    return undefined;
  }

  private buildHandSignature(cards: HandCardView[]) {
    if (!cards || cards.length === 0) return "empty";
    return cards
      .map((c) =>
        [
          c.uid ?? "",
          c.cardId ?? "",
          c.cardType ?? "",
          c.cost ?? "",
          c.ap ?? "",
          c.hp ?? "",
          c.fromPilotDesignation ? "1" : "0",
          c.textureKey ?? "",
        ].join(":"),
      )
      .join("|");
  }
}
