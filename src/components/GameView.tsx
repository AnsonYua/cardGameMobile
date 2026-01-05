import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { BoardScene } from "../phaser/BoardScene";
import { BASE_H, BASE_W } from "../config/gameLayout";

export function GameView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: BASE_W,
      height: BASE_H,
      backgroundColor: "#4765d2ff",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene: [BoardScene],
    });

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
