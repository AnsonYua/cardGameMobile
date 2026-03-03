import Phaser from "phaser";
import { MatchStateMachine } from "../game/MatchStateMachine";
import { GameEngine } from "../game/GameEngine";
import type { TestButtonPopupConfig } from "../ui/TestButtonPopup";
import { TestButtonPopup } from "../ui/TestButtonPopup";
import type { GameContext } from "../game/GameContextStore";
import { ApiManager } from "../api/ApiManager";
import { updateSession } from "../game/SessionStore";
import { resolveScenarioPlayerId, type ScenarioPlayerSelector } from "../game/SeatSelector";

const DEFAULT_SCENARIO_PATH = "GD01/GD01-118/draw2_dis1";
const SCENARIO_PRESET_GROUPS = {
  exception: [
    "exception/noActionButton",
    "exception/destoryed_when_attack",
  ],
  BasicCase: [
    "BasicCase/basicMainBaseBurstBase",
    "BasicCase/basicMainBaseBurstCharacter",
  ],
  GD01: [
    "GD01/GD01-001/continuous_grant_repair_1_to_white_base_team_units",
    "GD01/GD01-001/pair_draw_if_units_in_play_ge_3",
    "GD01/GD01-001/repair_no_damage_no_heal",
    "GD01/GD01-002/play_from_hand_destroy_unicorn_mode_lv5_play_as_lv0_cost0",
    "GD01/GD01-002/play_from_hand_destroy_unicorn_mode_lv5_play_as_lv0_cost0_full",
    "GD01/GD01-003/attack_link_move_12_from_trash_shuffle_set_active_first_strike",
    "GD01/GD01-004/when_paired_choose_1_of_2_enemy_units_hp_le_2_rest",
    "GD01/GD01-004/when_paired_choose_enemy_unit_current_hp_le_2_rest",
    "GD01/GD01-004/when_paired_choose_enemy_unit_hp_le_2_rest",
    "GD01/GD01-004/when_paired_choose_enemy_unit_hp_le_2_rest_filter_boundary",
    "GD01/GD01-004/when_paired_choose_enemy_unit_hp_le_2_rest_manual_flow",
    "GD01/GD01-004/when_paired_choose_enemy_unit_hp_le_2_rest_manual_validation",
    "GD01/GD01-005/destroyed_linked_return_pilot_then_discard",
    "GD01/GD01-006/during_link_hp_plus_1_manual_link_check",
    "GD01/GD01-006/during_link_hp_plus_1_survive_ap3_battle",
    "GD01/GD01-007/destroyed_draw_1_if_another_oz_unit_in_play",
    "GD01/GD01-007/destroyed_draw_1_if_another_oz_unit_in_play_manual_battle",
    "GD01/GD01-008/deploy_choose_rested_enemy_unit_deal_1_damage",
    "GD01/GD01-008/deploy_choose_rested_enemy_unit_deal_1_damage_manual_flow",
    "GD01/GD01-009/deploy_choose_white_base_team_unit_grant_high_maneuver",
    "GD01/GD01-010/when_paired_choose_enemy_unit_hp_le_3_rest",
    "GD01/GD01-010/when_paired_choose_enemy_unit_hp_le_3_rest_manual_flow",
    "GD01/GD01-012/when_paired_choose_enemy_unit_hp_le_3_rest",
    "GD01/GD01-012/when_paired_choose_enemy_unit_hp_le_3_rest_manual_flow",
    "GD01/GD01-014/during_link_activate_action_once_per_turn_choose_1_unit_recover_1_hp",
    "GD01/GD01-015/attack_choose_friendly_unit_recover_1_hp",
    "GD01/GD01-016/hand_cost_reduction_1_if_earth_federation_units_ge_2",
    "GD01/GD01-019/gain_blocker_if_enemy_units_ge_4",
    "GD01/GD01-020/deploy_choose_rested_enemy_unit_deal_1_damage",
    "GD01/GD01-023/activate_discard_zeon_unit_then_pair_newtype_pilot_from_trash",
    "GD01/GD01-024/high_maneuver_unblockable_then_deploy_damage_all_lv5_or_lower",
    "GD01/GD01-025/pair_place_rested_resource_then_first_strike",
    "GD01/GD01-026/during_pair_destroyed_deploy_rested_chars_zaku_ii_token",
    "GD01/GD01-027/deploy_blocker_aoe_with_10_zeon_trash_then_breach4_on_destroy",
    "GD01/GD01-027/deploy_if_zeon_trash_ge_10_damage_all_blockers_then_breach4_on_battle_destroy_manual_flow",
    "GD01/GD01-028/deploy_optional_maganac_from_hand_manual_flow",
    "GD01/GD01-029/attack_destroy_lv3_blocker_then_breach4_on_battle_destroy",
    "GD01/GD01-029/attack_manual_flow_blocker_choice_then_breach4_on_destroy",
    "GD01/GD01-030/attack_destroy_enemy_unit_then_breach2_hits_first_shield",
    "GD01/GD01-030/attack_manual_flow_destroy_enemy_unit_then_breach2_hits_first_shield",
    "GD01/GD01-032/when_paired_zeon_pilot_destroy_enemy_blocker_level2_or_lower_manual_flow",
    "GD01/GD01-034/during_pair_battle_destroy_triggers_breach3_hits_first_shield",
    "GD01/GD01-038/deploy_if_enemy_units_ge_5_damage_all_enemy_units",
    "GD01/GD01-038/deploy_if_enemy_units_ge_5_damage_all_enemy_units_manual_flow",
    "GD01/GD01-039/deploy_scry_top_1_choose_bottom",
    "GD01/GD01-039/deploy_scry_top_1_choose_top",
    "GD01/GD01-041/attack_destroy_enemy_unit_then_breach3_hits_first_shield",
    "GD01/GD01-041/attack_manual_flow_destroy_enemy_unit_then_breach3_hits_first_shield",
    "GD01/GD01-042/attack_target_active_enemy_unit_level_2_or_lower_active_gate_manual_flow",
    "GD01/GD01-042/attack_target_active_enemy_unit_level_2_or_lower_manual_flow",
    "GD01/GD01-044/pair_damage_1_choose_1_to_2_enemy_units",
    "GD01/GD01-047/attack_if_two_other_rested_choose_enemy_damage_3",
    "GD01/GD01-048/deploy_tutor_top_choose_bottom",
    "GD01/GD01-048/deploy_tutor_top_take_zeon_unit",
    "GD01/GD01-049/deploy_choose_zaft_ap_ge_5_grant_first_strike_manual_battle_flow",
    "GD01/GD01-050/attack_ap_ge_5_choose_enemy_damage_2",
    "GD01/GD01-052/deploy_choose_enemy_unit_deal_1_damage_manual_flow",
    "GD01/GD01-053/activate_main_once_per_turn_choose_enemy_unit_ap_le_2_deal_1_damage",
    "GD01/GD01-054/attack_manual_flow_ap5_gains_breach3_then_hits_first_shield",
    "GD01/GD01-055/activate_support_2_rest_self_choose_other_friendly_unit_ap_plus_2",
    "GD01/GD01-056/destroyed_choose_enemy_unit_ap_le_5_deal_1_damage_manual_battle",
    "GD01/GD01-058/activate_action_choose_lv4_or_higher_unit_ap_plus_1_until_end_of_battle",
    "GD01/GD01-059/attack_ap_plus_2_auto_target_source",
    "GD01/GD01-061/activate_support_1_rest_self_choose_other_friendly_unit_ap_plus_1",
    "GD01/GD01-063/first_strike_vs_battle_opponent_level_le_2",
    "GD01/GD01-065/during_pair_once_per_turn_pair_white_unit_choose_enemy_ap_minus_2_manual_flow",
    "GD01/GD01-066/justicetoken",
    "GD01/GD01-067/when_paired_add_command_from_trash_level_5_or_lower_manual_flow",
    "GD01/GD01-068/deploy_choose_enemy_unit_current_hp_eq_1_return_to_owner_hand_manual_flow",
    "GD01/GD01-069/activate_set_active_blocker_then_restrict_attack",
    "GD01/GD01-070/hand_cost_reduction_2_if_trash_command_cards_ge_4",
    "GD01/GD01-071/during_link_attack_choose_enemy_unit_ap_minus_2_during_battle_manual_flow",
    "GD01/GD01-073/during_link_attack_choose_enemy_unit_hp_le_2_return_to_hand_manual_flow",
    "GD01/GD01-074/attack_draw_1_then_discard_1_manual_flow",
    "GD01/GD01-075/deploy_choose_enemy_unit_current_hp_eq_1_return_to_owner_hand_manual_flow",
    "GD01/GD01-076/continuous_ap_hp_plus_1_if_trash_command_cards_ge_4_manual_battle",
    "GD01/GD01-078/deploy_choose_enemy_unit_ap_minus_1_until_end_of_turn_manual_flow",
    "GD01/GD01-080/destroyed_choose_enemy_unit_level_2_or_lower_return_to_owner_hand_manual_battle",
    "GD01/GD01-081/continuous_ap_plus_1_and_gain_blocker_if_another_tsa_unit_manual_flow",
    "GD01/GD01-082/during_pair_activate_action_once_per_turn_choose_enemy_unit_ap_minus_1_during_battle_manual_flow",
    "GD01/GD01-087/burst_add_to_hand_then_pair_blue_unit_gain_repair_1_end_turn",
    "GD01/GD01-088/burst_add_to_hand_then_when_linked_draw_1_manual_flow",
    "GD01/GD01-089/burst_add_to_hand_then_pair_repair_unit_gain_ap_plus_1_manual_flow",
    "GD01/GD01-090/burst_add_to_hand_then_link_prevent_enemy_ap_reduction_manual_flow",
    "GD01/GD01-091/burst_add_to_hand_then_with_breach_prevent_enemy_ap3_or_less_battle_damage_on_your_turn_manual_flow",
    "GD01/GD01-092/burst_add_to_hand_then_pair_zeon_gain_breach_1_and_trigger_breach_damage_manual_flow",
    "GD01/GD01-093/burst_add_to_hand_then_during_link_attack_choose_enemy_unit_level_le_source_deal_1_damage_manual_flow",
    "GD01/GD01-094/burst_add_to_hand_then_once_per_turn_draw_when_destroy_enemy_link_unit_while_attacking_manual_flow",
    "GD01/GD01-095/burst_add_to_hand_then_when_linked_discard_1_if_you_do_draw_1_manual_flow",
    "GD01/GD01-096/burst_add_to_hand_then_pair_white_unit_gain_blocker_and_redirect_attack_manual_flow",
    "GD01/GD01-097/activate_set_active_then_restrict_attack_if_opponent_hand_ge_8",
    "GD01/GD01-098/burst_add_to_hand_then_activate_action_once_per_turn_heal_if_enemy_ap_le_1_manual_flow",
    "GD01/GD01-099/burst_rest_hp5_then_main_action_rest_1_to_2_enemy_units_hp3_or_less_manual_flow",
    "GD01/GD01-100/main_draw_2",
    "GD01/GD01-101/main_action_heal_3_friendly_link_unit_lucrezia_designation",
    "GD01/GD01-102/main_heal_all_friendly_units_level_4_or_lower",
    "GD01/GD01-103/main_rest_friendly_earth_federation_and_enemy_then_play_as_daguza_pilot_manual_flow",
    "GD01/GD01-104/burst_draw_1_then_main_choose_rested_enemy_unit_deal_2_manual_flow",
    "GD01/GD01-105/burst_add_to_hand_then_main_all_units_ap_plus_2_manual_flow",
    "GD01/GD01-106/main_deploy_2_zaku_ii_tokens_then_play_as_dozle_zabi_pilot_manual_flow",
    "GD01/GD01-107/burst_place_ex_resource",
    "GD01/GD01-107/main_place_rested_resource",
    "GD01/GD01-108/main_damage_all_blockers_2",
    "GD01/GD01-109/main_tutor_top5_choose_operation_meteor_or_g_team_to_hand",
    "GD01/GD01-110/main_action_allow_attack_target_active_enemy_ap_le_6_and_rasid_pilot_manual_flow",
    "GD01/GD01-111/main_action_damage_damaged_enemy_then_burst_damage_enemy_manual_flow",
    "GD01/GD01-112/main_rest_two_active_units_then_damage_enemy_and_play_as_loni_pilot_manual_flow",
    "GD01/GD01-113/main_action_choose_friendly_zaft_unit_ap_plus_3_then_play_as_andrew_waldfeld_pilot_manual_flow",
    "GD01/GD01-114/action_choose_2_friendly_units_ap_plus_1_then_play_as_yonem_kirks_pilot_manual_flow",
    "GD01/GD01-115/main_action_damage_enemy_unit_main_and_action_step_manual_flow",
    "GD01/GD01-116/main_action_damage_enemy_unit_ap_le_2_and_play_as_nicol_amarfi_pilot_manual_flow",
    "GD01/GD01-117/burst_activate_main_return_enemy_unit_hp_le_5_manual_flow",
    "GD01/GD01-118/draw2_dis1",
    "GD01/GD01-119/main_action_choose_enemy_unit_level_le_4_ap_minus_2_and_play_as_chuatury_panlunch_pilot_manual_flow",
    "GD01/GD01-120/burst_ap_minus_3_and_action_ap_plus_3_to_friendly_blocker_manual_flow",
    "GD01/GD01-121/burst_activate_main_set_active_rested_blocker_cannot_attack_manual_flow",
    "GD01/GD01-122/main_return_enemy_hp_le_4_if_link_unit_in_play_and_shaddiq_pilot_manual_flow",
    "GD01/GD01-123/deploy_add_shield_then_rest_enemy_hp_le_3",
    "GD01/GD01-123/deploy_add_shield_then_rest_enemy_hp_le_3_no_target",
    "GD01/GD01-124/activate_main_rest_base_choose_friendly_unit_recover_1_hp",
    "GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy",
    "GD01/GD01-125/your_turn_deploy",
  ],
  GD02: [
    "GD02/GD02-001/paired_titans_shield_area_battle_damage_heal_2",
    "GD02/GD02-001/paired_titans_shield_area_battle_damage_heal_2_base",
    "GD02/GD02-002/link_once_per_turn_set_active_on_friendly_battle_destroy",
    "GD02/GD02-002/link_once_per_turn_set_active_on_friendly_battle_destroy_nopilot",
    "GD02/GD02-003/destroyed_pair_lv3_or_lower_discard_unit_return_paired_pilot_to_hand_manual_battle",
    "GD02/GD02-004/pair_prevent_set_active_next_turn_rested_enemy_hp_le_3_manual_flow",
    "GD02/GD02-005/during_link_attack_choose_enemy_unit_hp_le_2_rest_manual_flow",
    "GD02/GD02-006/during_your_turn_prevent_battle_damage_from_enemy_lv2_or_lower_manual_flow",
    "GD02/GD02-007/repair_2_end_of_turn",
    "GD02/GD02-008/when_linked_choose_rested_enemy_unit_deal_1_damage_manual_flow.json",
    "GD02/GD02-009/ap_reduced_by_enemy_effect_retaliate_damage_2",
    "GD02/GD02-010/effect_damage_received_enemy_draw_once_per_turn",
    "GD02/GD02-011/action_step_destroy_self_deal_6_to_enemy_base_manual_flow.json",
    "GD02/GD02-011/action_step_destroy_self_deal_6_to_enemy_base_manual_flow_no_shield",
    "GD02/GD02-014/deploy_choose_titans_unit_ap_plus_1_during_turn_manual_flow.json",
    "GD02/GD02-016/deploy_choose_titans_unit_ap_plus_1_during_turn_manual_flow.json",
    "GD02/GD02-017/repair_2_end_of_turn_manual_flow.json",
    "GD02/GD02-018/cannot_choose_enemy_player_as_attack_target_manual_flow.json",
    "GD02/GD02-018/cannot_choose_enemy_player_as_attack_target_manual_flow_rested",
    "GD02/GD02-020/deploy_tutor_green_zeon_pilot_top5_then_link_ap_plus2_manual_flow.json",
    "GD02/GD02-021/deploy_optional_discard_green_earth_federation_unit_place_ex_resource_then_draw_if_level_ge_7_manual_flow.json",
    "GD02/GD02-022/gain_breach_2_on_ex_resource_once_per_turn",
    "GD02/GD02-023/link_first_strike_if_player_level_ge_7",
    "GD02/GD02-023/link_no_first_strike_if_player_level_lt_7",
    "GD02/GD02-024/during_link_gain_high_maneuver_skip_blocker_manual_flow.json",
    "GD02/GD02-025/deploy_scry_top_1_choose_bottom_manual_flow.json",
    "GD02/GD02-026/deploy_if_level_7_choose_age_system_unit_ap_plus_2_manual_flow.json",
    "GD02/GD02-027/attack_manual_flow_destroy_enemy_unit_then_breach3_hits_first_shield.json",
    "GD02/GD02-031/continuous_ap_plus_2_if_player_level_ge_7_less",
    "GD02/GD02-031/continuous_ap_plus_2_if_player_level_ge_7_more",
    "GD02/GD02-033/gain_breach_5_if_another_zeon_link",
    "GD02/GD02-034/pair_ap_boost_if_paired_red_pilot",
    "GD02/GD02-035/cannot_choose_enemy_player_as_attack_target_manual_flow.json",
    "GD02/GD02-036/when_linked_gain_suppression_and_pair_neo_zeon_attack_damage_damaged_enemy_manual_flow.json",
    "GD02/GD02-037/deploy_if_enemy_shields_le_3_damage_then_attack_destroy_triggers_breach1_manual_flow.json",
    "GD02/GD02-038/deploy_scry_top3_may_deploy_clan_unit_lv4_or_lower_manual_flow.json",
    "GD02/GD02-039/when_paired_choose_enemy_unit_level_3_or_lower_deal_1_damage_manual_flow.json",
    "GD02/GD02-040/deploy_prevent_hp_le_2_battle_damage_and_activate_support_2_manual_flow.json",
    "GD02/GD02-041/deploy_choose_enemy_unit_level_5_or_higher_deal_2_damage_manual_flow.json",
    "GD02/GD02-042/deploy_choose_new_une_unit_grant_high_maneuver_manual_flow.json",
    "GD02/GD02-043/deploy_if_another_new_une_unit_in_play_deploy_rested_daughtress_token_manual_flow.json",
    "GD02/GD02-044/destroyed_if_another_new_une_unit_in_play_deploy_rested_daughtress_token_manual_battle.json",
    "GD02/GD02-045/attack_ap_ge_5_attack_unit_draw_1_manual_flow.json",
    "GD02/GD02-046/deploy_choose_enemy_unit_token_deal_2_damage_manual_flow.json",
    "GD02/GD02-047/activate_main_rest_self_destroy_choose_enemy_unit_level_5_or_lower_deal_1_damage_manual_flow.json",
    "GD02/GD02-049/activate_support_1_rest_self_choose_other_friendly_unit_ap_plus_1_manual_flow.json",
    "GD02/GD02-054/attack_cost_destroy_friendly_then_damage_2_to_enemy_le_4",
    "GD02/GD02-055/deploy_choose_friendly_and_enemy_unit_deal_1_damage_manual_flow.json",
    "GD02/GD02-056/destroyed_during_pair_vulture_pilot_add_lv5plus_vulture_from_trash_to_hand_manual_battle.json",
    "GD02/GD02-057/attack_cost_destroy_friendly_then_damage_2_to_enemy_le_4",
    "GD02/GD02-058/deploy_draw1_dis1",
    "GD02/GD02-060/deploy_if_trash_ge_7_rest_enemy_unit_level_4_or_lower_manual_flow.json",
    "GD02/GD02-061/pair_rest_enemy_ap_le_3_if_trash_teiwaz_or_tekkadan_ge_3",
    "GD02/GD02-064/during_your_turn_trash_ge_7_prevent_effect_damage_from_enemy_commands_manual_flow.json",
    "GD02/GD02-066/cannot_choose_enemy_player_as_attack_target_manual_flow.json",
    "GD02/GD02-068/deploy_self_damage_2_manual_flow.json",
    "GD02/GD02-069/linked_activate_main_rest_base_set_self_active_and_restrict_player_attack_manual_flow.json",
    "GD02/GD02-070/deploy_draw2_dis2_if_trash_4_gjallarhorn",
    "GD02/GD02-071/deploy_if_friendly_white_base_optional_pair_aeug_pilot_from_hand_manual_flow.json",
    "GD02/GD02-072/while_friendly_white_base_in_play_gain_repair_1_end_turn_manual_flow.json",
    "GD02/GD02-073/opponent_turn_grant_first_strike_to_battling_enemy",
    "GD02/GD02-074/paired_trash4_command_gain_blocker_and_high_maneuver_skip_blocker_manual_flow.json",
    "GD02/GD02-076/ap5_gain_blocker_redirect_attack_target_manual_flow.json",
    "GD02/GD02-076/ap5_gain_blocker_redirect_attack_target_manual_flow_ap5",
    "GD02/GD02-081/deploy_if_friendly_white_base_choose_enemy_unit_ap_minus_2_during_turn_manual_flow.json",
    "GD02/GD02-082/while_another_gjallarhorn_in_play_gain_blocker_redirect_attack_target_manual_flow.json",
    "GD02/GD02-083/destroyed_opponent_turn_choose_friendly_gjallarhorn_set_active_manual_battle.json",
    "GD02/GD02-085/burst_add_to_hand_then_during_link_once_per_turn_draw_on_self_heal_if_hand_le_4_manual_flow.json",
    "GD02/GD02-086/burst_add_to_hand_then_pair_ap_plus_1_with_another_titans_unit_manual_flow.json",
    "GD02/GD02-087/burst_add_to_hand_then_when_linked_rest_enemy_blocker_if_blue_unit_manual_flow.json",
    "GD02/GD02-088/burst_add_to_hand_then_when_linked_tutor_top3_green_ef_unit_or_age_device_manual_flow.json",
    "GD02/GD02-089/pair_choose_other_zeon_link_unit_grant_breach_1",
    "GD02/GD02-090/burst_add_to_hand_then_pair_ap_plus_1_with_another_high_maneuver_unit_manual_flow.json",
    "GD02/GD02-091/burst_add_to_hand_then_pair_if_red_choose_enemy_unit_level_le_source_deal_1_damage_manual_flow.json",
    "GD02/GD02-092/burst_add_to_hand_then_during_link_attack_choose_new_une_unit_ap_plus_2_manual_flow.json",
    "GD02/GD02-093/burst_add_to_hand_then_battle_destroy_enemy_newtype_paired_unit_draw_1_manual_flow.json",
    "GD02/GD02-094/burst_add_to_hand_then_when_paired_discard_1_tutor_top3_vulture_unit_manual_flow.json",
    "GD02/GD02-095/attack_damaged_le_5_grant_high_maneuver_skip_blocker",
    "GD02/GD02-096/burst_add_to_hand_then_when_linked_optional_deploy_vagan_unit_level_le_2_from_trash_pay_cost_manual_flow.json",
    "GD02/GD02-097/burst_add_to_hand_then_while_friendly_white_base_source_paired_unit_ap_plus_2_manual_flow.json",
    "GD02/GD02-098/pair_draw1_dis1_if_aeug",
    "GD02/GD02-099/burst_add_to_hand_then_when_paired_if_trash_4_gjallarhorn_choose_enemy_unit_ap_minus_2_manual_flow.json",
    "GD02/GD02-100/burst_draw_1_then_main_heal_damaged_friendly_unit_recover_2_then_draw_1_manual_flow.json",
    "GD02/GD02-101/main_action_choose_1_to_2_enemy_units_level_2_or_lower_rest_manual_flow.json",
    "GD02/GD02-102/main_action_choose_friendly_titans_unit_ap_plus_2_then_play_as_mouar_pharaoh_pilot_manual_flow.json",
    "GD02/GD02-103/burst_choose_asuno_pilot_from_trash_then_main_place_ex_resource_if_age_system_manual_flow.json",
    "GD02/GD02-103/burst_choose_asuno_pilot_from_trash_then_main_place_ex_resource_if_age_system_manual_flow_burst",
    "GD02/GD02-104/main_scry_top3_return1_top_rest_bottom_then_draw1_if_newtype_pilot_in_play_manual_flow.json",
    "GD02/GD02-105/action_prevent_battle_damage_on_friendly_token_then_play_as_xavier_olivette_pilot_manual_flow.json",
    "GD02/GD02-106/action_prevent_shield_battle_damage_from_enemy_lv3_or_lower_then_play_as_woolf_enneacle_pilot_manual_flow.json",
    "GD02/GD02-106/action_prevent_shield_battle_damage_from_enemy_lv3_or_lower_then_play_as_woolf_enneacle_pilot_manual_flow_base",
    "GD02/GD02-107/main_damage_non_link_units_then_burst_choose_enemy_unit_manual_flow.json",
    "GD02/GD02-108/main_choose_friendly_clan_unit_allow_attack_active_enemy_level_4_or_lower_manual_flow.json",
    "GD02/GD02-109/main_action_choose_enemy_unit_deal_1_then_play_as_shiiko_sugai_pilot_manual_flow.json",
    "GD02/GD02-110/main_choose_unit_level_5_or_lower_from_trash_pay_cost_deploy_manual_flow.json",
    "GD02/GD02-111/burst_lv3_or_lower_damage2_then_main_exile6_purple_units_destroy_enemy_manual_flow.json",
    "GD02/GD02-112/burst_draw_1_then_main_add_purple_pilot_from_trash_to_hand_manual_flow.json",
    "GD02/GD02-113/main_action_if_friendly_teiwaz_link_unit_destroy_enemy_ap_le_2_then_play_as_amida_arca_pilot_manual_flow.json",
    "GD02/GD02-114/main_action_choose_damaged_friendly_unit_ap_plus_2_then_play_as_norba_shino_pilot_manual_flow.json",
    "GD02/GD02-115/main_action_choose_friendly_vulture_unit_ap_plus_2_then_play_as_witz_sou_pilot_manual_flow.json",
    "GD02/GD02-116/main_if_trash_ge_7_choose_friendly_vulture_allow_attack_active_enemy_level_4_or_lower_then_play_as_roybea_loy_pilot_manual_flow.json",
    "GD02/GD02-117/draw3_dis2",
    "GD02/GD02-118/action_choose_enemy_hp4_or_less_battling_friendly_blocker_return_to_hand_then_play_as_ein_dalton_manual_flow.json",
    "GD02/GD02-119/action_if_friendly_gjallarhorn_link_unit_in_play_choose_enemy_unit_ap_minus_3_during_battle_then_play_as_carta_issue_manual_flow.json",
    "GD02/GD02-120/action_heal_aeug_unit_or_base",
    "GD02/GD02-121/burst_deploy_add_shield_then_heal_friendly_blue_unit_manual_flow.json",
    "GD02/GD02-122/burst_deploy_add_shield_then_damage_rested_enemy_unit_level_4_or_lower_manual_flow.json",
    "GD02/GD02-123/deploy_add_shield_then_choose_friendly_token_allow_attack_active_enemy_ap_5_or_lower_manual_flow.json",
    "GD02/GD02-124/deploy_add_shield_then_lv7_friendly_green_earth_federation_units_get_ap_plus_1_manual_flow.json",
    "GD02/GD02-125/deploy_add_shield_then_your_turn_optional_discard_red_if_do_draw_1_manual_flow.json",
    "GD02/GD02-126/destroyed_choose_enemy_unit_level_4_or_lower_deal_1_damage_manual_flow.json",
    "GD02/GD02-127/destroyed_mill_top_2_cards_from_own_deck_manual_flow.json",
    "GD02/GD02-128/deploy_add_shield_then_if_your_turn_and_teiwaz_link_destroy_enemy_ap_le_2_manual_flow.json",
    "GD02/GD02-129/deploy_add_shield_then_prevent_enemy_effect_damage_to_this_base_manual_flow.json",
    "GD02/GD02-129/deploy_add_shield_then_prevent_enemy_effect_damage_to_this_base_manual_flow_breach",
    "GD02/GD02-130/deploy_add_shield_then_if_friendly_gjallarhorn_unit_in_play_choose_enemy_unit_ap_minus_2_during_turn_manual_flow.json",
    "GD02/GD02-130/deploy_add_shield_then_if_friendly_gjallarhorn_unit_in_play_choose_enemy_unit_ap_minus_2_during_turn_manual_flow_no_gjall"
  ],
  GD03: [
    "GD03/GD03-001/pair_damage_rested_destroy_draw_1",
    "GD03/GD03-002/during_pair_repair_unit_attack_rest_enemy",
    "GD03/GD03-002/during_pair_repair_unit_attack_rest_enemy_2",
    "GD03/GD03-004/attack_if_two_other_titans_rest_enemy_le_5hp",
    "GD03/GD03-006/deploy_rest_1_to_2_enemy_hp_le_3",
    "GD03/GD03-007/destroyed_choose_enemy_le3hp_rest",
    "GD03/GD03-008/during_pair_grant_repair_2_then_end_phase_heal",
    "GD03/GD03-009/deploy_exile_2_titans_rest_enemy_lv_le_4",
    "GD03/GD03-013/continuous_jupitris_plus_support1_zaft_trigger",
    "GD03/GD03-014/continuous_cost_reduce_1_if_titans_ge_2_negative",
    "GD03/GD03-014/continuous_cost_reduce_1_if_titans_ge_2_positive",
    "GD03/GD03-015/activate_exile_3_titans_then_grant_breach_4",
    "GD03/GD03-015/activate_exile_3_titans_then_grant_breach_4_multiple",
    "GD03/GD03-017/burst_add_1_cyclops_pilot_from_trash_exactly_1",
    "GD03/GD03-017/burst_add_1_cyclops_pilot_from_trash_multiple",
    "GD03/GD03-017/paired_cyclops_allow_attack_target_ap_le_5_negative",
    "GD03/GD03-017/paired_cyclops_allow_attack_target_ap_le_5_positive",
    "GD03/GD03-019/force_attack_target_if_rested_paired",
    "GD03/GD03-020/pair_deploy_2_ad_balloon_if_cyclops_trash_ge_4",
    "GD03/GD03-020/prevent_enemy_unit_battle_damage_while_ad_balloon_in_play",
    "GD03/GD03-021/attack_rested_high_ap_unit_destroyed_in_battle",
    "GD03/GD03-021/deploy_grant_attack_target_ability",
    "GD03/GD03-022/during_link_aoe_damage_on_enemy_units_level_3_or_lower",
    "GD03/GD03-024/when_linked_deploy_hy_gogg_token_if_cyclops_ge_2",
    "GD03/GD03-023/ex_resource_grant_high_maneuver_to_age_system_unit_then_skip_blocker",
    "GD03/GD03-025/force_attack_target_rested_maganac_choice",
    "GD03/GD03-028/attack_if_target_unit_ap_plus_2_auto_target_source",
    "GD03/GD03-029/during_your_turn_battle_destroy_deal_2_to_enemy_blockers",
    "GD03/GD03-030/hand_cost_reduction_1_if_cb_link_unit_in_play_positive",
    "GD03/GD03-034/deploy_damage_3_unit_and_suppression_damage_2_shields",
    "GD03/GD03-033/attack_ap_9_deal_2_damage",
    "GD03/GD03-033/attack_base_ap_5_deal_1_damage",
    "GD03/GD03-033/attack_paired_ap_7_deal_1_damage",
    "GD03/GD03-034/deploy_choose_enemy_unit_deal_3_damage",
    "GD03/GD03-035/linked_allow_attack_target_active_enemy_ap_le_source_no_prechoice",
    "GD03/GD03-036/when_linked_deal_1_damage_to_all_enemy_units",
    "GD03/GD03-037/during_link_gain_first_strike_while_battling_destroyed_effect_unit",
    "GD03/GD03-038/support1_rest_trigger_zaft_ap_plus_2",
    "GD03/GD03-039/deploy_rest_clan_unit_and_optional_damage_2_to_enemy_ap_le_2",
    "GD03/GD03-039/deploy_no_clan_unit",
    "GD03/GD03-038/unit_rested_by_effect_ap_boost_zaft",
    "GD03/GD03-040/linked_grant_high_maneuver_skip_blocker",
    "GD03/GD03-040/linked_grant_high_maneuver_skip_blocker_hand",
    "GD03/GD03-040/linked_grant_high_maneuver_skip_blocker_hand_age",
    "GD03/GD03-041/deploy_damage_all_bases_3",
    "GD03/GD03-041/deploy_damage_all_bases_3_single",
    "GD03/GD03-042/allow_attack_target_active_enemy_le_5_if_ap_ge_5",
    "GD03/GD03-042/allow_attack_target_active_enemy_le_5_if_ap_higher",
    "GD03/GD03-044/deploy_daughtress_token_and_slot_full_flow",
    "GD03/GD03-045/ap_plus_1_if_any_token_in_play",
    "GD03/GD03-048/burst_enemy_shields_le_3_deploy_rested_gfred_token",
    "GD03/GD03-043/pair_damage_1_choose_enemy_unit",
    "GD03/GD03-043/pair_damage_1_choose_enemy_unit_destroy_1hp",
    "GD03/GD03-043/pair_damage_1_choose_enemy_unit_multiple",
    "GD03/GD03-049/shield_damage_destroy_lowest_hp_if_cb_trash_ge_10",
    "GD03/GD03-049/shield_damage_destroy_lowest_hp_tie_choice_if_cb_trash_ge_10",
    "GD03/GD03-050/activate_exile_3_tekkadan_teiwaz_then_damage_2_enemy",
    "GD03/GD03-051/when_linked_optional_deploy_from_trash_level_le_4_pay_cost",
    "GD03/GD03-053/during_pair_once_per_turn_effect_damage_rest_enemy_le_4",
    "GD03/GD03-054/pair_exile_4_vagan_then_destroy_enemy_le_4",
    "GD03/GD03-054/pair_exile_4_vagan_then_destroy_enemy_le_4_xrounder",
    "GD03/GD03-055/pair_with_purple_pilot_destroy_enemy_unit_level_le_2",
    "GD03/GD03-056/deploy_damage_1_choose_specific_friendly_and_enemy",
    "GD03/GD03-056/deploy_damage_1_destroy_selected_1hp_targets",
    "GD03/GD03-058/when_linked_deploy_from_trash_cost_reduced_gd03_058",
    "GD03/GD03-059/attack_exile_vagan_from_trash_then_grant_ap_plus_2_to_vagan_unit",
    "GD03/GD03-060/effect_damage_received_deploy_rested_token_once_per_turn",
    "GD03/GD03-061/repair_3_when_hp_eq_1_end_phase",
    "GD03/GD03-062/deploy_from_trash_via_gd03_051_then_damage_enemy_ap_le_4",
    "GD03/GD03-064/deploy_optional_add_x_rounder_from_trash_then_discard_1",
    "GD03/GD03-068/blocker_redirect_if_friendly_base_in_play",
    "GD03/GD03-069/during_link_end_turn_set_active_self_negative_not_linked",
    "GD03/GD03-069/during_link_end_turn_set_active_self_positive",
    "GD03/GD03-070/prevent_shield_battle_damage_while_rested",
    "GD03/GD03-070/prevent_shield_battle_damage_while_rested_base",
    "GD03/GD03-071/deploy_reduce_enemy_ap_per_aeug_unit_in_trash",
    "GD03/GD03-072/deploy_draw1_dis1_if_another_tsa",
    "GD03/GD03-072/deploy_draw1_dis1_if_another_tsa_positive",
    "GD03/GD03-072/deploy_no_draw_dis1_without_another_tsa_negative",
    "GD03/GD03-073/during_link_action_once_per_turn_ap_minus_3_if_gjallarhorn_trash_ge_6",
    "GD03/GD03-074/during_pair_forced_attack_target_rested_unit",
    "GD03/GD03-075/during_link_attack_choose_unpaired_enemy_ap_minus_2_until_end_turn",
    "GD03/GD03-076/once_per_turn_return_damaged_enemy_to_hand_tsa",
    "GD03/GD03-077/when_linked_choose_1_to_3_enemy_hp_le_3_return_to_hand",
    "GD03/GD03-078/during_link_destroyed_return_paired_card_to_hand",
    "GD03/GD03-079/replace_rest_base_with_rest_this_unit",
    "GD03/GD03-080/when_linked_add_gjallarhorn_command_from_trash_to_hand",
    "GD03/GD03-081/can_attack_when_sb_or_un_deployed_this_turn_positive",
    "GD03/GD03-081/cannot_attack_when_no_sb_or_un_deployed_this_turn_negative",
    "GD03/GD03-082/hand_cost_reduction_1_if_superpower_bloc_or_un_units_ge_2",
    "GD03/GD03-084/when_linked_grant_repair2_and_draw_if_target_jupitris",
    "GD03/GD03-084/when_linked_grant_repair2_no_draw_if_target_not_jupitris",
    "GD03/GD03-085/pair_from_hand_cost0_when_target_name_contains_gundam_nt1_positive",
    "GD03/GD03-085/pair_from_hand_not_cost0_when_target_not_nt1_negative",
    "GD03/GD03-086/attack_choose_titans_unit_level_le_source_ap_plus_1_positive",
    "GD03/GD03-086/attack_no_valid_titans_target_when_all_levels_gt_source_negative",
    "GD03/GD03-087/when_linked_rest_enemy_unit_level_le_3",
    "GD03/GD03-088/during_link_age_system_ap_plus_1_breach_1",
    "GD03/GD03-088/during_link_no_ap_breach_if_not_age_system_linked_negative",
    "GD03/GD03-089/pair_one_cyclops_trash_ap_plus_1",
    "GD03/GD03-089/pair_two_cyclops_trash_ap_plus_2",
    "GD03/GD03-089/pair_two_unique_with_duplicate_ap_plus_2",
    "GD03/GD03-089/pair_zero_cyclops_trash_ap_plus_0",
    "GD03/GD03-090/attack_choose_cyclops_gain_breach_1_then_hit_shield",
    "GD03/GD03-091/burst_add_this_card_to_hand",
    "GD03/GD03-091/when_linked_add_zaft_base_from_trash_to_hand",
    "GD03/GD03-093/continuous_ap_plus_1_while_no_enemy_base_in_play_positive",
    "GD03/GD03-095/effect_damage_trigger_choose_enemy_ap_minus_1_positive",
    "GD03/GD03-095/effect_damage_trigger_once_per_turn_guard_negative_second_time",
    "GD03/GD03-096/during_link_attack_optional_discard_1_then_draw_1",
    "GD03/GD03-092/when_linked_mill_zeon_or_clan_then_damage_1_enemy_unit",
    "GD03/GD03-094/when_paired_mill2_if_any_vagan_then_enemy_ap_minus_2",
    "GD03/GD03-097/during_link_once_per_turn_battle_destroy_scry2_top1_trash1",
    "GD03/GD03-098/during_link_set_active_by_effect_no_trigger_when_not_linked_negative",
    "GD03/GD03-098/during_link_set_active_by_effect_return_enemy_le_3hp_positive",
    "GD03/GD03-099/during_link_destroyed_with_white_base_return_enemy_level_le_source",
    "GD03/GD03-100/destroyed_choose_enemy_ap_minus_3_positive",
    "GD03/GD03-100/destroyed_no_trigger_when_source_not_destroyed_negative",
    "GD03/GD03-101/main_draw1_then_rest_enemy_hp_le_4_if_healthy_curiosity_trash_ge_2",
    "GD03/GD03-102/action_set_active_titans_link_unit_battling_enemy",
    "GD03/GD03-102/burst_draw_1",
    "GD03/GD03-103/burst_rest_enemy_hp_le_2",
    "GD03/GD03-103/main_if_enemy_units_ge_3_damage_2_to_rested_enemy",
    "GD03/GD03-104/main_choose_1_to_2_enemy_hp_le_3_when_jupitris_link_unit_in_play_single",
    "GD03/GD03-104/main_choose_1_to_2_enemy_hp_le_3_when_jupitris_link_unit_in_play",
    "GD03/GD03-105/main_grant_attack_target_active_enemy_without_pilot",
    "GD03/GD03-106/play_full_board_from_capture_multi_effect_order",
    "GD03/GD03-107/play_one_token_deal_1_damage",
    "GD03/GD03-107/play_three_tokens_deal_3_damage",
    "GD03/GD03-107/play_two_tokens_deal_2_damage",
    "GD03/GD03-107/play_zero_tokens_deal_0_damage",
    "GD03/GD03-109/burst_activate_main_choose_lv5_with_two_improved_technique_in_trash",
    "GD03/GD03-109/play_full_board_from_capture_multi_effect_order",
    "GD03/GD03-110/main_action_destroy_pilot_paired_with_enemy_unit_level_le_5",
    "GD03/GD03-112/main_all_paired_units_get_ap_plus_2_until_end_turn",
    "GD03/GD03-113/main_action_rest_active_friendly_then_damage_enemy_level_le_rested_unit",
    "GD03/GD03-114/play_full_board_from_capture_multi_effect_order",
    "GD03/GD03-114/action_destroy_active_enemy_level_le_2_when_trash_lt_10",
    "GD03/GD03-114/burst_activate_action_destroy_active_enemy_level_le_4_when_trash_ge_10",
    "GD03/GD03-115/action_prevent_battle_damage_ap_le_5_when_player_level_ge_7",
    "GD03/GD03-116/main_action_choose_friendly_vagan_and_enemy_deal_2_each",
    "GD03/GD03-117/main_deploy_barbatos_4th_form_token_when_enemy_units_ge_5",
    "GD03/GD03-117/main_deploy_graze_custom_token_when_enemy_units_1_to_4",
    "GD03/GD03-118/action_return_rested_enemy_le4_then_optional_blocker_if_two_awakened_potential_in_trash",
    "GD03/GD03-119/main_set_rested_friendly_base_active_then_enemy_units_ap_minus_1",
    "GD03/GD03-120/delayed_set_active_then_cannot_attack",
    "GD03/GD03-120/delayed_set_active_then_cannot_attack_multiple",
    "GD03/GD03-121/action_rest_friendly_base_and_enemy_unit_hp_le_3",
    "GD03/GD03-121/action_rest_friendly_base_rested_and_enemy_unit_hp_le_3",
    "GD03/GD03-122/action_return_enemy_unit_level_le_3_to_hand",
    "GD03/GD03-123/deploy_add_shield_then_rest_enemy_level_le_3_if_friendly_jupitris_unit_in_play",
    "GD03/GD03-124/once_per_turn_pair_pilot_le3_rest_enemy_hp_le3",
    "GD03/GD03-125/once_per_turn_heal_2_when_lv6_plus_g_team_unit_battle_destroys_enemy",
    "GD03/GD03-125/once_per_turn_heal_2_when_lv6_plus_g_team_unit_battle_destroys_enemy_blocker_exchange_damage",
    "GD03/GD03-126/opponent_turn_friendly_unit_tokens_get_ap_plus_1_continuous",
    "GD03/GD03-127/deploy_add_shield_then_grant_ap_plus_3_to_friendly_zaft_unit",
    "GD03/GD03-128/once_per_turn_opponent_effect_rests_your_unit_then_deal_1_to_enemy_unit",
    "GD03/GD03-129/main_deploy_hotarubi_then_effect_damage_tekkadan_rest_base_mill_1",
    "GD03/GD03-130/deploy_add_shield_then_optional_deploy_vagan_unit_level_le_4_from_trash_pay_cost_on_your_turn",
    "GD03/GD03-131/deploy_add_shield_then_return_enemy_le4_if_tsa_units_ge2",
    "GD03/GD03-131/deploy_add_shield_then_return_enemy_le4_if_tsa_units_ge2_extra_enemy_le4_target",
    "GD03/GD03-132/destroyed_if_aeug_link_unit_in_play_rest_enemy_unit_hp_le_4",
  ],
  ST01: [
    "ST01/ST01-001/link_immediate_attack",
    "ST01/ST01-001/pair_ap_boost_destroy_source",
    "ST01/ST01-001/pair_ap_boost_opponent_turn",
    "ST01/ST01-001/pair_ap_boost_turn",
    "ST01/ST01-001/repair_end_opponent_turn",
    "ST01/ST01-001/repair_end_turn",
    "ST01/ST01-002/pair_draw_non_match",
    "ST01/ST01-002/pair_draw_white_base",
    "ST01/ST01-002/pair_draw_white_base_command",
    "ST01/ST01-004/deploy_rest_low_hp",
    "ST01/ST01-004/deploy_rest_multiple_targets",
    "ST01/ST01-004/deploy_rest_no_target",
    "ST01/ST01-006/pair_ap_reduction_end_turn",
    "ST01/ST01-006/pair_ap_reduction_multiple_targets",
    "ST01/ST01-006/pair_ap_reduction_no_target",
    "ST01/ST01-006/pair_ap_reduction_single_target",
    "ST01/ST01-008/blocker_choice_multiple",
    "ST01/ST01-008/blocker_choice_multiple_active",
    "ST01/ST01-008/blocker_choice_redirect",
    "ST01/ST01-008/blocker_no_choice_when_rested",
    "ST01/ST01-009/blocker_choice_redirect",
    "ST01/ST01-009/cannot_attack_player",
    "ST01/ST01-010/pair_rest_multiple_targets",
    "ST01/ST01-010/pair_rest_no_target",
    "ST01/ST01-010/pair_rest_single_target",
    "ST01/ST01-011/attack_activate_resource",
    "ST01/ST01-011/attack_no_trigger_other_attacker",
    "ST01/ST01-011/burst_add_to_hand",
    "ST01/ST01-012/main_damage_no_rested",
    "ST01/ST01-012/main_damage_rested",
    "ST01/ST01-012/play_as_pilot",
    "ST01/ST01-013/main_heal_at_full_hp",
    "ST01/ST01-013/main_heal_friendly",
    "ST01/ST01-013/play_as_pilot",
    "ST01/ST01-014/action_step_ap_reduction",
    "ST01/ST01-014/action_step_ap_reduction_blocker_multi_target",
    "ST01/ST01-014/action_step_ap_reduction_multi_target",
    "ST01/ST01-014/burst_activate_main",
    "ST01/ST01-014/burst_activate_main_multi_target",
    "ST01/ST01-014/main_ap_reduction",
    "ST01/ST01-014/main_ap_reduction_multi_target",
    "ST01/ST01-015/burst_deploy",
    "ST01/ST01-015/deploy_shield_to_hand",
    "ST01/ST01-015/token_boost_then_action_step_ap_reduction",
    "ST01/ST01-015/token_deploy_one_unit",
    "ST01/ST01-015/token_deploy_one_unit_no_cost",
    "ST01/ST01-015/token_deploy_two_units",
    "ST01/ST01-015/token_deploy_zero_units",
    "ST01/ST01-016/activate_base_rested",
    "ST01/ST01-016/activate_boost_link_units",
    "ST01/ST01-016/activate_boost_link_units_mixed",
    "ST01/ST01-016/activate_boost_link_units_multi",
    "ST01/ST01-016/activate_boost_no_linked",
    "ST01/ST01-016/boost_removed_on_base_destroyed",
    "ST01/ST01-016/boost_then_action_step_ap_reduction",
    "ST01/ST01-016/burst_deploy",
    "ST01/ST01-016/deploy_shield_to_hand",
  ],
  ST02: [
    "ST02/ST02-001/attack_active_level4",
    "ST02/ST02-001/attack_active_level5",
    "ST02/ST02-001/breach_hits_base",
    "ST02/ST02-001/breach_hits_shield",
    "ST02/ST02-001/breach_no_shields",
    "ST02/ST02-002/consume_extra_energy",
    "ST02/ST02-002/deploy_extra_energy",
    "ST02/ST02-003/no_splash_not_paired",
    "ST02/ST02-003/paired_splash",
    "ST02/ST02-006/activate_once_per_turn",
    "ST02/ST02-006/activate_set_active",
    "ST02/ST02-006/activate_set_active_multiple_button",
    "ST02/ST02-008/blocker_shared_keyword_redirect_manual_flow.json",
    "ST02/ST02-009/blocker_shared_keyword_redirect_manual_flow.json",
    "ST02/ST02-010/burst_add_to_hand_then_link_ap_hp_plus_1_manual_flow.json",
    "ST02/ST02-011/no_draw_not_paired",
    "ST02/ST02-011/paired_draw",
    "ST02/ST02-012/grant_breach",
    "ST02/ST02-012/grant_breach_triggers",
    "ST02/ST02-013/prevent_shield_damage",
    "ST02/ST02-013/prevent_shield_damage_high_level",
    "ST02/ST02-014/burst_activate_main_then_main_action_rest_enemy_hp_le_5_manual_flow.json",
    "ST02/ST02-015/deploy_scry_top2",
    "ST02/ST02-016/burst_deploy_opponent_turn_skip_token_deploy",
    "ST02/ST02-016/burst_no_token",
    "ST02/ST02-016/deploy_full_board_from_capture",
    "ST02/ST02-016/deploy_tallgeese",
    "ST02/ST02-016/deploy_two_leo",
  ],
  ST03: [
    "ST03/ST03-001/paired_high_maneuver_unblockable_then_shield_destroy_damage_2_manual_flow.json",
    "ST03/ST03-002/activate_support_2_rest_self_choose_other_friendly_unit_ap_plus_2_manual_flow.json",
    "ST03/ST03-004/activate_support_2_rest_self_choose_other_friendly_unit_ap_plus_2_manual_flow.json",
    "ST03/ST03-006/destroyed_tutor_top3_zeon_or_neo_zeon_unit_manual_battle.json",
    "ST03/ST03-008/attack_ap_boost_self_only",
    "ST03/ST03-008/attack_ap_plus_2_auto_target_source",
    "ST03/ST03-009/deploy_rested_zaku_ii_token_on_enters_play_manual_flow.json",
    "ST03/ST03-010/deploy_from_hand_deploy_st03_005",
    "ST03/ST03-011/attack_ap_and_keyword_auto_target_paired_unit",
    "ST03/ST03-012/main_action_choose_friendly_unit_ap_plus_2_manual_flow.json",
    "ST03/ST03-012/play_as_angelo_sauper_pilot_manual_flow.json",
    "ST03/ST03-013/burst_activate_main_then_main_action_choose_enemy_unit_deal_2_manual_flow.json",
    "ST03/ST03-014/pilot_ramba_ral_then_action_prevent_battle_damage_enemy_ap_le_2_manual_flow.json",
    "ST03/ST03-015/deploy_add_shield_then_damage_enemy_unit_ap_le_5_manual_flow.json",
    "ST03/ST03-016/deploy_add_shield_then_if_your_turn_deploy_rested_chars_zaku_ii_token_manual_flow.json",
  ],
  ST04: [
    "ST04/ST04-001/pair_bounce_enemy_unit_hp_le_4_if_pilot_level_ge_4",
    "ST04/ST04-002/deploy_draw_then_discard",
    "ST04/ST04-004/shared_keyword_blocker_redirect_attack_target_manual_flow",
    "ST04/ST04-006/attack_ap_ge_5_choose_enemy_unit_level_5_or_higher_deal_3_manual_flow.json",
    "ST04/ST04-007/attack_manual_flow_destroy_enemy_unit_then_breach3_hits_first_shield.json",
    "ST04/ST04-009/destroyed_draw_if_another_link_unit",
    "ST04/ST04-009/pair_draw_if_another_link_unit",
    "ST04/ST04-010/burst_add_to_hand_and_attack_choose_enemy_unit_ap_minus_2_during_battle_manual_flow",
    "ST04/ST04-011/pair_attack_active",
    "ST04/ST04-012/burst_deploy_aile_token_if_none",
    "ST04/ST04-012/choose_one_then_deploy_token_option_a",
    "ST04/ST04-013/main_and_action_return_enemy_hp_le_3_then_play_as_mu_la_flaga_pilot_manual_flow.json",
    "ST04/ST04-014/main_and_action_grant_first_strike_to_friendly_unit_level_2_or_lower_then_play_as_miguel_ayman_pilot_manual_flow.json",
    "ST04/ST04-015/activate_main_set_active_blocker_and_restrict_attack_manual_flow.json",
    "ST04/ST04-016/activate_main_rest_base_choose_friendly_unit_ap_plus_1_manual_flow.json",
  ],
  ST05: [
    "ST05/ST05-001/deploy_damage_other_then_ap_plus_1_on_same_unit",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_multiple_burst",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_no_damage",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_single_burst",
    "ST05/ST05-002/continuous_ap_plus_2_while_damaged_manual_battle_flow.json",
    "ST05/ST05-003/activate_main_rest_self_choose_friendly_unit_deal_1_then_ap_plus_1_manual_flow.json",
    "ST05/ST05-005/destroyed_choose_enemy_unit_ap_le_4_rest_it_manual_battle_flow.json",
    "ST05/ST05-007/when_paired_choose_enemy_unit_level_3_or_lower_ap_minus_2_manual_flow.json",
    "ST05/ST05-008/shared_keyword_blocker_redirect_attack_target_manual_flow.json",
    "ST05/ST05-010/deploy_damage_other_then_ap_plus_1_multiple_unit",
    "ST05/ST05-010/deploy_damage_other_then_ap_plus_1_on_same_unit",
    "ST05/ST05-011/burst_add_to_hand_then_during_link_battle_destroy_add_tekkadan_unit_le_2_from_trash_manual_flow.json",
    "ST05/ST05-012/burst_add_to_hand_then_when_paired_if_2_other_gjallarhorn_or_tekkadan_units_rest_enemy_hp_le_3_manual_flow.json",
    "ST05/ST05-013/main_action_choose_friendly_unit_deal_1_then_ap_plus_3_manual_flow.json",
    "ST05/ST05-014/main_destroy_enemy_level_3_or_lower_then_burst_damage_enemy_unit_manual_flow.json",
    "ST05/ST05-015/activate_main_rest_base_choose_damaged_unit_ap_plus_2_manual_flow.json",
  ],
  ST06: [
    "ST06/ST06-001/grant_first_strike_linked",
    "ST06/ST06-002/deploy_damage_enemy_1_if_clan_ge_2",
    "ST06/ST06-003/activate_support_1_rest_self_choose_other_unit_ap_plus_1",
    "ST06/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2",
    "ST06/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2_destroy",
    "ST06/ST06-007/deploy_choose_other_clan_allow_attack_target_active_enemy_ap_le_3_manual_flow.json",
    "ST06/ST06-009/grant_first_strike_linked",
    "ST06/ST06-009/grant_first_strike_linked_noclan",
    "ST06/ST06-009/grant_first_strike_linked_noclan_card",
    "ST06/ST06-010/burst_add_to_hand_then_during_link_attack_scry_top_or_bottom_if_clan_unit_in_play_manual_flow.json",
    "ST06/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2",
    "ST06/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2_destroy",
    "ST06/ST06-012/main_tutor_top3_may_take_clan_unit_or_pilot_random_bottom_manual_flow.json",
    "ST06/ST06-013/action_prevent_battle_damage_from_enemy_units_le_2_for_clan",
    "ST06/ST06-014/activate_restSelf_ap_plus_2_if_clan_link_unit",
    "ST06/ST06-015/once_per_turn_link_grants_breach3_then_destroy_hits_first_shield_manual_flow.json",
  ],
  ST07: [
    "ST07/ST07-001/end_of_turn_set_active_resource_if_cb_trash_ge_7",
    "ST07/ST07-001/pair_mill2_draw_if_cb",
    "ST07/ST07-004/blocker_if_cb_pilot_in_play",
    "ST07/ST07-005/battle_destroy_heal_2_on_your_turn",
    "ST07/ST07-005/battle_destroy_heal_2_on_your_turn3",
    "ST07/ST07-007/during_your_turn_ap_plus_2_if_cb_pilot_in_play_manual_battle_flow.json",
    "ST07/ST07-009/attack_branch_all_cb_units_ap_plus_1_if_cb_trash_ge_7",
    "ST07/ST07-009/attack_branch_paired_unit_ap_plus_1_if_cb_trash_lt_7",
    "ST07/ST07-010/destroyed_draw_1_on_opponent_turn_if_paired_cb_unit",
    "ST07/ST07-011/pair_allow_attack_target_active_enemy_le_source_no_prechoice",
    "ST07/ST07-012/burst_add_to_hand_then_linked_cb_unit_prevents_battle_damage_from_enemy_ap3_or_less_on_your_turn_manual_flow.json",
    "ST07/ST07-013/burst_draw_1_then_action_redirect_attack_to_rested_cb_unit_manual_flow.json",
    "ST07/ST07-014/main_tutor_top3_may_take_cb_unit_or_pilot_random_bottom_manual_flow.json",
    "ST07/ST07-015/prevent_damage_base_if_rested_cb_unit_in_play_lv3",
    "ST07/ST07-015/prevent_damage_base_if_rested_cb_unit_in_play_lv3_token",
    "ST07/ST07-015/prevent_damage_base_if_rested_cb_unit_in_play_lv5",
  ],
  ST08: [
    "ST08/ST08-001/costing",
    "ST08/ST08-001/costing_level6_onfield",
    "ST08/ST08-001/costingnotfill",
    "ST08/ST08-001/pair_damage_highest_level_enemy_3",
    "ST08/ST08-001/pair_damage_highest_level_enemy_3_multiple",
    "ST08/ST08-002/deploy_choose_enemy_unit_deal_1_damage_manual_flow",
    "ST08/ST08-004/attack_if_attacking_enemy_unit_choose_enemy_unit_deal_1_damage_manual_flow.json",
    "ST08/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2",
    "ST08/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2_notarget",
    "ST08/ST08-008/gain_blocker_if_enemy_units_ge_3_redirect_attack_manual_flow.json",
    "ST08/ST08-009/deploy_prevent_set_active_next_turn_rested_enemy_unit_level_2_or_lower_manual_flow.json",
    "ST08/ST08-010/burst_add_to_hand_then_pair_choose_mafty_unit_allow_attack_target_damaged_active_enemy_manual_flow.json",
    "ST08/ST08-011/effect_draw_grant_high_maneuver_if_paired_blue_unit",
    "ST08/ST08-011/effect_draw_grant_high_maneuver_if_paired_unit_blue",
    "ST08/ST08-012/main_grant_breach_1_to_friendly_link_unit_then_play_as_gawman_nobile_pilot_manual_flow.json",
    "ST08/ST08-013/main_action_choose_enemy_unit_deal_2_if_friendly_mafty_link_unit_in_play_manual_flow.json",
    "ST08/ST08-014/deploy_add_shield_then_choose_friendly_unit_ap_plus_2_manual_flow",
    "ST08/ST08-015/activate_main_once_per_turn_choose_friendly_unit_recover_2_hp_manual_flow.json"
  ],
  T: ["T/T-014/restrictions_cannot_set_active_or_pair"],
} as const satisfies Record<string, readonly string[]>;

const SCENARIO_PRESETS: readonly string[] = Object.values(SCENARIO_PRESET_GROUPS).flat();

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

  setScenarioResourceFallbackEnabled(enabled: boolean) {
    this.scenarioResourceFallbackEnabled = enabled === true;
    this.engine.setAllowEnvScanFallbackDefault(this.scenarioResourceFallbackEnabled);
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
      console.log("[debug-controls] setScenario inject", {
        scenarioPath: targetScenario,
        gameId,
        playerSelector,
      });

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
