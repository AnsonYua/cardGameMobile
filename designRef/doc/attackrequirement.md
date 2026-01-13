  Background / game rule

  - A unit cannot attack on the same turn it is played.
  - Exception: if a pilot is played in the same turn and the unit + pilot become linked in that slot, the unit may attack immediately.
  - Rested units can never attack, even if the play‑turn exception is active.

  Backend response

  - gameEnv.players[playerId].zones.slotX.unit.canAttackThisTurn
      - Computed by backend and already includes:
          - play‑turn restriction + link exception
          - rested restriction
  - playedThisTurn exists for reference but frontend can ignore it.

  Frontend requirements

  - Only use unit.canAttackThisTurn to decide if the attack button is visible/clickable.
  - If canAttackThisTurn === false, hide or disable the attack button for that slot.
  - If canAttackThisTurn === true, show/enable the attack button.
  - If the slot has no unit, no attack button.

  Notes

  - Do not infer attack eligibility from playedThisTurn or from local state.
  - UI should update immediately when a pilot links in the same turn, because backend will flip canAttackThisTurn to true.