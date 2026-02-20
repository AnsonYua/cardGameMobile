import { describe, expect, it } from 'vitest';
import { resolveTargetChoiceHeader } from '../src/phaser/controllers/targeting/TargetChoiceTitles';

describe('TargetChoiceTitles', () => {
  it('resolves PAIR_FROM_HAND header', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'PAIR_FROM_HAND', isMulti: false }))
      .toBe('Choose a Pilot in your hand to pair');
  });

  it('resolves SEQUENCE_PAIR_FROM_HAND header', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'SEQUENCE_PAIR_FROM_HAND', isMulti: false }))
      .toBe('Choose a Pilot in your hand to pair');
  });
});
