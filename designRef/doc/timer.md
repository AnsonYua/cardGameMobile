Timer / Turn Countdown

Purpose
- Provide a visible countdown for the active player to take actions.
- If the timer reaches zero, auto-select the first option in a dialog or end turn.
- When any actionable dialog is open, the timer moves into the dialog UI.

Config
- TURN_TIMER_SECONDS: 20
- DIALOG_TIMER_SECONDS: 20

Placement
- Default (no dialog): show a slim progress bar in the header for the active player only.
- Dialog open: show the progress bar inside the dialog (under the title). Header bar is hidden.

Reset Triggers
- Any action that changes game state:
  - Play card (unit/pilot/command/base)
  - Attack unit / attack shield
  - Confirm target choice / blocker choice / pilot target selection
  - Action step confirm / resolve
  - Mulligan and choose-first decisions
- Non-reset actions:
  - Card selection without playing
  - UI-only interactions (scroll, inspect)
  - Cancel selection

Timeout Behavior (Dialog)
- On timer expiration, auto-select the first option in the dialog UI order.
- For target-selection dialogs, auto-select the first available target.

Timeout Behavior (Turn)
- On timer expiration, auto-trigger End Turn.
