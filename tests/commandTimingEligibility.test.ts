import { describe, expect, it } from "vitest";
import { commandHasTimingWindow } from "../src/phaser/game/actionEligibility";

const PLAYER_ID = "playerId_1";
const COMMAND_UID = "GD01-110_hand_main_0001";

function buildRaw(phase: string, rules: any[]) {
  return {
    gameEnv: {
      phase,
      players: {
        [PLAYER_ID]: {
          deck: {
            hand: [
              {
                carduid: COMMAND_UID,
                cardData: {
                  cardType: "command",
                  effects: {
                    rules,
                  },
                },
              },
            ],
          },
        },
      },
    },
  };
}

describe("commandHasTimingWindow", () => {
  it("treats play rules with missing timing.windows as playable in MAIN_PHASE", () => {
    const raw = buildRaw("MAIN_PHASE", [
      {
        effectId: "allow_attack_target_active_enemy_ap_le_6_for_unit_ge_4",
        type: "play",
        timing: { duration: "UNTIL_END_OF_TURN" },
        action: "allow_attack_target",
      },
    ]);

    const result = commandHasTimingWindow(
      { kind: "hand", uid: COMMAND_UID, cardType: "command" } as any,
      raw,
      PLAYER_ID,
      "MAIN_PHASE",
    );

    expect(result).toBe(true);
  });

  it("does not auto-enable missing timing.windows play rules in ACTION_STEP", () => {
    const raw = buildRaw("ACTION_STEP_PHASE", [
      {
        effectId: "allow_attack_target_active_enemy_ap_le_6_for_unit_ge_4",
        type: "play",
        timing: { duration: "UNTIL_END_OF_TURN" },
        action: "allow_attack_target",
      },
    ]);

    const result = commandHasTimingWindow(
      { kind: "hand", uid: COMMAND_UID, cardType: "command" } as any,
      raw,
      PLAYER_ID,
      "ACTION_STEP_PHASE",
    );

    expect(result).toBe(false);
  });

  it("keeps explicit timing.windows behavior unchanged", () => {
    const raw = buildRaw("MAIN_PHASE", [
      {
        effectId: "explicit_main_play",
        type: "play",
        timing: { windows: ["MAIN_PHASE"] },
        action: "draw",
      },
    ]);

    const mainResult = commandHasTimingWindow(
      { kind: "hand", uid: COMMAND_UID, cardType: "command" } as any,
      raw,
      PLAYER_ID,
      "MAIN_PHASE",
    );
    const actionStepResult = commandHasTimingWindow(
      { kind: "hand", uid: COMMAND_UID, cardType: "command" } as any,
      raw,
      PLAYER_ID,
      "ACTION_STEP_PHASE",
    );

    expect(mainResult).toBe(true);
    expect(actionStepResult).toBe(false);
  });

  it("ignores non-play rules when evaluating command hand play timing", () => {
    const raw = buildRaw("MAIN_PHASE", [
      {
        effectId: "pilot_designation",
        type: "special",
        timing: { windows: ["MAIN_PHASE"] },
        action: "designate_pilot",
      },
    ]);

    const result = commandHasTimingWindow(
      { kind: "hand", uid: COMMAND_UID, cardType: "command" } as any,
      raw,
      PLAYER_ID,
      "MAIN_PHASE",
    );

    expect(result).toBe(false);
  });
});
