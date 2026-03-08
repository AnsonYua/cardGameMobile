# Dialog Inventory and Trigger Map

## Summary

This document maps the current Phaser board dialogs to the event or flow that opens them and explains the gameplay meaning behind each one.

There are three broad dialog categories:

- decision dialogs opened because the player must choose something for an effect or action flow
- informational or status dialogs opened by phase changes, notifications, or room state
- utility dialogs opened directly from UI, not by a gameplay effect

Primary wiring lives in:

- [dialogFactories.ts](/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/scene/dialogFactories.ts)
- [NotificationHandlers.ts](/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/animations/NotificationHandlers.ts)
- the choice and flow controllers under `src/phaser/controllers`

## Important interpretation rules

- In this frontend, "effect-triggered" usually means notification-driven, not effect-id-driven.
- `TARGET_CHOICE`, `PROMPT_CHOICE`, and `OPTION_CHOICE` are generic envelopes. The exact effect is inferred from payload and context. `scry_top_deck` is option-choice only and is not part of the prompt flow.
- `TutorTopDeckRevealDialog` is a specialized presentation for a subset of `PROMPT_CHOICE` flows, not a unique backend notification type.
- `AbilityChoiceDialog`, `PilotDesignationDialog`, and `PilotTargetDialog` are local frontend flow dialogs. They are opened by action orchestration, not directly by backend notification types.
- For most effect-choice dialogs, the real backend condition is: an unresolved event exists in `processingQueue`, a persistent notification with the same event id exists in `notificationQueue`, `userDecisionMade` is still `false`, and the local player owns that event.

## Decision dialogs

### `PromptChoiceDialog`

- Trigger: `PROMPT_CHOICE`
- Backend condition: backend creates a `PROMPT_CHOICE` event and emits a persistent `PROMPT_CHOICE` notification for the same event id
- Gameplay meaning: generic prompt-based effect choice, usually "continue", yes/no, or choose-one-branch behavior
- Submit path: `confirmOptionChoice`
- Extra backend condition: `userDecisionMade` must still be `false`
- Manual test cards:
  - deploy-effect ordering flows on cards that have multiple eligible `[Deploy]` effects
  - this dialog is effect-family driven, not card-id driven; verify from backend `PROMPT_CHOICE` context rather than assuming a specific card id

### `TutorTopDeckRevealDialog`

- Trigger: `PROMPT_CHOICE` with tutor-top-deck or deploy-from-top-deck review context
- Backend condition: same `PROMPT_CHOICE` event/notification flow as `PromptChoiceDialog`
- Extra backend context: `event.data.context` carries tutor/deploy-from-top-deck review metadata
- Gameplay meaning: reveal/review the top deck during tutor-style flows, then continue
- Notes: this replaces the generic prompt dialog only for matching prompt contexts
- Manual test cards:
  - `tutor_top_deck` cards such as `ST06-012`, `GD02-018`, `GD02-093`, `GD01-048`, `GD01-112`, `GD01-276`, `ST03-020`, `ST06-008`
  - `deploy_from_top_deck` cards such as `GD01-133` and `GD02-038`
  - verify from `initialGameEnv` and card effect action, not scenario notes

### `OptionChoiceDialog`

- Trigger: `OPTION_CHOICE`
- Backend condition: backend creates an `OPTION_CHOICE` event and emits a persistent `OPTION_CHOICE` notification for the same event id
- Gameplay meaning: choose one effect branch, mode, or result from `availableOptions`
- Extra backend condition: unresolved choice with `userDecisionMade === false`
- Manual test cards:
  - `GD01-039` `[Deploy]` `scry_top_deck`
    - scenarios:
      - [deploy_scry_top_1_choose_top.json](/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-039/deploy_scry_top_1_choose_top.json)
      - [deploy_scry_top_1_choose_bottom.json](/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-039/deploy_scry_top_1_choose_bottom.json)
  - `GD02-025` `[Deploy]` sequence containing `scry_top_deck`
    - scenario:
      - [deploy_scry_top_1_choose_bottom_manual_flow.json](/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD02/GD02-025/deploy_scry_top_1_choose_bottom_manual_flow.json)
  - `ST06-010` `[During Link][Attack]` `scry_top_deck`
    - scenario:
      - [burst_add_to_hand_then_during_link_attack_scry_top_or_bottom_if_clan_unit_in_play_manual_flow.json](/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/ST06/ST06-010/burst_add_to_hand_then_during_link_attack_scry_top_or_bottom_if_clan_unit_in_play_manual_flow.json)
  - `GD03-097` `[During Link][Once per Turn][Battle Destroy]` `scry_top_deck`
    - scenario:
      - [during_link_once_per_turn_battle_destroy_scry2_top1_trash1.json](/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD03/GD03-097/during_link_once_per_turn_battle_destroy_scry2_top1_trash1.json)
  - `GD02-104` `[Main]` sequence containing `scry_top_deck`
    - card exists in backend data; use card data and `initialGameEnv` rather than trusting scenario notes if you author a new case

#### `scry_top_deck` display variants

- Core backend rule from `ScryTopDeckManager`:
  - interactive when `choice = "top_or_bottom"` and actual looked-card count is `1`
  - interactive when `keep = 1` and actual looked-card count is greater than `1`
  - otherwise backend auto-resolves and no chooser dialog appears
- Display type 1: single-card preview with `Top` / `Bottom` buttons
  - backend shape: `count = 1`, looked count = `1`, `choice = "top_or_bottom"`
  - backend emits text options `TOP` and `BOTTOM`
  - frontend still shows the card because it reconstructs the looked card from `SCRY_TOP_DECK` context through `OptionChoiceCardResolver`, then `TopBottomChoiceDetector` switches the dialog into the special top/bottom layout
  - good test cards: `GD01-039`, `GD02-025`, `ST06-010`
- Display type 2: multi-card card-choice layout
  - backend shape: looked count `> 1` and `keep = 1`
  - backend emits one `KEEP_CARD` option per looked card with card identity
  - frontend renders card plates/grid and the player chooses which card stays on top
  - good test cards: `GD03-097`, `GD02-104`, `ST02-015`
- Display type 3: no dialog
  - happens when the effect is not interactive for the current board/deck state, such as empty looked set or unsupported `count`/`keep` shape
- Why `top_or_bottom` and `top_or_trash` feel different:
  - `top_or_bottom` commonly becomes a one-card position choice
  - `top_or_trash` often appears in multi-card `keep = 1` flows, so the UI is “choose which card stays” and the non-chosen cards are moved automatically by backend using `restDestination = "trash"`

### `TokenChoiceDialog`

- Trigger: token choice notification normalized by `TokenChoiceFlowManager`
- Backend condition: backend creates a `TOKEN_CHOICE` event and emits a persistent `TOKEN_CHOICE` notification for the same event id
- Gameplay meaning: choose which token to play or resolve
- Current dialog header: `Choose token to play`
- Extra backend condition: notification is not completed and the choice has not been decided yet

### `EffectTargetDialog`

- Trigger: `TARGET_CHOICE`
- Backend condition: backend creates a `TARGET_CHOICE` event and emits a persistent `TARGET_CHOICE` notification for the same event id
- Gameplay meaning: choose one or more valid targets for an effect
- Backend data shaping the dialog:
  - `availableTargets`
  - `effect.optional` -> `allowEmptySelection`
  - `effect.target.count` -> single-target vs multi-target selection
  - `effect.action` and context -> header text / target-choice kind
- Single-target vs multi-target behavior is driven by `targetCount`
- Current target families inferred from title/action mapping:
  - discard from hand
  - move hand card to deck bottom
  - move trash card to deck
  - exile from trash
  - destroy
  - return to hand
  - add to hand
  - rest
  - set active
  - restrict attack
  - prevent battle damage
  - prevent set active next turn
  - allow attack target
  - redirect attack
  - damage
  - damage shield
  - heal
  - modify AP
  - modify HP
  - deploy from hand
  - pair from hand
  - pair from trash
  - grant keyword
  - grant breach
  - prevent shield damage
  - scry top deck
  - add basic energy
  - add extra energy
  - conditional token deploy

### `BurstChoiceDialog`

- Trigger: `BURST_EFFECT_CHOICE`
- Backend condition: backend creates a `BURST_EFFECT_CHOICE` event and emits a persistent `BURST_EFFECT_CHOICE` notification for the same event id
- Gameplay meaning: resolve one burst opportunity, typically activate or decline a burst effect

### `BurstChoiceGroupDialog`

- Trigger: `BURST_EFFECT_CHOICE_GROUP`
- Backend condition: backend emits `BURST_EFFECT_CHOICE_GROUP` when multiple burst choice events exist together and must be grouped for ordered resolution
- Gameplay meaning: multiple burst opportunities are pending; choose which burst event to resolve first, then continue into the single burst dialog

### `AbilityChoiceDialog`

- Trigger: local action flow
- Backend condition: none directly
- Gameplay meaning: the selected card has multiple activatable abilities, and the player must choose which ability/effect to use

### `PilotDesignationDialog`

- Trigger: local engine event `PILOT_DESIGNATION_DIALOG`
- Backend condition: none directly
- Gameplay meaning: choose whether a dual-use card is played as a pilot or as a command

### `PilotTargetDialog`

- Trigger: local engine event `PILOT_TARGET_DIALOG`
- Backend condition: none directly
- Gameplay meaning: choose the target unit slot for pilot placement or pilot designation

### `MulliganDialog`

- Trigger: `INIT_HAND`
- Backend condition: game setup finishes opening hand draw and emits `INIT_HAND`
- Gameplay meaning: start-of-game mulligan decision
- Notes: not a card effect

### `ChooseFirstPlayerDialog`

- Trigger: `CHOOSE_FIRST_PLAYER`
- Backend condition: backend reaches the turn-order selection step and emits `CHOOSE_FIRST_PLAYER` for the chooser
- Gameplay meaning: pre-game turn-order choice
- Notes: not a card effect

## Informational and status dialogs

### `TurnOrderStatusDialog`

- Trigger: `CHOOSE_FIRST_PLAYER` when the opponent is deciding, plus generic status usage
- Backend condition: backend emits `CHOOSE_FIRST_PLAYER`, but the local player is not the decision owner
- Gameplay meaning: passive waiting/status dialog

### `waitingOpponentDialog`

- Trigger: snapshot state through `DialogCoordinator`
- Backend condition: none directly from notifications
- Gameplay meaning: waiting for another player or room state progression

### `mulliganWaitingDialog`

- Trigger: snapshot state through `DialogCoordinator` after the local player submits mulligan during redraw phase
- Backend condition: indirect; the local player already answered mulligan, and the backend state is still in redraw/mulligan flow waiting for the opponent or next transition
- Gameplay meaning: passive waiting for the opponent or backend phase completion

### `PhaseChangeDialog`

- Trigger: `PHASE_CHANGED`
- Backend condition: backend calls phase notification emit and sends `PHASE_CHANGED`
- Gameplay meaning: phase transition announcement

### `CoinFlipOverlay`

- Trigger: `CHOOSE_FIRST_PLAYER`
- Backend condition: same `CHOOSE_FIRST_PLAYER` notification flow as turn-order selection
- Gameplay meaning: pre-game turn-order overlay

### `DrawPopupDialog`

- Trigger: draw/reveal notifications such as:
  - `CARD_DRAWN`
  - `CARDS_DRAWN`
  - `TOP_DECK_VIEWED`
  - `CARDS_MOVED_TO_DECK_BOTTOM`
- Backend condition: backend emits those informational notifications during draw, tutor-top-deck, or deploy-from-top-deck flows
- Gameplay meaning: informational popup for draw/reveal style events, not a player-choice dialog

### `TargetNoticeDialog`

- Trigger: `PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED`
- Backend condition: backend successfully applies the prevent-set-active-next-turn status effect to at least one valid target and emits `PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED`
- Gameplay meaning: informational notice that a "cannot be set active next turn" style effect has been granted or applied

### `GameOverDialog`

- Trigger: `GAME_ENDED`
- Backend condition: backend ends the game through `GameEndManager.endGame` and emits persistent `GAME_ENDED`
- Gameplay meaning: end-of-game state

### `ErrorDialog`

- Trigger: local error handling from action and choice controllers
- Backend condition: none
- Gameplay meaning: reports frontend or interaction failures, not gameplay effects

## Utility dialogs

### `TrashAreaDialog`

- Trigger: direct UI open action
- Backend condition: none
- Gameplay meaning: inspect trash contents
- Notes: not notification-driven and not effect-triggered

## Quick gameplay mapping

- Effects that say "choose target/card/unit/slot" usually become `EffectTargetDialog`
- Effects that say "choose one option/branch/result" usually become `OptionChoiceDialog` or `PromptChoiceDialog`
- Interactive `scry_top_deck` choices use `OptionChoiceDialog` only
- Token selection effects become `TokenChoiceDialog`
- Burst timing resolution becomes `BurstChoiceDialog` or `BurstChoiceGroupDialog`
- Multiple activatable abilities on a selected card become `AbilityChoiceDialog`
- Pilot assignment flows become `PilotDesignationDialog` followed by `PilotTargetDialog`

## Backend-only summary

- Choice dialogs are usually backed by a declared event in `processingQueue` plus a persistent notification with the same id in `notificationQueue`
- The dialog remains open only while the event is unresolved and owned by the local player
- `AbilityChoiceDialog`, `PilotDesignationDialog`, and `PilotTargetDialog` are local-only dialogs; they do not have a dedicated backend notification

## Known manual test cards for dialog checks

- Easiest `OptionChoiceDialog` check:
  - `GD01-039`
  - reason: simple deploy-triggered `scry_top_deck`, no burst or link setup required
- Good `PromptChoiceDialog` family checks:
  - `tutor_top_deck`: `ST06-012`, `GD01-048`, `GD02-018`, `GD02-093`
  - `deploy_from_top_deck`: `GD01-133`, `GD02-038`
- Good linked/battle `OptionChoiceDialog` checks:
  - `ST06-010`
  - `GD03-097`

## Notes on using scenarios

- Prefer cards and scenarios whose `initialGameEnv` already contains the required preconditions.
- Do not trust scenario `notes` as the source of truth if they are outdated.
- Use these as the primary truth when running manually:
  - the card effect in backend card data
  - the authored `initialGameEnv`
