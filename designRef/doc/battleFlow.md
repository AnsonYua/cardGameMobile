1. when player trigger Attack (to unit /shield) → it will go to Blocker selection phase(if opponent have any block) → then go to Action-Step Flow

  - Declare attack
      - POST /api/game/player/playerAction

        {
          "playerId": "playerId_1",
          "gameId": "733760d3-9ea2-4e88-b332-09085e5900e1",
          "actionType": "attackUnit",
          "attackerCarduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
          "targetPlayerId": "playerId_2",
          "targetUnitUid": "ST01-005_be13f9a5-9fc9-4e3b-a9b2-fdf999d9f63d"
        }
      - Backend creates a PLAYER_ACTION event. GameEngine.checkAndExecuteBlockerAction runs attack-phase effects, then examines blockers via
        BlockerChoiceManager.processAttackWithBlockerChoice.
      - If no blockers: BattlePhaseManager.startBattle runs immediately; currentBattle appears with status: 'ACTION_STEP'.
      - If blockers exist: a BLOCKER_CHOICE event is appended to processingQueue (status: 'DECLARED', playerId = defendingPlayer). currentBattle stays
        undefined until that event resolves.
  - Frontend handling after attack POST
      1. Disable attack buttons until the response arrives; if error, show it and re-enable controls.
      2. On success, wait for the next poll (see below) and drive UI from gameEnv.processingQueue + currentBattle.

  ———

  Polling for game state

  - GET /api/game/player/:playerId?gameId=.... Treat gameEnv as immutable state:
      - Replace your local game state with the response; do not merge.
      - processingQueue: inspect the first entry whose status !== 'RESOLVED'.
          - if there is BLOCKER_CHOICE , player should show waiting for opponent in actionbuttonbar and opponent should show a button "skip blocker step".
      - currentBattle: when present and status === 'ACTION_STEP', show battle info and confirm/skip buttons for any player whose
        confirmations[playerId] === false, but only if the queue head isn’t a blocking choice.

  ———

  Resolving blocker choice

  - UI trigger: processingQueue[0].type === 'BLOCKER_CHOICE' and playerId matches the defending user. availableTargets in the event tells you which units can block.
  - This enters the blocker selection phase. Slots that can block are highlighted, but the EffectChoice dialog does not show automatically; instead the action button bar manages the interaction.
  - Action bar buttons for the defender:
      1. **Choose Blocker** – opens the EffectChoice dialog (with a close button) to pick one of the availableTargets. Closing the dialog before picking simply returns to the blocker phase so the button can be pressed again. Selecting a defender unit triggers `confirmBlockerChoice` with the matching target payload.
      2. **Skip Blocker Phase** – providers the same behavior as submitting `confirmBlockerChoice` with an empty `selectedTargets` array, rejecting all blockers.
  - When the defender is not the current player, the action bar shows a waiting state instead. Slots remain unclickable until the blocker event resolves.
  - API call: POST /api/game/player/confirmBlockerChoice

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
      - `notificationId` should be the last entry in `gameEnv.notificationQueue` (typically the `UNIT_ATTACK_DECLARED` event that triggered the blocker choice). If unavailable, it may be omitted but prefer supplying it.
      - if opponent click "skip blocker step" , selectedTargets will be an empty array to decline blocking.
      - When blocking resolves, the attacking notification will contain `forcedTargetCarduid`, `forcedTargetZone`, and `forcedTargetPlayerId`. The frontend should point the attack indicator to these values if present so the arrow follows the forced target.
  - Frontend should keep the blocker modal open until the POST succeeds. After success, wait for the next poll: the BLOCKER_CHOICE event disappears,
    and either currentBattle appears (action step) or, if the attack fizzled, the queue may already be empty.

  - After the blocker choice resolves, the attacking notification is updated with `forcedTargetCarduid`, `forcedTargetZone`, and `forcedTargetPlayerId`.
    When these fields exist, the frontend should always point the attack indicator to the forced target by rerunning `this.updateAttackIndicatorFromNotifications(raw, slots, positions)` even if the notification ID hasn’t changed.

    Example notification payload:

    {
      "id": "unit_attack_declared_1766409009819_5r3mojkqy",
      "type": "UNIT_ATTACK_DECLARED",
      "metadata": {
        "timestamp": 1766409009819,
        "expiresAt": 1766409012819,
        "requiresAcknowledgment": false,
        "frontendProcessed": false,
        "priority": "normal"
      },
      "payload": {
        "gameId": "c5667f86-be5e-477f-8aaf-d3aa6fcd2b39",
        "attackingPlayerId": "playerId_2",
        "defendingPlayerId": "playerId_1",
        "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
        "attackerName": "GM",
        "attackerSlot": "slot1",
        "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
        "targetName": "Gundam Aerial (Permet Score Six)",
        "targetSlotName": "slot1",
        "fromBurst": false,
        "timestamp": 1766409009819,
        "forcedTargetCarduid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
        "forcedTargetZone": "slot3",
        "forcedTargetPlayerId": "playerId_1"
      }
    }
