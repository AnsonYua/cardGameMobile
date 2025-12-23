## Attack → Blocker → Action-Step Flow

1. **Declare attack** – the client posts `/api/game/player/playerAction` with `actionType: "attackUnit"` plus attacker/target UIDs. The backend records it as a `PLAYER_ACTION` event, resolves any attack-phase effects, and either:
   - adds a `BLOCKER_CHOICE` entry to `processingQueue` (if blockers exist) while `currentBattle` stays `undefined`, or
   - immediately populates `gameEnv.currentBattle` with `status: "ACTION_STEP"` (no blockers).

2. **Frontend after the POST** – disable attack buttons while the call is in flight; when it succeeds, wait for the next poll and let the new `gameEnv` snapshot drive the UI.

3. **Natural flow**
   - With blockers: player → blocker selection phase → action step → battle summary.
   - Without blockers: player → action step → battle summary.

### Polling strategy

- Poll `/api/game/player/:playerId?gameId=...` every second and treat the response as immutable truth.
- After each snapshot:
  - Replace local state (slots, hand, shields, etc.) entirely.
  - Inspect `processingQueue` for the first entry whose `status !== "RESOLVED"`:
    * If it is `BLOCKER_CHOICE`, the defender takes over the blocker flow while the attacker sees a waiting indicator.
  - If no active blocker queue entry exists but `currentBattle` is populated with `status === "ACTION_STEP"`, render the action-step UI for anyone whose `confirmations[playerId] === false`.

## Blocker selection phase

- Triggered when `processingQueue[0].type === "BLOCKER_CHOICE"` and `playerId` matches the defender.
- `availableTargets` describes which slots may block.
- The phase:
  - highlights the allowed slots,
  - gates slot interactions through a blocker-specific controller,
  - prevents the EffectChoice dialog from opening automatically (the action bar launches it instead, and the dialog exposes a close button so it can be dismissed and reopened).
- The action bar offers two defender controls:
  1. **Choose Blocker** – opens EffectChoice; selecting a slot submits `/api/game/player/confirmBlockerChoice` with the matching target payload.
  2. **Skip Blocker Phase** – submits the same endpoint with `selectedTargets: []` to decline blocking.
- The blocker dialog stays open until the POST succeeds; afterwards, wait for the next poll to either enter action-step or return to normal play if the attack fizzled.
- When the defender is the opponent, the action bar shows a waiting state instead of buttons.

### Blocking payload

```json
{
  "gameId": "733760d3-9ea2-4e88-b332-09085e5900e1",
  "playerId": "playerId_2",
  "eventId": "blocker_choice_12345",
  "notificationId": "unit_attack_declared_1766407730182_k1ldjajva",
  "selectedTargets": [
    {
      "carduid": "ST01-010_ffcc...",
      "zone": "frontRowSlotA",
      "playerId": "playerId_2"
    }
  ]
}
```

- `notificationId` is the last `UNIT_ATTACK_DECLARED` entry in `gameEnv.notificationQueue`; include it if available.
- An empty `selectedTargets` array signals the defender explicitly skipped blocking.
- After a blocker has been chosen, the relevant `UNIT_ATTACK_DECLARED` notification includes:
  - `forcedTargetCarduid`
  - `forcedTargetZone`
  - `forcedTargetPlayerId`
  The attack indicator must redraw toward that forced slot whenever those fields change, even if the notification ID stays the same.

## Action-step phase

- Begins once blocker choices (if any) resolve and `processingQueue` no longer exposes a `BLOCKER_CHOICE` entry. At this point, `currentBattle` should be present with `status: "ACTION_STEP"`; if it is missing, treat it as an error and show a message.
- While `currentBattle.confirmations[currentPlayer] === false`:
  - The action bar shows only a **Skip Action-Step** button (which POSTs `/api/game/player/playerAction` with `actionType: "confirmBattle"`).
  - All cards referenced in `currentBattle.actionTargets[currentPlayer]` become clickable/interactive; cards not in that array should not be selectable.
  - Selecting a card reveals context-sensitive controls:
    * **Trigger Card Effect** – if the card resides in hand, call the play-card action; if in a slot or base, call the appropriate placeholder handler (pilot or unit effect buttons).
    * **Cancel** – deselects the current card and reverts the action bar to the **Skip Action-Step** button.
    * For slot-based cards where both pilot and unit present effects, expose separate **Trigger Pilot Effect** and **Trigger Unit Effect** buttons (with placeholder callbacks).
- Once `currentBattle.confirmations[currentPlayer] === true`, replace the buttons with a waiting indicator telling the player to wait for the opponent (with an animation, e.g., pulsing text).
- The UI should never allow new attacks, base plays, etc. while the action step remains unresolved unless `processingQueue` explicitly allows it via `needsPlayerInput()` semantics.
