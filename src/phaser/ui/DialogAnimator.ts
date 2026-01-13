import Phaser from "phaser";

export function animateDialogIn(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
  container.setAlpha(0).setScale(0.96);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    scale: 1,
    duration: 160,
    ease: "Back.easeOut",
  });
}

export function animateDialogOut(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  onComplete: () => void,
) {
  scene.tweens.add({
    targets: container,
    alpha: 0,
    scale: 1.02,
    duration: 140,
    ease: "Sine.easeIn",
    onComplete,
  });
}
