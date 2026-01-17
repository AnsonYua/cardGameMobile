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
