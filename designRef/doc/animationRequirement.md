1.when a new card is play in gameEnv.notificationQueue it will have  "type": "CARD_PLAYED" card is playAs pilot/unit,
 payload."isCompleted": true, if payload.playerId = {currentPlayer} and payload.playerId and reason = hand. use carduid search again the slot and play animation moving the card from hand to that slot with PlayCardAnimationManager.ts. if payload.playerId = {opponent}, just move from top to slot.

 if card is playAs base, just move to base area. 
 if card is playAs command , just move to center of screen in the end of animation instead of a specific slot
{
    "success": true,
    "gameId": "f90088c2-15dd-4a71-bf80-d3949e76dbba",
    "gameEnv": {
        "phase": "MAIN_PHASE",
        "playerId_1": "playerId_1",
        "playerId_2": "playerId_2",
        "gameStarted": true,
        "firstPlayer": 0,
        "notificationQueue": [
            {
                "id": "phase_change_1757855224403_k8pew72n0",
                "type": "PHASE_CHANGE",
                "metadata": {
                    "timestamp": 1757855224403,
                    "expiresAt": 1757855227403,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "high"
                },
                "payload": {
                    "fromPhase": "DRAW_PHASE",
                    "toPhase": "MAIN_PHASE",
                    "reason": "Auto-advance: No unacknowledged card draw events",
                    "playerId": "playerId_1"
                }
            },
            {
                "id": "phase_change_1757855285135_lc6ue32j1",
                "type": "PHASE_CHANGE",
                "metadata": {
                    "timestamp": 1757855285135,
                    "expiresAt": 1757855288135,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "high"
                },
                "payload": {
                    "fromPhase": "DRAW_PHASE",
                    "toPhase": "MAIN_PHASE",
                    "reason": "Auto-advance: No unacknowledged card draw events",
                    "playerId": "playerId_1"
                }
            },
            {
                "id": "base_destroyed_1758009288063_cth0g8qok",
                "type": "BASE_DESTROYED",
                "metadata": {
                    "timestamp": 1758009288063,
                    "expiresAt": 1758009291063,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "normal"
                },
                "payload": {
                    "defendingPlayerId": "playerId_2",
                    "attackingPlayerId": "playerId_1",
                    "attackerSlot": "slot1",
                    "damage": 3,
                    "totalDamage": 3,
                    "baseHP": 0,
                    "baseDestroyed": true,
                    "destroyedCard": {
                        "carduid": "base_default",
                        "cardId": "base_default",
                        "name": "Unknown Base"
                    }
                }
            },
            {
                "id": "phase_change_1758009291230_ojilkjy1k",
                "type": "PHASE_CHANGE",
                "metadata": {
                    "timestamp": 1758009291230,
                    "expiresAt": 1758009294230,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "high"
                },
                "payload": {
                    "fromPhase": "DRAW_PHASE",
                    "toPhase": "MAIN_PHASE",
                    "reason": "Auto-advance: No unacknowledged card draw events",
                    "playerId": "playerId_2"
                }
            },
            {
                "id": "card_played_1765964469749_x7551sjb2",
                "type": "CARD_PLAYED",
                "metadata": {
                    "timestamp": 1765964469749,
                    "expiresAt": 1765964472749,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "normal"
                },
                "payload": {
                    "carduid": "ST01-016_c767a64f-9654-4b4f-bd0d-a24967461dde222",
                    "playerId": "playerId_2",
                    "playAs": "base",
                    "reason": "hand",
                    "fromBurst": false,
                    "isCompleted": true,
                    "timestamp": 1765964469749
                }
            }
        ],
        "lastEventId": 0
    }
}
2. we should not have any animation when SetScenario button is clicked