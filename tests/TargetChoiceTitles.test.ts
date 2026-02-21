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

  it('falls back to action mapping when choiceKind is unknown', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'UNKNOWN_KIND', action: 'damage', isMulti: false }))
      .toBe('Choose a target to deal damage to');
  });

  it('falls back to action mapping for modifyAP', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'EFFECT_TARGET_CHOICE', action: 'modifyAP', isMulti: false }))
      .toBe('Choose a target to modify AP');
  });

  it('falls back to action mapping for redirect_attack', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'EFFECT_TARGET_CHOICE', action: 'redirect_attack', isMulti: false }))
      .toBe('Choose an attack target to redirect');
  });

  it('prefers original effect description for generic stat-change choices', () => {
    expect(
      resolveTargetChoiceHeader({
        choiceKind: 'EFFECT_TARGET_CHOICE',
        action: 'modifyAP',
        effectDescription: '[Activate] Rest this Unit. Choose 1 other friendly Unit. It gets AP+1 this turn.',
        isMulti: false,
      }),
    ).toBe('[Activate] Rest this Unit. Choose 1 other friendly Unit. It gets AP+1 this turn.');
  });

  it('falls back to generic single target text when both choiceKind and action are unknown', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'UNKNOWN_KIND', action: 'unknown_action', isMulti: false }))
      .toBe('Choose a Target');
  });

  it('falls back to generic multi target text when both choiceKind and action are unknown', () => {
    expect(resolveTargetChoiceHeader({ choiceKind: 'UNKNOWN_KIND', action: 'unknown_action', isMulti: true }))
      .toBe('Choose Targets');
  });
});
