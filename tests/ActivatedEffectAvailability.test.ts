import { describe, expect, it } from "vitest";
import { getActivatedEffectOptions } from "../src/phaser/game/actionEligibility";

describe("activated effect availability", () => {
  it("disables activated option when opponentHandSize condition is unmet", () => {
    const card = {
      carduid: "GD01-097_pilot_0001",
      isRested: false,
      cardData: {
        cardType: "pilot",
        effects: {
          description: [
            "[Activate/Main][Once per Turn]If your opponent has 8 or more cards in their hand, set this Unit as active. It can't attack during this turn.",
          ],
          rules: [
            {
              effectId: "activate_effect",
              type: "activated",
              timing: { windows: ["MAIN_PHASE"] },
              cost: { oncePerTurn: true },
              conditions: [{ type: "opponentHandSize", scope: "opponent", value: ">=8" }],
              action: "sequence",
            },
          ],
        },
      },
      effectUsage: {},
    };

    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        currentPlayer: "playerId_1",
        currentTurn: 1,
        players: {
          playerId_1: {
            zones: {
              energyArea: [{ isRested: false }],
            },
            deck: {
              handUids: [],
            },
          },
          playerId_2: {
            deck: {
              handUids: ["h1", "h2", "h3", "h4", "h5", "h6", "h7"],
            },
          },
        },
      },
    };

    const options = getActivatedEffectOptions(card, raw, "playerId_1");
    expect(options).toHaveLength(1);
    expect(options[0].effectId).toBe("activate_effect");
    expect(options[0].conditionsMet).toBe(false);
    expect(options[0].enabled).toBe(false);
  });

  it("enables activated option when opponentHandSize condition is met", () => {
    const card = {
      carduid: "GD01-097_pilot_0001",
      isRested: false,
      cardData: {
        cardType: "pilot",
        effects: {
          description: [
            "[Activate/Main][Once per Turn]If your opponent has 8 or more cards in their hand, set this Unit as active. It can't attack during this turn.",
          ],
          rules: [
            {
              effectId: "activate_effect",
              type: "activated",
              timing: { windows: ["MAIN_PHASE"] },
              cost: { oncePerTurn: true },
              conditions: [{ type: "opponentHandSize", scope: "opponent", value: ">=8" }],
              action: "sequence",
            },
          ],
        },
      },
      effectUsage: {},
    };

    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        currentPlayer: "playerId_1",
        currentTurn: 1,
        players: {
          playerId_1: {
            zones: {
              energyArea: [{ isRested: false }],
            },
            deck: {
              handUids: [],
            },
          },
          playerId_2: {
            deck: {
              handUids: ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8"],
            },
          },
        },
      },
    };

    const options = getActivatedEffectOptions(card, raw, "playerId_1");
    expect(options).toHaveLength(1);
    expect(options[0].effectId).toBe("activate_effect");
    expect(options[0].conditionsMet).toBe(true);
    expect(options[0].enabled).toBe(true);
  });

  it("does not hide support activation because another rule says set this Unit as active", () => {
    const card = {
      carduid: "GD01-046_friendly_zaft_0003",
      isRested: false,
      cardData: {
        cardType: "unit",
        effects: {
          description: [
            "[Activate/Main]<Support 3> ...",
            "[During Pair-(Coordinator) Pilot] ... set this Unit as active.",
          ],
          rules: [
            {
              effectId: "activate_support_3",
              type: "activated",
              timing: { windows: ["MAIN_PHASE"] },
              cost: { rest: "self" },
              action: "modifyAP",
              parameters: { value: 3, excludeSource: true },
            },
            {
              effectId: "support_ap_up_zaft_set_self_active_once_per_turn",
              type: "triggered",
              trigger: "SUPPORT_AP_INCREASED",
              action: "setActive",
            },
          ],
        },
      },
      effectUsage: {},
    };

    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        currentPlayer: "playerId_1",
        currentTurn: 3,
        players: {
          playerId_1: {
            zones: {
              energyArea: [{ isRested: false }],
            },
          },
        },
      },
    };

    const options = getActivatedEffectOptions(card, raw, "playerId_1");
    expect(options).toHaveLength(1);
    expect(options[0].effectId).toBe("activate_support_3");
    expect(options[0].enabled).toBe(true);
  });

  it("keeps GD03-038 support activation visible alongside UNIT_RESTED_BY_EFFECT trigger text", () => {
    const card = {
      carduid: "GD03-038_unit_0001",
      isRested: false,
      cardData: {
        cardType: "unit",
        effects: {
          description: [
            "【Activate･Main】<Support 1> (Rest this Unit. 1 other friendly Unit gets AP+(specified amount) during this turn.)",
            "During your turn, when this Unit is rested by an effect, choose 1 of your (ZAFT) Units. It gets AP+2 during this turn.",
          ],
          rules: [
            {
              effectId: "activate_effect",
              type: "activated",
              timing: { windows: ["MAIN_PHASE"] },
              cost: { rest: "self" },
              action: "sequence",
              parameters: { text: "<Support 1> ..." },
            },
            {
              effectId: "unit_rested_by_effect",
              type: "triggered",
              trigger: "UNIT_RESTED_BY_EFFECT",
              action: "modifyAP",
            },
          ],
        },
      },
      effectUsage: {},
    };

    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        currentPlayer: "playerId_1",
        currentTurn: 3,
        players: {
          playerId_1: {
            zones: {
              energyArea: [{ isRested: false }],
            },
          },
        },
      },
    };

    const options = getActivatedEffectOptions(card, raw, "playerId_1");
    expect(options).toHaveLength(1);
    expect(options[0].effectId).toBe("activate_effect");
    expect(options[0].enabled).toBe(true);
  });
});
