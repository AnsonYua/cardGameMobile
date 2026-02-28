import { describe, expect, it } from "vitest";
import { shouldSkipBattleResolutionAnimation } from "../src/phaser/utils/BattleAnimationPolicy";

describe("BattleAnimationPolicy.shouldSkipBattleResolutionAnimation", () => {
  it("returns true for pre-battle aborted attack-unit resolution", () => {
    const payload = {
      battleType: "attackUnit",
      result: {
        aborted: true,
        battleEndedEarly: true,
        preBattle: true,
        damageStepExecuted: false,
        attackerDamageTaken: 0,
      },
    };

    expect(shouldSkipBattleResolutionAnimation(payload)).toBe(true);
  });

  it("returns false for normal resolved attack-unit battle", () => {
    const payload = {
      battleType: "attackUnit",
      result: {
        attackerDestroyed: false,
        defenderDestroyed: true,
        attackerDamageTaken: 1,
        defenderDamageTaken: 5,
      },
    };

    expect(shouldSkipBattleResolutionAnimation(payload)).toBe(false);
  });

  it("returns false when payload/result is missing", () => {
    expect(shouldSkipBattleResolutionAnimation(undefined)).toBe(false);
    expect(shouldSkipBattleResolutionAnimation({})).toBe(false);
    expect(shouldSkipBattleResolutionAnimation({ battleType: "attackUnit" })).toBe(false);
  });
});
