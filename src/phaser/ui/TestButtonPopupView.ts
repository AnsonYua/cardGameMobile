import Phaser from "phaser";
import { computeButtonStackLayout, computePopupSize } from "./TestButtonPopupLayout";
import { redrawRoundedGraphics } from "./graphics/roundedGraphics";
import { DEBUG_POPUP_WAITING_THEME as THEME } from "./style/WaitingDialogTheme";
import type { TestButtonPopupConfig, PopupButton } from "./TestButtonPopupTypes";

type CreateTestButtonPopupViewParams = {
  scene: Phaser.Scene;
  depth: number;
  tweenDuration: number;
  config: TestButtonPopupConfig;
  onHide: () => Promise<void> | void;
  onButtonClick: (action?: () => void) => Promise<void> | void;
  onCopyGameLink: () => void;
};

export type TestButtonPopupView = {
  backdrop: Phaser.GameObjects.Rectangle;
  container: Phaser.GameObjects.Container;
};

export function createTestButtonPopupView(params: CreateTestButtonPopupViewParams): TestButtonPopupView {
  const { scene, depth, tweenDuration, config, onHide, onButtonClick, onCopyGameLink } = params;
  const { width, height } = scene.scale;
  const { gameId } = config;
  const buttonKeys = ["button1", "button2", "button3", "button4", "button5", "button6", "button7", "button8"] as const;
  const buttons = buttonKeys.map((key) => config[key]).filter(Boolean) as PopupButton[];

  const { popupW, popupH } = computePopupSize({
    viewportWidth: width,
    viewportHeight: height,
    buttonCount: buttons.length,
    hasScenarioPicker: !!config.scenarioPicker,
    hasFooter: !!gameId,
  });
  const centerX = width / 2;
  const centerY = height / 2;

  const backdrop = scene.add
    .rectangle(centerX, centerY, width, height, THEME.backdrop, 0.44)
    .setDepth(depth - 1)
    .setAlpha(0)
    .setInteractive();

  const bgShadow = scene.add.graphics().setDepth(depth);
  redrawRoundedGraphics({
    target: bgShadow,
    x: 0,
    y: 4,
    width: popupW + 10,
    height: popupH + 12,
    radius: 24,
    fillColor: THEME.shadow,
    fillAlpha: 0.34,
  });

  const bg = scene.add.graphics().setDepth(depth + 1);
  redrawRoundedGraphics({
    target: bg,
    x: 0,
    y: 0,
    width: popupW,
    height: popupH,
    radius: 20,
    fillColor: THEME.panel,
    fillAlpha: 0.96,
    strokeColor: THEME.panelStroke,
    strokeWidth: 2,
  });

  const inner = scene.add.graphics().setDepth(depth + 2);
  redrawRoundedGraphics({
    target: inner,
    x: 0,
    y: 0,
    width: popupW - 14,
    height: popupH - 14,
    radius: 16,
    fillColor: THEME.panelInner,
    fillAlpha: 0.45,
  });

  const headerY = -popupH / 2 + 30;
  const title = scene.add
    .text(-popupW / 2 + 16, headerY, "Debug Controls", {
      fontSize: "18px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: THEME.textPrimary,
    })
    .setOrigin(0, 0.5)
    .setDepth(depth + 4);

  const closeBtn = scene.add.circle(popupW / 2 - 20, headerY, 14, THEME.closeFill, 0.95).setDepth(depth + 4);
  closeBtn.setStrokeStyle(1, THEME.closeStroke, 0.92);
  const closeLabel = scene.add
    .text(closeBtn.x, closeBtn.y - 1, "×", { fontSize: "22px", fontFamily: "Arial", color: THEME.textPrimary })
    .setOrigin(0.5)
    .setDepth(depth + 5);

  closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => void onHide());
  closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => void onHide());
  closeBtn.on("pointerover", () => closeBtn.setFillStyle(THEME.panelStroke, 1));
  closeBtn.on("pointerout", () => closeBtn.setFillStyle(THEME.closeFill, 0.95));

  let btnGap = 10;
  let btnH = 42;
  const btnW = popupW - 36;
  const btnObjs: Phaser.GameObjects.GameObject[] = [];
  const footerReserve = gameId ? 78 : 24;
  const sectionGap = 14;

  let yTop = -popupH / 2 + 58;

  const picker = config.scenarioPicker;
  if (picker) {
    const pickerTitle = scene.add
      .text(-btnW / 2, yTop, picker.title ?? "Scenario", {
        fontSize: "13px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: THEME.textPrimary,
      })
      .setOrigin(0, 0)
      .setDepth(depth + 4);
    btnObjs.push(pickerTitle);
    yTop += 24;

    const pickerH = 38;
    const pickerY = yTop + pickerH / 2;
    const pickerBg = scene.add.graphics().setDepth(depth + 2);
    redrawRoundedGraphics({
      target: pickerBg,
      x: 0,
      y: pickerY,
      width: btnW,
      height: pickerH,
      radius: 10,
      fillColor: THEME.panelInner,
      fillAlpha: 0.96,
      strokeColor: THEME.panelStroke,
    });
    btnObjs.push(pickerBg);

    const wrapper = document.createElement("div");
    wrapper.style.width = `${btnW - 12}px`;
    wrapper.style.height = "32px";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.height = "32px";
    select.style.fontSize = "12px";
    select.style.borderRadius = "8px";
    select.style.border = "1px solid rgba(91, 96, 104, 0.98)";
    select.style.background = "rgba(47, 50, 56, 0.98)";
    select.style.color = THEME.textPrimary;
    select.style.padding = "0 8px";
    select.style.outline = "none";
    select.style.boxShadow = "inset 0 0 0 1px rgba(255,255,255,0.04)";

    picker.options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt;
      option.text = opt;
      select.appendChild(option);
    });
    if (picker.value && picker.options.includes(picker.value)) {
      select.value = picker.value;
    }
    select.addEventListener("change", () => picker.onChange?.(select.value));
    wrapper.appendChild(select);

    const dropdown = scene.add.dom(0, pickerY, wrapper).setOrigin(0.5).setDepth(depth + 4);
    btnObjs.push(dropdown);
    yTop += pickerH + sectionGap;
  }

  const stackLayout = computeButtonStackLayout({
    buttonCount: buttons.length,
    startY: yTop,
    maxBottomY: popupH / 2 - footerReserve,
    baseButtonHeight: btnH,
    baseGap: btnGap,
    sectionGap,
  });
  yTop = stackLayout.startY;
  btnH = stackLayout.buttonHeight;
  btnGap = stackLayout.buttonGap;

  buttons.forEach((btn, idx) => {
    const y = yTop + btnH / 2 + idx * (btnH + btnGap);
    const rect = scene.add.graphics().setDepth(depth + 2);
    redrawRoundedGraphics({
      target: rect,
      x: 0,
      y,
      width: btnW,
      height: btnH,
      radius: 10,
      fillColor: THEME.row,
      fillAlpha: 0.96,
      strokeColor: THEME.rowBorder,
    });

    const label = scene.add
      .text(0, y, btn.label, {
        fontSize: "15px",
        fontFamily: "Arial",
        color: THEME.textPrimary,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(depth + 4);

    const hit = scene.add.rectangle(0, y, btnW, btnH, 0x000000, 0.001).setDepth(depth + 5);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => void onButtonClick(btn.onClick));
    hit.on("pointerover", () => {
      redrawRoundedGraphics({
        target: rect,
        x: 0,
        y,
        width: btnW,
        height: btnH,
        radius: 10,
        fillColor: THEME.rowHover,
        fillAlpha: 1,
        strokeColor: THEME.rowHoverBorder,
      });
      label.setColor("#ffffff");
    });
    hit.on("pointerout", () => {
      redrawRoundedGraphics({
        target: rect,
        x: 0,
        y,
        width: btnW,
        height: btnH,
        radius: 10,
        fillColor: THEME.row,
        fillAlpha: 0.96,
        strokeColor: THEME.rowBorder,
      });
      label.setColor(THEME.textPrimary);
    });
    btnObjs.push(rect, label, hit);
  });

  if (gameId) {
    const footerY = popupH / 2 - 30;
    const footerW = popupW - 22;
    const footerH = 48;
    const footerBg = scene.add.graphics().setDepth(depth + 2);
    redrawRoundedGraphics({
      target: footerBg,
      x: 0,
      y: footerY,
      width: footerW,
      height: footerH,
      radius: 10,
      fillColor: THEME.panelInner,
      fillAlpha: 0.96,
      strokeColor: THEME.panelStroke,
    });

    const footerText = scene.add
      .text(0, footerY, `Game ID: ${gameId}\nTap to copy join link`, {
        fontSize: "12px",
        fontFamily: "Arial",
        color: THEME.textPrimary,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(depth + 4);

    const footerHit = scene.add.rectangle(0, footerY, footerW, footerH, 0x000000, 0.001).setDepth(depth + 5);
    footerHit.setInteractive({ useHandCursor: true }).on("pointerdown", () => onCopyGameLink());
    footerText.setInteractive({ useHandCursor: true }).on("pointerdown", () => onCopyGameLink());
    footerHit.on("pointerover", () =>
      redrawRoundedGraphics({
        target: footerBg,
        x: 0,
        y: footerY,
        width: footerW,
        height: footerH,
        radius: 10,
        fillColor: THEME.rowHover,
        fillAlpha: 1,
        strokeColor: THEME.rowHoverBorder,
      }),
    );
    footerHit.on("pointerout", () =>
      redrawRoundedGraphics({
        target: footerBg,
        x: 0,
        y: footerY,
        width: footerW,
        height: footerH,
        radius: 10,
        fillColor: THEME.panelInner,
        fillAlpha: 0.96,
        strokeColor: THEME.panelStroke,
      }),
    );
    btnObjs.push(footerBg, footerText, footerHit);
  }

  const container = scene.add
    .container(centerX, centerY, [bgShadow, bg, inner, title, closeBtn, closeLabel, ...btnObjs])
    .setDepth(depth);
  container.setAlpha(0);

  scene.tweens.add({
    targets: [backdrop, container],
    alpha: 1,
    duration: tweenDuration,
    ease: "Quad.easeOut",
  });

  return { backdrop, container };
}
