import { describe, expect, test } from 'vitest';
import { shouldUseBoardSlotSprite } from '../src/phaser/ui/TargetDialogRenderPolicy';

describe('shouldUseBoardSlotSprite', () => {
  test('returns true only when both unit and pilot exist in the slot', () => {
    expect(shouldUseBoardSlotSprite(undefined)).toBe(false);
    expect(shouldUseBoardSlotSprite({ unit: { id: 'GD03-001' } } as any)).toBe(false);
    expect(shouldUseBoardSlotSprite({ pilot: { id: 'GD03-084' } } as any)).toBe(false);
    expect(
      shouldUseBoardSlotSprite({
        unit: { id: 'GD03-001' },
        pilot: { id: 'GD03-084' },
      } as any),
    ).toBe(true);
  });
});
