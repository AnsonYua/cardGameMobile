import Phaser from "phaser";
import { MatchStateMachine } from "../game/MatchStateMachine";
import { GameEngine } from "../game/GameEngine";
import type { TestButtonPopupConfig } from "../ui/TestButtonPopup";
import { TestButtonPopup } from "../ui/TestButtonPopup";
import type { GameContext } from "../game/GameContextStore";

export class DebugControls {
  private popup?: TestButtonPopup;

  constructor(
    private scene: Phaser.Scene,
    private match: MatchStateMachine,
    private engine: GameEngine,
    private context: GameContext,
  ) {}

  show() {
    if (!this.popup) {
      this.popup = new TestButtonPopup(this.scene as any);
    }

    const config: TestButtonPopupConfig = {
      button1: { label: "Test JoinBtn", onClick: () => this.handleTestJoinButton() },
      button2: { label: "Test PollingBtn", onClick: () => this.handleTestPolling() },
      button3: { label: "Test button3", onClick: () => console.log("Test button3 clicked") },
      gameId: this.context.gameId ?? "N/A",
    };
    this.popup.show(config);
  }

  private async handleTestPolling() {
    try {
      const snapshot = await this.engine.updateGameStatus(
        this.context.gameId ?? undefined,
        this.context.playerId,
      );
      if (snapshot) {
        this.context.lastStatus = snapshot.status ?? this.context.lastStatus;
      }
      this.popup?.hide();
      console.log("Polling status:", this.context.lastStatus);
    } catch (err) {
      console.warn("Polling failed", err);
    }
  }

  private async handleTestJoinButton() {
    this.popup?.hide();
    const id = this.context.gameId ?? `demo-${Date.now()}`;
    try {
      await this.match.joinRoom(id, "playerId_2", "Demo Opponent");
    } catch (err) {
      console.error("Test join failed", err);
    }
  }
}
