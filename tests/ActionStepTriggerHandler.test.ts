import { describe, expect, it, vi } from "vitest";
import { ActionStepTriggerHandler } from "../src/phaser/controllers/ActionStepTriggerHandler";

describe("ActionStepTriggerHandler", () => {
  it("direct-submits when exactly one enabled effect exists", async () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        currentPlayer: "player_1",
        currentBattle: {
          status: "ACTION_STEP",
          actionTargets: {
            player_1: [
              {
                carduid: "unit_1",
                effectIds: ["effect_1", "effect_2"],
              },
            ],
          },
        },
        players: {
          player_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "unit_1",
                  isRested: false,
                  cardData: {
                    effects: {
                      rules: [
                        { type: "activated", effectId: "effect_1" },
                        { type: "activated", effectId: "effect_2", cost: { resource: 1 } },
                      ],
                    },
                  },
                },
              },
              energyArea: [],
            },
          },
        },
      },
    };
    const actionExecutor = {
      handleActivateCardAbility: vi.fn(async () => undefined),
    };
    const abilityFlow = {
      showSlotCardAbilityChoiceDialog: vi.fn(async () => undefined),
    };
    const handler = new ActionStepTriggerHandler({
      engine: { getSnapshot: vi.fn(() => ({ raw })) } as any,
      gameContext: { playerId: "player_1" } as any,
      actionExecutor: actionExecutor as any,
      getActionStepTargets: vi.fn(() => raw.gameEnv.currentBattle.actionTargets.player_1),
      getAbilityFlow: () => abilityFlow as any,
      getSelectedHandCard: vi.fn(),
      runActionThenRefresh: vi.fn(),
      cancelSelection: vi.fn(),
    });
    const slot = {
      owner: "player",
      slotId: "slot1",
      unit: {
        cardUid: "unit_1",
        isRested: false,
        cardData: raw.gameEnv.players.player_1.zones.slot1.unit.cardData,
      },
    };

    await handler.handleUnitEffectTrigger(slot as any);

    expect(actionExecutor.handleActivateCardAbility).toHaveBeenCalledWith("unit_1", "effect_1");
    expect(abilityFlow.showSlotCardAbilityChoiceDialog).not.toHaveBeenCalled();
  });
});
