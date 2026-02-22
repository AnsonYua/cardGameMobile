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
    "GD01/GD01-003/attack_link_move_12_from_trash_shuffle_set_active_first_strike",
    "GD01/GD01-005/destroyed_linked_return_pilot_then_discard",
    "GD01/GD01-009/deploy_choose_white_base_team_unit_grant_high_maneuver",
    "GD01/GD01-019/gain_blocker_if_enemy_units_ge_4",
    "GD01/GD01-023/activate_discard_zeon_unit_then_pair_newtype_pilot_from_trash",
    "GD01/GD01-025/pair_place_rested_resource_then_first_strike",
    "GD01/GD01-044/pair_damage_1_choose_1_to_2_enemy_units",
    "GD01/GD01-047/attack_if_two_other_rested_choose_enemy_damage_3",
    "GD01/GD01-048/deploy_tutor_top_choose_bottom",
    "GD01/GD01-048/deploy_tutor_top_take_zeon_unit",
    "GD01/GD01-050/attack_ap_ge_5_choose_enemy_damage_2",
    "GD01/GD01-058/activate_action_choose_lv4_or_higher_unit_ap_plus_1_until_end_of_battle",
    "GD01/GD01-059/attack_ap_plus_2_auto_target_source",
    "GD01/GD01-063/first_strike_vs_battle_opponent_level_le_2",
    "GD01/GD01-066/justicetoken",
    "GD01/GD01-069/activate_set_active_blocker_then_restrict_attack",
    "GD01/GD01-097/activate_set_active_then_restrict_attack_if_opponent_hand_ge_8",
    "GD01/GD01-107/burst_place_ex_resource",
    "GD01/GD01-107/main_place_rested_resource",
    "GD01/GD01-108/main_damage_all_blockers_2",
    "GD01/GD01-118/draw2_dis1",
    "GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy"
  ],
  GD02: [
    "GD02/GD02-001/paired_titans_shield_area_battle_damage_heal_2",
    "GD02/GD02-002/link_once_per_turn_set_active_on_friendly_battle_destroy",
    "GD02/GD02-002/link_once_per_turn_set_active_on_friendly_battle_destroy_nopilot",
    "GD02/GD02-007/repair_2_end_of_turn",
    "GD02/GD02-009/ap_reduced_by_enemy_effect_retaliate_damage_2",
    "GD02/GD02-010/effect_damage_received_enemy_draw_once_per_turn",
    "GD02/GD02-022/gain_breach_2_on_ex_resource_once_per_turn",
    "GD02/GD02-023/link_first_strike_if_player_level_ge_7",
    "GD02/GD02-023/link_no_first_strike_if_player_level_lt_7",
    "GD02/GD02-031/continuous_ap_plus_2_if_player_level_ge_7_less",
    "GD02/GD02-031/continuous_ap_plus_2_if_player_level_ge_7_more",
    "GD02/GD02-033/gain_breach_5_if_another_zeon_link",
    "GD02/GD02-034/pair_ap_boost_if_paired_red_pilot",
    "GD02/GD02-054/attack_cost_destroy_friendly_then_damage_2_to_enemy_le_4",
    "GD02/GD02-057/attack_cost_destroy_friendly_then_damage_2_to_enemy_le_4",
    "GD02/GD02-058/deploy_draw1_dis1",
    "GD02/GD02-061/pair_rest_enemy_ap_le_3_if_trash_teiwaz_or_tekkadan_ge_3",
    "GD02/GD02-070/deploy_draw2_dis2_if_trash_4_gjallarhorn",
    "GD02/GD02-073/opponent_turn_grant_first_strike_to_battling_enemy",
    "GD02/GD02-089/pair_choose_other_zeon_link_unit_grant_breach_1",
    "GD02/GD02-095/attack_damaged_le_5_grant_high_maneuver_skip_blocker",
    "GD02/GD02-098/pair_draw1_dis1_if_aeug",
    "GD02/GD02-117/draw3_dis2",
  ],
  GD03: [
    "GD03/GD03-001/pair_damage_rested_destroy_draw_1",
    "GD03/GD03-002/during_pair_repair_unit_attack_rest_enemy",
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
    "GD03/GD03-064/deploy_damage_unit_then_ap_plus_1_on_same_unit",
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
    "GD03/GD03-122/action_return_enemy_unit_level_le_3_to_hand",
    "GD03/GD03-123/deploy_add_shield_then_rest_enemy_level_le_3_if_friendly_jupitris_unit_in_play",
    "GD03/GD03-124/once_per_turn_pair_pilot_le3_rest_enemy_hp_le3",
    "GD03/GD03-125/once_per_turn_heal_2_when_lv6_plus_g_team_unit_battle_destroys_enemy",
    "GD03/GD03-127/deploy_add_shield_then_grant_ap_plus_3_to_friendly_zaft_unit",
    "GD03/GD03-128/once_per_turn_opponent_effect_rests_your_unit_then_deal_1_to_enemy_unit",
    "GD03/GD03-129/main_deploy_hotarubi_then_effect_damage_tekkadan_rest_base_mill_1",
    "GD03/GD03-130/deploy_add_shield_then_optional_deploy_vagan_unit_level_le_4_from_trash_pay_cost_on_your_turn",
    "GD03/GD03-131/deploy_add_shield_then_return_enemy_le4_if_tsa_units_ge2",
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
    "ST02/ST02-011/no_draw_not_paired",
    "ST02/ST02-011/paired_draw",
    "ST02/ST02-012/grant_breach",
    "ST02/ST02-012/grant_breach_triggers",
    "ST02/ST02-013/prevent_shield_damage",
    "ST02/ST02-013/prevent_shield_damage_high_level",
    "ST02/ST02-015/deploy_scry_top2",
    "ST02/ST02-016/burst_deploy_opponent_turn_skip_token_deploy",
    "ST02/ST02-016/burst_no_token",
    "ST02/ST02-016/deploy_full_board_from_capture",
    "ST02/ST02-016/deploy_tallgeese",
    "ST02/ST02-016/deploy_two_leo",
  ],
  ST03: [
    "ST03/ST03-008/attack_ap_boost_self_only",
    "ST03/ST03-008/attack_ap_plus_2_auto_target_source",
    "ST03/ST03-010/deploy_from_hand_deploy_st03_005",
    "ST03/ST03-011/attack_ap_and_keyword_auto_target_paired_unit",
  ],
  ST04: [
    "ST04/ST04-001/pair_bounce_enemy_unit_hp_le_4_if_pilot_level_ge_4",
    "ST04/ST04-002/deploy_draw_then_discard",
    "ST04/ST04-009/destroyed_draw_if_another_link_unit",
    "ST04/ST04-009/pair_draw_if_another_link_unit",
    "ST04/ST04-011/pair_attack_active",
    "ST04/ST04-012/burst_deploy_aile_token_if_none",
    "ST04/ST04-012/choose_one_then_deploy_token_option_a",
  ],
  ST05: [
    "ST05/ST05-001/deploy_damage_other_then_ap_plus_1_on_same_unit",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_multiple_burst",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_no_damage",
    "ST05/ST05-001/suppression_damaged_unit_attacks_two_shields_single_burst",
    "ST05/ST05-010/deploy_damage_other_then_ap_plus_1_multiple_unit",
    "ST05/ST05-010/deploy_damage_other_then_ap_plus_1_on_same_unit",
  ],
  ST06: [
    "ST06/ST06-001/grant_first_strike_linked",
    "ST06/ST06-002/deploy_damage_enemy_1_if_clan_ge_2",
    "ST06/ST06-003/activate_support_1_rest_self_choose_other_unit_ap_plus_1",
    "ST06/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2",
    "ST06/ST06-005/attack_choose_1_or_2_clan_units_ap_plus_2_destroy",
    "ST06/ST06-009/grant_first_strike_linked",
    "ST06/ST06-009/grant_first_strike_linked_noclan",
    "ST06/ST06-009/grant_first_strike_linked_noclan_card",
    "ST06/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2",
    "ST06/ST06-011/main_or_action_choose_1_or_2_clan_units_ap_plus_2_destroy",
    "ST06/ST06-013/action_prevent_battle_damage_from_enemy_units_le_2_for_clan",
    "ST06/ST06-014/activate_restSelf_ap_plus_2_if_clan_link_unit",
  ],
  ST07: [
    "ST07/ST07-011/pair_allow_attack_target_active_enemy_le_source_no_prechoice",
    "ST07/ST07-001/end_of_turn_set_active_resource_if_cb_trash_ge_7",
    "ST07/ST07-001/pair_mill2_draw_if_cb",
    "ST07/ST07-004/blocker_if_cb_pilot_in_play",
    "ST07/ST07-005/battle_destroy_heal_2_on_your_turn",
    "ST07/ST07-005/battle_destroy_heal_2_on_your_turn3",
    "ST07/ST07-009/attack_branch_all_cb_units_ap_plus_1_if_cb_trash_ge_7",
    "ST07/ST07-009/attack_branch_paired_unit_ap_plus_1_if_cb_trash_lt_7",
    "ST07/ST07-010/destroyed_draw_1_on_opponent_turn_if_paired_cb_unit",
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
    "ST08/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2",
    "ST08/ST08-006/pair_attack_reveal_ef_unit_bottom_then_draw_2_notarget",
    "ST08/ST08-011/effect_draw_grant_high_maneuver_if_paired_blue_unit",
    "ST08/ST08-011/effect_draw_grant_high_maneuver_if_paired_unit_blue",
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
