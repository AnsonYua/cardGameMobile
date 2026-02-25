# Frontend Effect Parity Audit

Date: 2026-02-25
Scope: frontend local rule evaluators vs backend card/effect semantics from:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd02Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd03Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st01Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st02Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st03Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st04Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st05Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st06Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st07Card.json`
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st08Card.json`

## Inventory Summary
- `allow_attack_target` actions discovered in card data: 17
- `allow_attack_target` using dynamic placeholders (`SOURCE_AP`/`SOURCE_LEVEL`): 2
- `restrict_attack` rules discovered in card data: 5
  - `disallow: "player"`: 4
  - `requires.type: "friendly_unit_deployed_this_turn"`: 1

## Findings
| cardId / pattern | frontend module | mismatch type | severity | fix status | regression coverage |
|---|---|---|---|---|---|
| `GD03-035` (`ap: "<=SOURCE_AP"`) | `src/phaser/controllers/attackTargetPolicy.ts` | Dynamic placeholder comparison parsing drift caused valid active targets to be excluded. | P1 | Fixed | `tests/attackTargetPolicy.test.ts`, `tests/comparisonFilter.test.ts` |
| `ST07-011` (`level: "<=SOURCE_LEVEL"`) | `src/phaser/controllers/attackTargetPolicy.ts` | Dynamic level placeholder parsing drift risk due local parser divergence. | P1 | Fixed | `tests/attackTargetPolicy.test.ts`, `tests/comparisonFilter.test.ts` |
| `GD02-018`/`GD02-035`/`GD02-066`/`ST01-009` (`restrict_attack` with `disallow: "player"`) | `src/phaser/controllers/actionBar/slotAttackProvider.ts` | Attack shield button could appear despite backend player-attack restriction. | P2 | Fixed | `tests/slotAttackProvider.test.ts` |
| `GD03-081` (`restrict_attack` with `requires.type: friendly_unit_deployed_this_turn`) | `src/phaser/controllers/actionBar/slotAttackProvider.ts` | Attack button could be enabled when backend requirement was unmet. | P1 | Fixed | `tests/slotAttackProvider.test.ts` |
| `allow_attack_target` extra params (`notes`, `excludeSource`, future keys) | `src/phaser/controllers/attackTargetPolicy.ts` | Unknown parameters could be silently ignored without visibility during QA. | P3 | Guardrail added | manual QA via `debug.effects` warning |

## Implemented Changes
1. Added shared comparison utility: `src/phaser/utils/comparisonFilter.ts`.
2. Migrated attack-target rule comparison to shared utility in `src/phaser/controllers/attackTargetPolicy.ts`.
3. Added dev guardrail warning for unknown `allow_attack_target` parameter keys (`debug.effects` flag).
4. Extended slot action gating to mirror backend `restrict_attack` semantics in `src/phaser/controllers/actionBar/slotAttackProvider.ts`.
5. Added/extended tests:
   - `tests/comparisonFilter.test.ts`
   - `tests/slotAttackProvider.test.ts`
   - existing `tests/attackTargetPolicy.test.ts` dynamic token coverage retained.

## Known Limitations
1. Frontend local evaluators are still UX hints; backend remains authoritative for final rule enforcement.
2. Unknown `allow_attack_target` keys are warned only when `debug.effects=1` (URL/localStorage) is enabled.
3. This audit focuses on functional parity for button/target legality, not animation or display text parity.
