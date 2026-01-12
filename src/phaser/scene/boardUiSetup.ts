import Phaser from "phaser";
import { BoardUI } from "../ui/BoardUI";
import { ShuffleAnimationManager } from "../animations/ShuffleAnimationManager";

export type BoardTheme = {
  ink: string;
  slot: string;
  accent: string;
  text: string;
  bg: string;
};

export type BoardUiControls = {
  baseControls: ReturnType<BoardUI["getBaseControls"]>;
  trashControls: ReturnType<BoardUI["getTrashControls"]>;
  energyControls: ReturnType<BoardUI["getEnergyControls"]>;
  statusControls: ReturnType<BoardUI["getStatusControls"]>;
  handControls: ReturnType<BoardUI["getHandControls"]>;
  actionControls: ReturnType<BoardUI["getActionControls"]>;
  headerControls: ReturnType<BoardUI["getHeaderControls"]>;
  slotControls: ReturnType<BoardUI["getSlotControls"]>;
};

export type BoardUiSetup = {
  ui: BoardUI;
  shuffleManager: ShuffleAnimationManager;
  controls: BoardUiControls;
};

export function setupBoardUi(scene: Phaser.Scene, offset: { x: number; y: number }, theme: BoardTheme): BoardUiSetup {
  const ui = new BoardUI(scene, {
    ink: theme.ink,
    slot: theme.slot,
    accent: theme.accent,
    text: theme.text,
    bg: theme.bg,
  });

  const controls: BoardUiControls = {
    baseControls: ui.getBaseControls(),
    trashControls: ui.getTrashControls(),
    energyControls: ui.getEnergyControls(),
    statusControls: ui.getStatusControls(),
    handControls: ui.getHandControls(),
    actionControls: ui.getActionControls(),
    headerControls: ui.getHeaderControls(),
    slotControls: ui.getSlotControls(),
  };

  const shuffleManager = new ShuffleAnimationManager(scene, offset, {
    getSlotPositions: () => controls.slotControls?.getBoardSlotPositions?.(),
  });

  return { ui, shuffleManager, controls };
}
