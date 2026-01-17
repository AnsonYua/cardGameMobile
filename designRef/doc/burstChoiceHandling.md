• Backend handling summary: BURST choice flow and resolved notifications

  Creation (BURST_EFFECT_CHOICE)

  - Triggered when a shield card with burst is revealed in BurstEffectManager.processShieldCardAttack.
  - BurstChoiceService.enqueueBurstChoice creates the event via EventFactory.createBurstEffectChoiceEvent, sets
    previousPlayerId, and temporarily sets gameEnv.currentPlayer to the defending player to allow the choice.
  - The event is pushed into gameEnv.processingQueue.
  - A notification is emitted with the same id as the processing event:
      - notificationQueue entry type: BURST_EFFECT_CHOICE
      - id: same as processingQueue event id (e.g., burst_choice_4_...)
      - payload includes event (the full choice event).

  Choice resolution (BURST_EFFECT_CHOICE_RESOLVED)

  - API: POST /api/game/player/confirmBurstChoice
  - Payload:

  {
    "gameId": "<game-id>",
    "playerId": "<player-id>",
    "eventId": "<burst_choice_event_id>",
    "confirmed": true | false
  }

  - Backend sets:
      - event.data.userDecisionMade = true
      - event.data.userDecision = "ACTIVATE" if confirmed=true, otherwise "DECLINE".
  - The event is moved to the front of processingQueue to guarantee resolution.
  - gameEnv.processEvents() executes the burst:
      - ACTIVATE: executes burst effect (deploy or activate ability).
      - DECLINE: moves the card from shield to trash.
  - After resolution:
      - currentPlayer is restored to the original player (saved in previousPlayerId).
      - A resolved notification is emitted:
          - type: BURST_EFFECT_CHOICE_RESOLVED
          - id: <eventId>_resolved
          - payload: { playerId, eventId, choiceId, userDecision }

  Expectation in gameEnv

  - While waiting for user input:
      - processingQueue contains a BURST_EFFECT_CHOICE event with data.userDecisionMade = false.
      - currentPlayer is temporarily set to the defending player.
      - notificationQueue contains a BURST_EFFECT_CHOICE entry with matching id.
  - After user decision:
      - processingQueue event marked with userDecisionMade = true, userDecision set.
      - If DECLINE: card removed from shield and added to owner trashArea.
      - currentPlayer restored to original.
      - notificationQueue gets BURST_EFFECT_CHOICE_RESOLVED with eventId of the processed event.




Frontend burst handling summary

  - BURST_EFFECT_CHOICE is handled as a notificationQueue item in the animation pipeline. It shows the
    Burst dialog when the event reaches the front of the queue.
  - Owner (the player who must decide) blocks the queue until they respond.
  - Non‑owner sees the dialog but does not block the queue.
  - BURST_EFFECT_CHOICE_RESOLVED is also handled in the queue and closes the dialog for everyone,
    resuming normal flow (timer bar/action bar restored).

  API call

  - Endpoint: POST /api/game/player/confirmBurstChoice
  - Payload:

  {
    "gameId": "<gameId>",
    "playerId": "<playerId>",
    "eventId": "<burst event id>",
    "confirmed": true | false
  }

  Expected gameEnv structure (notification-driven)

  - gameEnv.notificationQueue is the single ordered source of UI events.
  - Burst choice and resolution appear as separate entries:

  {
    "id": "<eventId>",
    "type": "BURST_EFFECT_CHOICE",
    "payload": {
      "playerId": "<playerId>",
      "event": {
        "id": "<eventId>",
        "type": "BURST_EFFECT_CHOICE",
        "status": "DECLARED",
        "data": {
          "choiceId": "<choiceId>",
          "userDecisionMade": false,
          "availableTargets": [ ... ]
        }
      }
    }
  }

  {
    "id": "<eventId>_resolved",
    "type": "BURST_EFFECT_CHOICE_RESOLVED",
    "payload": {
      "playerId": "<playerId>",
      "eventId": "<eventId>",
      "choiceId": "<choiceId>",
      "userDecision": "ACTIVATE" | "DECLINE"
    }
  }

  Behavior expectations

  - Frontend processes notificationQueue strictly in order.
  - Burst dialog appears only when the BURST_EFFECT_CHOICE notification is processed.
  - Dialog closes when BURST_EFFECT_CHOICE_RESOLVED arrives.
  - No special handling of processingQueue for burst.
