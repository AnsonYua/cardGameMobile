import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BoardScene } from "../phaser/BoardScene";
import { BASE_H, BASE_W } from "../config/gameLayout";

export function GameView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const renderResolution = Math.min(2, Math.max(1, dpr));

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: BASE_W,
      height: BASE_H,
      autoRound: false,
      backgroundColor: "#4765d2ff",
      render: {
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        mipmapFilter: "LINEAR_MIPMAP_LINEAR",
      },
      dom: {
        createContainer: true,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene: [BoardScene],
    };
    (config as Phaser.Types.Core.GameConfig & { resolution?: number }).resolution = renderResolution;
    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="page">
      <div className="game-container" ref={containerRef} />
    </div>
  );
}
