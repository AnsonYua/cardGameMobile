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
  - `notificationQueue` is for UI/animations and should not be used as the authoritative signal for whether blocker choice is still pending.

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
- Backend resolution contract:
  - After `/api/game/player/confirmBlockerChoice` succeeds, the blocker choice event must no longer be exposed as pending input.
  - Concretely: the corresponding `processingQueue` entry must either be removed or have `status: "RESOLVED"` (and `data.userDecisionMade: true` if that field exists).
  - If a `BLOCKER_CHOICE` notification is included in `notificationQueue`, it must also reflect the resolved state (or a `BLOCKER_CHOICE_RESOLVED` notification should be emitted) so the frontend does not re-open the choice on later polls.

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
  - `battleEnd`
The attack indicator must redraw toward that forced slot whenever those fields change, even if the notification ID stays the same; however, once `battleEnd === true` the arrow should disappear and only return when the field is missing or explicitly `false`.

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


The notification payload now includes `battleEnd` when the attack/battle has resolved, which means the arrow should stay hidden anytime `battleEnd === true` (draw it only while the field is missing or set to `false`). For example:

```json
{
  "id": "unit_attack_declared_1766478365693_aep7jma1n",
  "type": "UNIT_ATTACK_DECLARED",
  "metadata": {
    "timestamp": 1766478365693,
    "expiresAt": 1766478368693,
    "requiresAcknowledgment": false,
    "frontendProcessed": false,
    "priority": "normal"
  },
  "payload": {
    "gameId": "b76d4e53-bb69-464c-9b98-19596149f0f6",
    "attackingPlayerId": "playerId_2",
    "defendingPlayerId": "playerId_1",
    "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
    "attackerName": "GM",
    "attackerSlot": "slot1",
    "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
    "targetName": "Gundam Aerial (Permet Score Six)",
    "targetSlotName": "slot1",
    "fromBurst": false,
    "timestamp": 1766478365693,
    "battleEnd": true
  }
}
```

below is the noticationQueue when player attacking shield area/base,
when u see the "targetName" is  "Base" or "targetName": "Shield Area", u should draw the attackIndicator point to base / top card of shield  
{
    "id": "unit_attack_declared_1766568601442_rav81179z",
    "type": "UNIT_ATTACK_DECLARED",
    "metadata": {
        "timestamp": 1766568601442,
        "expiresAt": 1766568604442,
        "requiresAcknowledgment": false,
        "frontendProcessed": false,
        "priority": "normal"
    },
    "payload": {
        "gameId": "8af90047-e4a1-4c31-9ec7-ab5135689ff1",
        "attackingPlayerId": "playerId_2",
        "defendingPlayerId": "playerId_1",
        "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
        "attackerName": "GM",
        "attackerSlot": "slot1",
        "targetName": "Base",
        "targetSlotName": "base",
        "fromBurst": false,
        "timestamp": 1766568601442
    }
}

-after both player currentBattle.confirmation.both player = true . backend will do resolve battle and end the battle. it will generate a object like this in noticationQueue.
{
                "id": "battle_resolved_1766726059749_whspupshy",
                "type": "BATTLE_RESOLVED",
                "metadata": {
                    "timestamp": 1766726059749,
                    "expiresAt": 1766726062749,
                    "requiresAcknowledgment": false,
                    "frontendProcessed": false,
                    "priority": "normal"
                },
                "payload": {
                    "battleType": "attackUnit",
                    "attackingPlayerId": "playerId_2",
                    "defendingPlayerId": "playerId_1",
                    "attackNotificationId": "unit_attack_declared_1766725975903_ziej6bkiu",
                    "attacker": {
                        "playerId": "playerId_2",
                        "slot": "slot1",
                        "zoneType": "slot",
                        "unit": {
                            "carduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
                            "cardId": "ST01-005",
                            "cardData": {
                                "id": "ST01-005",
                                "name": "GM",
                                "cardType": "unit",
                                "color": "Blue",
                                "level": 2,
                                "cost": 1,
                                "zone": [
                                    "Space",
                                    "Earth"
                                ],
                                "traits": [
                                    "Earth Federation"
                                ],
                                "link": [],
                                "ap": 2,
                                "hp": 2,
                                "effects": {
                                    "description": [],
                                    "rules": []
                                }
                            },
                            "placedAt": 1759418650840,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 2,
                            "originalHP": 2,
                            "isFirstPlay": true,
                            "damageReceived": 2,
                            "continueModifyAP": 2,
                            "continueModifyHP": 0
                        },
                        "pilot": {
                            "carduid": "ST01-010_3a548657-cf14-4304-ae88-65130fc9b6fb",
                            "cardId": "ST01-010",
                            "cardData": {
                                "id": "ST01-010",
                                "name": "Amuro Ray",
                                "cardType": "pilot",
                                "color": "Blue",
                                "level": 4,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team",
                                    "Newtype"
                                ],
                                "link": [],
                                "ap": 2,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "【Burst】Add this card to your hand.",
                                        "【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_add_to_hand",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "addToHand"
                                        },
                                        {
                                            "effectId": "paired_rest_medium_hp",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "hp": "<=5"
                                                },
                                                "count": 1
                                            },
                                            "action": "rest"
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1759418653679,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 2,
                            "originalHP": 1,
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 4,
                            "totalOriginalHP": 3,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 2,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 2,
                            "totalAP": 6,
                            "totalHP": 1,
                            "isRested": false
                        }
                    },
                    "target": {
                        "playerId": "playerId_1",
                        "slot": "slot3",
                        "zoneType": "slot",
                        "unit": {
                            "carduid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
                            "cardId": "ST01-009",
                            "cardData": {
                                "id": "ST01-009",
                                "name": "Zowort",
                                "cardType": "unit",
                                "color": "White",
                                "level": 2,
                                "cost": 2,
                                "zone": [
                                    "Space",
                                    "Earth"
                                ],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 3,
                                "hp": 2,
                                "effects": {
                                    "description": [
                                        "<Blocker> (Rest this Unit to change the attack target to it.)",
                                        "This Unit can't choose the enemy player as its attack target."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "blocker",
                                            "type": "keyword",
                                            "trigger": "ATTACK_REDIRECT",
                                            "target": {
                                                "type": "unit",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "redirect_attack",
                                                "parameters": {
                                                    "cost": "rest_self"
                                                },
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "attack_restriction",
                                            "type": "static",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "unit",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "restrict_attack",
                                                "parameters": {
                                                    "restriction": "cannot_attack_player"
                                                },
                                                "duration": "permanent"
                                            }
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1757865720753,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalAP": 3,
                            "originalHP": 2,
                            "isFirstPlay": true,
                            "damageReceived": 0
                        },
                        "pilot": null,
                        "fieldCardValue": {
                            "totalOriginalAP": 3,
                            "totalOriginalHP": 2,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 3,
                            "totalHP": 2,
                            "isRested": false
                        }
                    },
                    "focusTarget": null,
                    "result": {
                        "targetType": "unit",
                        "attackerDestroyed": true,
                        "defenderDestroyed": true,
                        "attackerDamageTaken": 3,
                        "defenderDamageTaken": 6
                    }
                }
            }

when u see this, i want you add an animation move the attacking unit to the targeted unit. if the unit is destroyed , it will disappear in the slot.
