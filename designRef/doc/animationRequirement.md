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



3. when player select its only unit and trigger attack , it should show a prominent visual attack indicator appears.
A thick, glowing arrow (bright red or vibrant yellow with slight transparency) draws itself smoothly from the center of the attacking player's unit card upward to the center of the targeted opponent unit card.
The arrow features a sharp, filled triangular arrowhead at the target end, clearly pointing directly at the defender.
The line pulses gently or has a subtle glow effect to emphasize the attack declaration, making it immediately obvious which unit is attacking which opponent.
The arrow remains visible throughout the attack resolution process, providing clear feedback, and then fades away or disappears once the attack is complete or canceled. this animation should control by frontend action it should control by api and both player (current player and opponent) should be able to see it. the direction of arrow for the opponent should be different.

gameEnv.notificationQueue[
            {
                "id": "unit_attack_declared_1766128857886_5rjb3p87v",
                "type": "UNIT_ATTACK_DECLARED",
                "metadata": {
                    "timestamp": 1766128857886,
                    "expiresAt": 1766128860886,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "normal"
                },
                "payload": {
                    "gameId": "0dba3406-e7e8-4120-ad52-2699d2fb1a89",
                    "attackingPlayerId": "playerId_2",
                    "defendingPlayerId": "playerId_1",
                    "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
                    "attackerName": "GM",
                    "attackerSlot": "slot1",
                    "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
                    "targetName": "Gundam Aerial (Permet Score Six)",
                    "targetSlotName": "slot1",
                    "fromBurst": false,
                    "timestamp": 1766128857886
                }
            }
]


4.
{
                "id": "card_stat_modified_1766926053793_8hq4ayrsc",
                "type": "CARD_STAT_MODIFIED",
                "metadata": {
                    "timestamp": 1766926053793,
                    "expiresAt": 1766926056793,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "normal"
                },
                "payload": {
                    "playerId": "playerId_1",
                    "carduid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
                    "cardId": "ST01-009",
                    "cardName": "Zowort",
                    "zone": "slot3",
                    "stat": "modifyAP",
                    "delta": -3,
                    "modifierValue": -3,
                    "timestamp": 1766926053793
                }
            }
When CARD_STAT_MODIFIED appears in notificationQueue, trigger AP/HP badge pulse animation on the target slot.
Resolve slot by payload.playerId + payload.zone (slot id). If slot cannot be resolved, fallback by payload.carduid lookup.
Do not auto-pulse on AP/HP changes without this notification.
