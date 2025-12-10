import Phaser from "phaser";
import { MatchStateMachine } from "../game/MatchStateMachine";
import { GameEngine } from "../game/GameEngine";
import type { TestButtonPopupConfig } from "../ui/TestButtonPopup";
import { TestButtonPopup } from "../ui/TestButtonPopup";
import type { GameContext } from "../game/GameContextStore";
import { ApiManager } from "../api/ApiManager";

export class DebugControls {
  private popup?: TestButtonPopup;
  private api = new ApiManager();

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
      button3: { label: "SetScenario", onClick: () => this.handleSetScenario() },
      gameId: this.context.gameId ?? "N/A",
    };
    this.popup.show(config);
  }


  private async handleSetScenario() {
    this.popup?.hide();
    const scenarioPath = "BasicCase/basicMainBasest01_016_1";
    try {
      const scenarioJson = await this.api.getTestScenario(scenarioPath);
      const gameEnv =
        scenarioJson?.initialGameEnv ??
        scenarioJson?.gameEnv ??
        scenarioJson?.scenario?.initialGameEnv ??
        scenarioJson?.scenario?.gameEnv ??
        null;
      if (!gameEnv) {
        console.warn("Scenario response missing initialGameEnv; raw payload:", scenarioJson);
        throw new Error("Scenario response missing initialGameEnv");
      }
      const gameId = this.context.gameId || scenarioJson?.gameId || gameEnv?.gameId || "sample_play_card";
      if (gameEnv?.currentPlayer && gameEnv.currentPlayer !== this.context.playerId) {
        this.context.playerId = gameEnv.currentPlayer;
      }
      await this.api.injectGameState(gameId, gameEnv);
      await this.engine.loadGameResources(gameId, this.context.playerId, { gameEnv } as any);
      console.log("Scenario injected", { scenarioPath, gameId });
      await this.engine.updateGameStatus(gameId, this.context.playerId, true);
      //check the response of initialGameEnv. if currentPlayer = playerId_2 set this.context.playerId to that value
    } catch (err) {
      console.error("Set scenario failed", err);
    }
  }
  private async handleTestPolling(isSetScenoria=false) {
    try {
      const snapshot = await this.engine.updateGameStatus(
        this.context.gameId ?? undefined,
        this.context.playerId,
        isSetScenoria
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
