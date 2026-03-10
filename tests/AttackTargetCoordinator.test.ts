import { describe, expect, it, vi } from "vitest";
import { AttackTargetCoordinator } from "../src/phaser/controllers/AttackTargetCoordinator";
import { SlotInteractionGate } from "../src/phaser/controllers/SlotInteractionGate";

describe("AttackTargetCoordinator", () => {
  it("accepts only the first valid target click and shows loading before submit starts", async () => {
    const actionControls = {
      setState: vi.fn(),
      setTransientLoading: vi.fn(),
    };
    const slotControls = {
      setSlotClickEnabled: vi.fn(),
    };
    const slotGate = new SlotInteractionGate(slotControls as any);
    const coordinator = new AttackTargetCoordinator(actionControls as any, slotGate);
    const target = { owner: "opponent", slotId: "slot1" } as any;
    let releaseSubmit: (() => void) | undefined;
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          expect(slotControls.setSlotClickEnabled).toHaveBeenCalledWith(false);
          expect(actionControls.setTransientLoading).toHaveBeenCalledWith(true);
          releaseSubmit = resolve;
        }),
    );

    coordinator.enter([target], submit);

    const firstClick = coordinator.handleSlot(target);
    const secondClick = coordinator.handleSlot(target);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(await secondClick).toBe(false);

    releaseSubmit?.();

    expect(await firstClick).toBe(true);
    expect(actionControls.setTransientLoading).toHaveBeenLastCalledWith(false);
    expect(slotControls.setSlotClickEnabled).toHaveBeenLastCalledWith(true);
  });

  it("ignores cancel and other slot clicks while target submit is pending", async () => {
    const actionControls = {
      setState: vi.fn(),
      setTransientLoading: vi.fn(),
    };
    const slotControls = {
      setSlotClickEnabled: vi.fn(),
    };
    const slotGate = new SlotInteractionGate(slotControls as any);
    const coordinator = new AttackTargetCoordinator(actionControls as any, slotGate);
    const target = { owner: "opponent", slotId: "slot1" } as any;
    const otherTarget = { owner: "opponent", slotId: "slot2" } as any;
    const onCancel = vi.fn();
    let actionBarState: any;
    actionControls.setState.mockImplementation((state: any) => {
      actionBarState = state;
    });
    let releaseSubmit: (() => void) | undefined;
    const submit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseSubmit = resolve;
        }),
    );

    coordinator.enter([target], submit, onCancel);
    const submitPromise = coordinator.handleSlot(target);

    actionBarState.descriptors[0].onClick();
    expect(onCancel).not.toHaveBeenCalled();
    expect(await coordinator.handleSlot(otherTarget)).toBe(false);
    expect(actionControls.setTransientLoading).not.toHaveBeenCalledWith(false);

    releaseSubmit?.();
    await submitPromise;

    expect(actionControls.setTransientLoading).toHaveBeenLastCalledWith(false);
  });
});
