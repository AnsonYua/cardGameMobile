import type { ShieldAreaStatus } from "../ui/ShieldAreaHandler";

type ActionBindingDeps = {
  actionDispatcher: { register: (index: number, handler: () => void) => void };
  shuffleManager?: { play: () => Promise<void> | void } | null;
  baseControls?: {
    setBaseStatus: (isOpponent: boolean, status: ShieldAreaStatus) => void;
    setBaseBadgeLabel: (isOpponent: boolean, label: string) => void;
    setShieldCount: (isOpponent: boolean, count: number) => void;
  } | null;
  playerBaseStatus: ShieldAreaStatus;
  setPlayerBaseStatus: (status: ShieldAreaStatus) => void;
  playerShieldCount: number;
  setPlayerShieldCount: (count: number) => void;
  showDefaultUI: () => void;
  startGame: () => void;
};

export function registerBoardSceneActions(deps: ActionBindingDeps) {
  const baseControls = deps.baseControls;
  deps.actionDispatcher.register(0, () => {
    const promise = deps.shuffleManager?.play();
    promise?.then(() => {
      deps.showDefaultUI();
    });
  });
  deps.actionDispatcher.register(1, () => {
    if (!baseControls) return;
    const nextStatus: ShieldAreaStatus = deps.playerBaseStatus === "rested" ? "normal" : "rested";
    deps.setPlayerBaseStatus(nextStatus);
    baseControls.setBaseStatus(true, nextStatus);
    baseControls.setBaseBadgeLabel(true, nextStatus === "rested" ? "2|3" : "0|3");
  });
  deps.actionDispatcher.register(2, () => {
    if (!baseControls) return;
    deps.setPlayerBaseStatus("normal");
    baseControls.setBaseStatus(true, "normal");
    baseControls.setBaseBadgeLabel(true, "0|0");
  });
  deps.actionDispatcher.register(3, () => {
    if (!baseControls) return;
    const nextCount = (deps.playerShieldCount + 1) % 7;
    deps.setPlayerShieldCount(nextCount);
    baseControls.setShieldCount(true, nextCount);
    baseControls.setBaseBadgeLabel(true, `${nextCount}|6`);
  });
  deps.actionDispatcher.register(9, () => deps.startGame());
}
