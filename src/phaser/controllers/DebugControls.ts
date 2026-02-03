import Phaser from "phaser";
import { MatchStateMachine } from "../game/MatchStateMachine";
import { GameEngine } from "../game/GameEngine";
import type { TestButtonPopupConfig } from "../ui/TestButtonPopup";
import { TestButtonPopup } from "../ui/TestButtonPopup";
import type { GameContext } from "../game/GameContextStore";
import { ApiManager } from "../api/ApiManager";
import type { ActionSource } from "../game/GameEngine";

export class DebugControls {
  private popup?: TestButtonPopup;
  private api = new ApiManager();
  private pollEvent?: Phaser.Time.TimerEvent;
  private readonly pollDelayMs = 1000;
  private readonly shouldDeferPolling?: () => boolean;
  private deferredPollPending = false;
  private deferredPollLogged = false;

  constructor(
    private scene: Phaser.Scene,
    private match: MatchStateMachine,
    private engine: GameEngine,
    private context: GameContext,
    opts?: { shouldDeferPolling?: () => boolean },
  ) {
    this.shouldDeferPolling = opts?.shouldDeferPolling;
  }

  show() {
    if (!this.popup) {
      this.popup = new TestButtonPopup(this.scene as any);
    }

    const config: TestButtonPopupConfig = {
      button1: { label: "Test JoinBtn", onClick: () => this.handleTestJoinButton() },
      button2: { label: "Test PollingBtn", onClick: () => this.handleTestPolling() },
      button3: { label: "SetScenario", onClick: () => this.handleSetScenario() },
      button4: { label: this.pollEvent ? "Stop Auto Polling" : "Start Auto Polling", onClick: () => this.toggleAutoPolling() },
      button5: { label: "Test ConfirmBattle (opp)", onClick: () => this.handleConfirmBattleOpponent() },
      button6: { label: "Test ResolveBattle", onClick: () => this.handleResolveBattle() },
      gameId: this.context.gameId ?? "N/A",
    };
    this.popup.show(config);
  }

  // Public helpers for external triggers (unitTestSpec): allow triggering scenarios/polling without clicking UI.
  async setScenario(scenarioPath?: string) {
    await this.handleSetScenario(scenarioPath, { hidePopup: false });
  }

  async pollOnce() {
    await this.handleTestPolling(false, { skipPopupHide: true, source: "PollOnce (external)" });
  }

  async startAutoPolling() {
    await this.beginAutoPolling({ hidePopup: false });
  }

  async stopAutoPolling() {
    await this.endAutoPolling({ hidePopup: false });
  }

  async flushDeferredPoll() {
    if (!this.deferredPollPending) return;
    this.deferredPollPending = false;
    this.deferredPollLogged = false;
    await this.handleTestPolling(false, { skipPopupHide: true, source: "Deferred polling (flush)" });
  }

  // Expose testing hooks on window.__cardTest using provided helpers from the scene.
  exposeTestHooks(hooks: {
    selectHandCard: (uid?: string) => boolean;
    clickPrimaryAction: (source?: ActionSource) => Promise<boolean>;
    runAction: (id: string, source?: ActionSource) => Promise<boolean>;
    selectEffectTarget: (targetIndex?: number) => Promise<boolean>;
    selectPilotTarget: (targetIndex?: number, actionId?: string) => Promise<boolean>;
    choosePilotDesignationPilot: () => Promise<boolean>;
    choosePilotDesignationCommand: () => Promise<boolean>;
  }) {
    if (typeof window === "undefined") return;
    const globalKey = "__cardTest";
    const baseHooks = {
      setScenario: (path?: string) => this.setScenario(path),
      pollOnce: () => this.pollOnce(),
      startAutoPolling: () => this.startAutoPolling(),
      stopAutoPolling: () => this.stopAutoPolling(),
    };
    (window as any)[globalKey] = { ...baseHooks, ...hooks };
  }

  private async handleSetScenario(scenarioPath?: string, opts?: { hidePopup?: boolean }) {
    if (opts?.hidePopup !== false) {
      await this.popup?.hide();
    }
    //st01-001/pair_ap_boost_turn.json
    //const targetScenario = scenarioPath || "ST02/ST02-003/paired_splash";
    //const targetScenario = scenarioPath || "ST01/ST01-011/burst_add_to_hand";
    //const targetScenario = scenarioPath || "ST01/ST01-011/burst_add_to_hand";
    //const targetScenario = scenarioPath || "ActionCase/T-014/restrictions_cannot_set_active_or_pair"
    //const targetScenario = scenarioPath || "ActionCase/ST08-011/effect_draw_grant_high_maneuver_if_paired_blue_unit"
    //const targetScenario = scenarioPath || "ActionCase/ST08-011/effect_draw_grant_high_maneuver_if_paired_unit_blue" 
    //const targetScenario = scenarioPath || "ActionCase/ST08-001/pair_damage_highest_level_enemy_3"
    const targetScenario = scenarioPath || "ActionCase/ST08-001/costing_level6_onfield"
    //const targetScenario = scenarioPath || "ActionCase/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2_notarget"
    //const targetScenario = scenarioPath ||"ST02/ST02-006/activate_once_per_turn"
    //const targetScenario = scenarioPath || "ActionCase/ST05-001/suppression_damaged_unit_attacks_two_shields_multiple_burst";
    //const targetScenario = scenarioPath || "ST01/ST01-008/blocker_choice_multiple_active"
    //const targetScenario = scenarioPath || "ST01/ST01-015/token_deploy_one_unit";
    try {
      const scenarioJson = await this.api.getTestScenario(targetScenario);
      const gameEnv =
        scenarioJson?.initialGameEnv ??
        scenarioJson?.gameEnv ??
        scenarioJson?.scenario?.initialGameEnv ??
        scenarioJson?.scenario?.gameEnv ??
        null;
      if (!gameEnv) {
        void scenarioJson;
        throw new Error("Scenario response missing initialGameEnv");
      }
      const gameId = this.context.gameId || scenarioJson?.gameId || gameEnv?.gameId || "sample_play_card";
      if (gameEnv?.currentPlayer && gameEnv.currentPlayer !== this.context.playerId) {
        this.context.playerId = gameEnv.currentPlayer;
      }

      //alert(gameId)
      await this.api.injectGameState(gameId, gameEnv);
      await this.engine.loadGameResources(gameId, this.context.playerId, { gameEnv } as any);
      await this.engine.updateGameStatus(gameId, this.context.playerId, { fromScenario: true, silent: true });
      //check the response of initialGameEnv. if currentPlayer = playerId_2 set this.context.playerId to that value
    } catch (err) {
      console.error("Set scenario failed", err);
    }
  }
  private async handleTestPolling(silentRefresh = false, opts?: { skipPopupHide?: boolean; source?: string }) {
    try {
      if (!opts?.skipPopupHide) {
        await this.popup?.hide();
      }
      if (this.shouldDeferPolling?.()) {
        this.deferredPollPending = true;
        if (!this.deferredPollLogged) {
          this.deferredPollLogged = true;
        }
        return;
      }
      const snapshot = await this.engine.updateGameStatus(this.context.gameId ?? undefined, this.context.playerId, {
        silent: silentRefresh,
        fromScenario: false,
      });
      if (snapshot) {
        this.context.lastStatus = snapshot.status ?? this.context.lastStatus;
      }
    } catch (err) {
      void err;
    }
  }

  private async toggleAutoPolling() {
    const isActive = !!this.pollEvent;
    if (isActive) {
      await this.endAutoPolling({ hidePopup: true });
      return;
    }

    await this.beginAutoPolling({ hidePopup: true });
  }

  private async beginAutoPolling(opts?: { hidePopup?: boolean }) {
    // Kick off an immediate poll, then schedule every 5 seconds.
    await this.handleTestPolling(false, { skipPopupHide: true, source: "Auto polling (initial)" });
    this.pollEvent = this.scene.time.addEvent({
      delay: this.pollDelayMs,
      loop: true,
      callback: () => {
        void this.handleTestPolling(false, { skipPopupHide: true, source: "Auto polling" });
      },
    });
    if (opts?.hidePopup !== false) {
      await this.popup?.hide();
    }
  }

  private async endAutoPolling(opts?: { hidePopup?: boolean }) {
    const isActive = !!this.pollEvent;
    if (!isActive) return;
    this.pollEvent?.remove();
    this.pollEvent = undefined;
    if (opts?.hidePopup !== false) {
      await this.popup?.hide();
    }
  }

  private async handleTestJoinButton() {
    await this.popup?.hide();
    const id = this.context.gameId ?? `demo-${Date.now()}`;
    try {
      await this.match.joinRoom(id, "playerId_2", "Demo Opponent");
    } catch (err) {
      console.error("Test join failed", err);
    }
  }

  private async handleConfirmBattleOpponent() {
    await this.popup?.hide();
    await this.popup?.hide();
    const raw: any = this.engine.getSnapshot().raw;
    const players = raw?.gameEnv?.players || {};
    const ids = Object.keys(players);
    const selfId = this.context.playerId;
    const opponentId = ids.find((id) => id !== selfId) || selfId;
    const gameId = this.context.gameId || raw?.gameEnv?.gameId || "sample_play_card";
    try {
      await this.api.playerAction({
        playerId: opponentId,
        gameId,
        actionType: "confirmBattle",
      });
      await this.engine.updateGameStatus(gameId, selfId);
    } catch (err) {
      void err;
    }
  }

  private async handleResolveBattle() {
    const raw: any = this.engine.getSnapshot().raw;
    const gameId = this.context.gameId || raw?.gameEnv?.gameId || "sample_play_card";
    const playerId = this.context.playerId || "playerId_1";
    try {
      await this.api.playerAction({
        playerId,
        gameId,
        actionType: "resolveBattle",
      });
      await this.engine.updateGameStatus(gameId, this.context.playerId);
    } catch (err) {
      void err;
    }
  }
}
