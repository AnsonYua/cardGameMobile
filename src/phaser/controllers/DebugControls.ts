import Phaser from "phaser";
import { MatchStateMachine } from "../game/MatchStateMachine";
import { GameEngine } from "../game/GameEngine";
import type { TestButtonPopupConfig } from "../ui/TestButtonPopup";
import { TestButtonPopup } from "../ui/TestButtonPopup";
import type { GameContext } from "../game/GameContextStore";
import { ApiManager } from "../api/ApiManager";
import { updateSession } from "../game/SessionStore";
import { resolveScenarioPlayerId, type ScenarioPlayerSelector } from "../game/SeatSelector";

const DEFAULT_SCENARIO_PATH = "ActionCase/GD01-003/attack_link_move_12_from_trash_shuffle_set_active_first_strike";
const SCENARIO_PRESETS: readonly string[] = [
  "ST01/ST01-008/blocker_choice_multiple_active",
  "ST01/ST01-011/burst_add_to_hand",
  "ST01/ST01-015/token_deploy_one_unit",
  "ST02/ST02-003/paired_splash",
  "ST02/ST02-006/activate_once_per_turn",
  "ST02/ST02-015/deploy_full_board_from_capture_multi_effect_order",
  "ST02/ST02-016/deploy_full_board_from_capture",
  "ST03/ST03-008/attack_ap_boost_self_only",
  "ST03/ST03-015/deploy_full_board_from_capture_multi_effect_order",
  "ST03/ST03-016/deploy_full_board_from_capture_multi_effect_order",

  "GD01/GD01-118/draw2_dis1",
  "GD02/GD02-058/deploy_draw1_dis1",
  "GD02/GD02-070/deploy_draw2_dis2_if_trash_4_gjallarhorn",
  "GD02/GD02-098/pair_draw1_dis1_if_aeug",
  "GD02/GD02-117/draw3_dis2",
  "GD03/GD03-072/deploy_draw1_dis1_if_another_tsa",
  
  "ActionCase/GD01-003/attack_link_move_12_from_trash_shuffle_set_active_first_strike",
  "ActionCase/GD01-005/destroyed_linked_return_pilot_then_discard",
  "ActionCase/GD01-009/deploy_choose_white_base_team_unit_grant_high_maneuver",
  "ActionCase/GD01-019/gain_blocker_if_enemy_units_ge_4",
  "ActionCase/GD01-023/activate_discard_zeon_unit_then_pair_newtype_pilot_from_trash",
  "ActionCase/GD01-025/pair_place_rested_resource_then_first_strike",
  "ActionCase/GD01-044/pair_damage_1_choose_1_to_2_enemy_units",
  "ActionCase/GD01-047/attack_if_two_other_rested_choose_enemy_damage_3",
  "ActionCase/GD01-048/deploy_tutor_top_choose_bottom",
  "ActionCase/GD01-048/deploy_tutor_top_take_zeon_unit",
  "ActionCase/GD01-050/attack_ap_ge_5_choose_enemy_damage_2",
  "ActionCase/GD01-058/activate_action_choose_lv4_or_higher_unit_ap_plus_1_until_end_of_battle",
  "ActionCase/GD01-059/attack_ap_plus_2_auto_target_source",
  "ActionCase/GD01-063/first_strike_vs_battle_opponent_level_le_2",
  "ActionCase/GD01-069/activate_set_active_blocker_then_restrict_attack",
  "ActionCase/GD01-097/activate_set_active_then_restrict_attack_if_opponent_hand_ge_8",
  "ActionCase/GD01-108/main_damage_all_blockers_2",
  "ActionCase/GD02-001/paired_titans_shield_area_battle_damage_heal_2",
  "ActionCase/GD02-002/link_once_per_turn_set_active_on_friendly_battle_destroy_nopilot",
  "ActionCase/GD02-007/repair_2_end_of_turn",
  "ActionCase/GD02-009/ap_reduced_by_enemy_effect_retaliate_damage_2",
  "ActionCase/GD02-010/effect_damage_received_enemy_draw_once_per_turn",
  "ActionCase/GD02-022/gain_breach_2_on_ex_resource_once_per_turn",
  "ActionCase/GD02-023/link_first_strike_if_player_level_ge_7",
  "ActionCase/GD02-031/continuous_ap_plus_2_if_player_level_ge_7_more",
  "ActionCase/GD02-033/gain_breach_5_if_another_zeon_link",
  "ActionCase/GD02-034/pair_ap_boost_if_paired_red_pilot",
  "ActionCase/GD02-054/attack_cost_destroy_friendly_then_damage_2_to_enemy_le_4",
  "ActionCase/GD02-095/attack_damaged_le_5_grant_high_maneuver_skip_blocker",
  "ActionCase/GD02-123/deploy_full_board_from_capture_multi_effect_order",
  "ActionCase/GD03-008/during_pair_grant_repair_2_then_end_phase_heal",
  "ActionCase/GD03-015/activate_exile_3_titans_then_grant_breach_4",
  "ActionCase/GD03-015/activate_exile_3_titans_then_grant_breach_4_multiple",
  "ActionCase/GD03-019/force_attack_target_if_rested_paired",
  "ActionCase/GD03-028/attack_if_target_unit_ap_plus_2_auto_target_source",
  "ActionCase/GD03-040/linked_grant_high_maneuver_skip_blocker_hand",
  "ActionCase/GD03-040/linked_grant_high_maneuver_skip_blocker_hand_age",
  "ActionCase/GD03-041/deploy_damage_all_bases_3_single",
  "ActionCase/GD03-042/allow_attack_target_active_enemy_le_5_if_ap_ge_5",
  "ActionCase/GD03-042/allow_attack_target_active_enemy_le_5_if_ap_higher",
  "ActionCase/GD03-043/pair_damage_1_choose_enemy_unit",
  "ActionCase/GD03-043/pair_damage_1_choose_enemy_unit_multiple",
  "ActionCase/GD03-049/shield_damage_destroy_lowest_hp_if_cb_trash_ge_10",
  "ActionCase/GD03-054/pair_exile_4_vagan_then_destroy_enemy_le_4",
  "ActionCase/GD03-060/effect_damage_received_deploy_rested_token_once_per_turn",
  "ActionCase/GD03-061/repair_3_when_hp_eq_1_end_phase",
  "ActionCase/GD03-070/prevent_shield_battle_damage_while_rested_base",
  "ActionCase/GD03-079/replace_rest_base_with_rest_this_unit",
  "ActionCase/GD03-088/during_link_age_system_ap_plus_1_breach_1",
  "ActionCase/GD03-106/play_full_board_from_capture_multi_effect_order",
  "ActionCase/GD03-109/play_full_board_from_capture_multi_effect_order",
  "ActionCase/GD03-114/play_full_board_from_capture_multi_effect_order",
  "ActionCase/GD03-120/delayed_set_active_then_cannot_attack_multiple",
  "ActionCase/ST03-008/attack_ap_plus_2_auto_target_source",
  "ActionCase/ST03-010/deploy_from_hand_deploy_st03_005",
  "ActionCase/ST03-011/attack_ap_and_keyword_auto_target_paired_unit",
  "ActionCase/ST04-001/pair_bounce_enemy_unit_hp_le_4_if_pilot_level_ge_4",
  "ActionCase/ST04-002/deploy_draw_then_discard",
  "ActionCase/ST04-009/destroyed_draw_if_another_link_unit",
  "ActionCase/ST04-009/pair_draw_if_another_link_unit",
  "ActionCase/ST04-012/burst_deploy_aile_token_if_none",
  "ActionCase/ST04-012/choose_one_then_deploy_token_option_a",
  "ActionCase/ST05-001/deploy_damage_other_then_ap_plus_1_on_same_unit",
  "ActionCase/ST05-001/suppression_damaged_unit_attacks_two_shields_multiple_burst",
  "ActionCase/ST05-001/suppression_damaged_unit_attacks_two_shields_no_damage",
  "ActionCase/ST05-001/suppression_damaged_unit_attacks_two_shields_single_burst",
  "ActionCase/ST05-001/suppression_damaged_unit_attacks_two_shields",

  "ActionCase/ST05-010/deploy_damage_other_then_ap_plus_1_multiple_unit",
  "ActionCase/ST06-001/grant_first_strike_linked",
  "ActionCase/ST06-002/deploy_damage_enemy_1_if_clan_ge_2",
  "ActionCase/ST06-003/activate_support_1_rest_self_choose_other_unit_ap_plus_1",
  "ActionCase/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2",
  "ActionCase/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2_destroy",
  "ActionCase/ST06-009/grant_first_strike_linked_noclan",
  "ActionCase/ST06-009/grant_first_strike_linked_noclan_card",
  "ActionCase/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2",
  "ActionCase/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2_destroy",
  "ActionCase/ST06-013/action_prevent_battle_damage_from_enemy_units_le_2_for_clan",
  "ActionCase/ST06-014/activate_restSelf_ap_plus_2_if_clan_link_unit",
  "ActionCase/ST07-001/end_of_turn_set_active_resource_if_cb_trash_ge_7",
  "ActionCase/ST07-001/pair_mill2_draw_if_cb",
  "ActionCase/ST07-004/blocker_if_cb_pilot_in_play",
  "ActionCase/ST07-005/battle_destroy_heal_2_on_your_turn3",
  "ActionCase/ST07-009/attack_branch_paired_unit_ap_plus_1_if_cb_trash_lt_7",
  "ActionCase/ST07-010/destroyed_draw_1_on_opponent_turn_if_paired_cb_unit",
  "ActionCase/ST07-015/prevent_damage_base_if_rested_cb_unit_in_play_lv3",
  "ActionCase/ST08-001/costing_level6_onfield",
  "ActionCase/ST08-001/pair_damage_highest_level_enemy_3",
  "ActionCase/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2_notarget",
  "ActionCase/ST08-011/effect_draw_grant_high_maneuver_if_paired_blue_unit",
  "ActionCase/ST08-011/effect_draw_grant_high_maneuver_if_paired_unit_blue",
  "ActionCase/T-014/restrictions_cannot_set_active_or_pair",
] as const;

export class DebugControls {
  private popup?: TestButtonPopup;
  private api = new ApiManager();
  private pollEvent?: Phaser.Time.TimerEvent;
  private readonly pollDelayMs = 1000;
  private readonly shouldDeferPolling?: () => boolean;
  private deferredPollPending = false;
  private deferredPollLogged = false;
  private pollInFlight = false;
  private scenarioResourceFallbackEnabled = false;
  private selectedScenarioPath = DEFAULT_SCENARIO_PATH;

  constructor(
    private scene: Phaser.Scene,
    private match: MatchStateMachine,
    private engine: GameEngine,
    private context: GameContext,
    opts?: { shouldDeferPolling?: () => boolean },
  ) {
    this.shouldDeferPolling = opts?.shouldDeferPolling;
    if (typeof window !== "undefined") {
      const stored = window.localStorage?.getItem("debug.selectedScenarioPath");
      if (stored) this.selectedScenarioPath = stored;
    }
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
      scenarioPicker: {
        title: "Scenario presets",
        options: [...SCENARIO_PRESETS],
        value: this.selectedScenarioPath,
        onChange: (value) => {
          this.selectedScenarioPath = value;
          if (typeof window !== "undefined") {
            window.localStorage?.setItem("debug.selectedScenarioPath", value);
          }
        },
      },
      gameId: this.context.gameId ?? undefined,
      joinToken: this.context.joinToken ?? undefined,
      isAutoPolling: true,
    };
    this.popup.show(config);
  }

  // Public helpers for external triggers (uiTestSpec): allow triggering scenarios/polling without clicking UI.
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

  private async handleSetScenario(scenarioPath?: string, opts?: { hidePopup?: boolean }) {
    if (opts?.hidePopup !== false) {
      await this.popup?.hide();
    }
    const targetScenario = scenarioPath || this.selectedScenarioPath || DEFAULT_SCENARIO_PATH;
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
      const playerSelector: ScenarioPlayerSelector = this.context.playerSelector || "currentPlayer";

      //alert(gameId)
      const injectResp = await this.api.injectGameState(gameId, gameEnv, playerSelector);
      const desiredPlayerId =
        (typeof injectResp?.resolvedPlayerId === "string" && injectResp.resolvedPlayerId) ||
        resolveScenarioPlayerId(gameEnv, playerSelector, this.context.playerId);
      const matchingSession = Array.isArray(injectResp?.testSessions)
        ? injectResp.testSessions.find((entry: any) => entry?.playerId === desiredPlayerId)
        : null;

      this.context.gameId = gameId;
      this.context.playerId = desiredPlayerId;
      this.scenarioResourceFallbackEnabled = true;
      this.engine.setAllowEnvScanFallbackDefault(true);

      if (matchingSession?.sessionToken) {
        updateSession({
          gameId,
          playerId: desiredPlayerId,
          sessionToken: matchingSession.sessionToken,
          sessionExpiresAt: matchingSession.sessionExpiresAt ?? null,
        });
      }

      await this.engine.updateGameStatus(gameId, this.context.playerId, {
        fromScenario: false,
        silent: true,
        allowEnvScanFallback: true,
      });
      await this.engine.loadGameResources(gameId, this.context.playerId, undefined, { allowEnvScanFallback: true });
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
      if (this.pollInFlight) return;
      if (this.shouldDeferPolling?.()) {
        this.deferredPollPending = true;
        if (!this.deferredPollLogged) {
          this.deferredPollLogged = true;
        }
        return;
      }
      this.pollInFlight = true;
      const snapshot = await this.engine.updateGameStatus(this.context.gameId ?? undefined, this.context.playerId, {
        silent: silentRefresh,
        fromScenario: false,
        allowEnvScanFallback: this.scenarioResourceFallbackEnabled,
      });
      if (snapshot) {
        this.context.lastStatus = snapshot.status ?? this.context.lastStatus;
      }
    } catch (err) {
      void err;
    } finally {
      this.pollInFlight = false;
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
      await this.match.joinRoom(id);
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
