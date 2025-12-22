1.by default, if previousPhase !== MAIN_PHASE and if gameEnv.phase  = MAIN_PHASE , and gameEnv.currentPlayer = gameId, we should only should End Turn button

2. if click any of help card , it will show Play Card Button and a cancel button. when click cancel, it will go back to normal status in which one End Turn button shown. when card click that card is being highlighted, when cacnel the card will display highlight. the highlight mean a green rect frame in the card.

3.if a base card in handarea is clicked and the play button is clicked, it will call api 
curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"playerId_2","gameId":"{gameId}","action":{"type":"PlayCard","carduid":"{cardUId}","playAs":"base"}}'

4.if a unit card in handarea is clicked and the play button is clicked, it will call api 
curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"playerId_2","gameId":"sample_play_card","action":{"type":"PlayCard","carduid":"ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876","playAs":"unit"}}'



  5. if a command card with (`effects.rules.effectId` = `pilot_designation`)is clicked and the play button is clicked, it will show a dialog with 2 option play as pilot and play as command, the mockup is designRef/playandialog.png.  When click as play as pilot, the dialog will disappear and show a dialog with mock up like designRef/dialogGrey.png. it will get all unit and disappear in the dialog. it will has 3 x 2 display. Then when a unit card is selected in the pilottargetDialog , it will call this api

  curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"{}","gameId":"{}","action":{"type":"PlayCard","carduid":"{selected card to play}","playAs":"pilot","targetUnit":"{selected be unit in pilotTargetDialog}"}}'



after calling the api, it will return a response as below. this is the new game Status, please look at processingQueue, the first object that data.userDecisionMade = false . frontend will use these data to display a dialog for user to choice. it will look at the availableTargets.zone and availableTargets.playerId. and get the slot data (unit,pilot , label) and display for user to choice, the dialog layout should look like PilotTargetDialog.ts. override / extend PilotTargetDialog.ts and make a new class EffectTargetDialog.ts and reuse the ui logic in PilotTargetDialog.ts
  {
  "success": true,
  "gameId": "e47b84c4-2214-4c8a-b469-5b2ed98862e2",
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "players": {
    },
    "processingQueue": [
      {
        "id": "target_choice_129_1765472418831",
        "type": "TARGET_CHOICE",
        "status": "DECLARED",
        "priority": 1,
        "playerId": "playerId_2",
        "timestamp": 1765472418831,
        "data": {
          "choiceId": "target_choice_main_heal_friendly_1765472418831",
          "userDecisionMade": false,
          "sourceCarduid": "ST01-013_51703d0a-9541-49b5-8b82-998293564235",
          "effect": {
            "effectId": "main_heal_friendly",
            "type": "activated",
            "trigger": "PAIRING_COMPLETE",
            "target": {
              "scope": "self",
              "type": "unit",
              "count": 1
            },
            "action": "heal",
            "parameters": {
              "value": 3
            },
            "timing": {
              "windows": [
                "MAIN_PHASE"
              ]
            },
            "pairedSlot": "slot5",
            "sourceCarduid": "ST01-013_51703d0a-9541-49b5-8b82-998293564235"
          },
          "availableTargets": [
            {
              "carduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
              "zone": "slot1",
              "playerId": "playerId_2",
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
              }
            },
            {
              "carduid": "ST01-007_9b9840b9-2ef1-4f03-953a-c89d8d9cb833",
              "zone": "slot2",
              "playerId": "playerId_2",
              "cardData": {
                "id": "ST01-007",
                "name": "Gundam Aerial (Bit on Form)",
                "cardType": "unit",
                "color": "White",
                "level": 4,
                "cost": 2,
                "zone": [
                  "Space",
                  "Earth"
                ],
                "traits": [
                  "Academy"
                ],
                "link": [
                  "Suletta Mercury"
                ],
                "ap": 3,
                "hp": 4,
                "effects": {
                  "description": [],
                  "rules": []
                }
              }
            },
            {
              "carduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
              "zone": "slot3",
              "playerId": "playerId_2",
              "cardData": {
                "id": "ST01-001",
                "name": "Gundam",
                "cardType": "unit",
                "color": "Blue",
                "level": 4,
                "cost": 3,
                "zone": [
                  "Space",
                  "Earth"
                ],
                "traits": [
                  "Earth Federation",
                  "White Base Team"
                ],
                "link": [
                  "Amuro Ray"
                ],
                "ap": 3,
                "hp": 4,
                "effects": {
                  "description": [
                    "<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)",
                    "【During Pair】During your turn, all your Units get AP+1."
                  ],
                  "rules": [
                    {
                      "effectId": "repair_2",
                      "type": "keyword",
                      "trigger": "END_OF_TURN",
                      "action": "heal",
                      "parameters": {
                        "value": 2
                      },
                      "timing": {
                        "duration": "instant"
                      },
                      "target": {
                        "type": "unit",
                        "scope": "self",
                        "count": 1
                      }
                    },
                    {
                      "effectId": "pair_ap_boost_all",
                      "type": "static",
                      "trigger": "continuous",
                      "sourceConditions": [
                        {
                          "type": "paired"
                        }
                      ],
                      "action": "modifyAP",
                      "parameters": {
                        "value": 1
                      },
                      "timing": {
                        "duration": "continuous",
                        "actionTurn": "YOUR_TURN"
                      },
                      "target": {
                        "type": "unit",
                        "scope": "self_all_unit",
                        "count": 1,
                        "filters": {
                          "controller": "self"
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              "carduid": "ST01-001_99bf72e0-45e9-42d1-b279-2aa8875edbbd",
              "zone": "slot4",
              "playerId": "playerId_2",
              "cardData": {
                "id": "ST01-001",
                "name": "Gundam",
                "cardType": "unit",
                "color": "Blue",
                "level": 4,
                "cost": 3,
                "zone": [
                  "Space",
                  "Earth"
                ],
                "traits": [
                  "Earth Federation",
                  "White Base Team"
                ],
                "link": [
                  "Amuro Ray"
                ],
                "ap": 3,
                "hp": 4,
                "effects": {
                  "description": [
                    "<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)",
                    "【During Pair】During your turn, all your Units get AP+1."
                  ],
                  "rules": [
                    {
                      "effectId": "repair_2",
                      "type": "keyword",
                      "trigger": "END_OF_TURN",
                      "action": "heal",
                      "parameters": {
                        "value": 2
                      },
                      "timing": {
                        "duration": "instant"
                      },
                      "target": {
                        "type": "unit",
                        "scope": "self",
                        "count": 1
                      }
                    },
                    {
                      "effectId": "pair_ap_boost_all",
                      "type": "static",
                      "trigger": "continuous",
                      "sourceConditions": [
                        {
                          "type": "paired"
                        }
                      ],
                      "action": "modifyAP",
                      "parameters": {
                        "value": 1
                      },
                      "timing": {
                        "duration": "continuous",
                        "actionTurn": "YOUR_TURN"
                      },
                      "target": {
                        "type": "unit",
                        "scope": "self_all_unit",
                        "count": 1,
                        "filters": {
                          "controller": "self"
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              "carduid": "ST01-003_7cbc533a-96d0-428e-8eab-b07c7d5943e5",
              "zone": "slot5",
              "playerId": "playerId_2",
              "cardData": {
                "id": "ST01-003",
                "name": "Guncannon",
                "cardType": "unit",
                "color": "Blue",
                "level": 3,
                "cost": 2,
                "zone": [
                  "Space",
                  "Earth"
                ],
                "traits": [
                  "Earth Federation",
                  "White Base Team"
                ],
                "link": [
                  "Kai Shiden"
                ],
                "ap": 2,
                "hp": 4,
                "effects": {
                  "description": [],
                  "rules": []
                }
              }
            }
          ]
        }
      }
    ],
    "processingEnabled": true,
    "maxEventsPerCycle": 50,
    
    "lastEventId": 0
  }
}




6.after EffectTargetDialog is show and user select a card it should be api call like below,eventId is processingQueue.id , selectedTargets.carduid is that unit 
  curl -X POST http://localhost:8080/api/game/player/confirmTargetChoice \
    -H "Content-Type: application/json" \
    -d '{
      "gameId": "GAME123",
      "playerId": "player_1",
      "eventId": "target_choice_5_1738955555555",
      "selectedTargets": [
        { "carduid": "ST01-007_abcd", "zone": "slot3", "playerId": "player_2" }
      ]
    }'




7.when the card type is command and there is no `effects.rules.effectId` = `pilot_designation`, it will directly make the api call .

curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:5173' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:5173/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"playerId_2","gameId":"6a0d780a-45be-4583-b7b9-d265f43e84e5","action":{"type":"PlayCard","carduid":"ST01-013_51703d0a-9541-49b5-8b82-998293564235","playAs":"command"}}'



  8.if cardtype = "pilot" ,show a dialog PilotTargetDialog. it will get all unit without pilot in slot and appear in the dialog. it will has 3 x 2 display. Then when a unit card is selected in the pilottargetDialog , it will call this api. same flow of #5 if the command card place as pilot


  9.
  when click end turn. it will call this api
  curl 'http://localhost:8080/api/game/player/endTurn' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"gameId":"sample_play_card","playerId":"playerId_2"}'


  10.if this is opponent turn , gameEnv.currentPlayer != currentPlayID, in the actionbuttonbar, there should not show anybutton and there should be a label/text wait for opponent action. this label is flashing.

{
  "success": true,
  "gameId": "d85cb669-a05d-4bd1-983c-163b6706d68b",
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "playerId_1": "playerId_1",
    "playerId_2": "playerId_2",
    "gameStarted": true,
    "firstPlayer": 0,
    "currentPlayer": "playerId_2",
    "currentTurn": 0,
    "playersReady": {
      "playerId_1": true,
      "playerId_2": true
    },
  }
}


11.if this is opponent turn, if  gameEnv.currentBattle!=null and gameEnv.currentBattle.confirmations.currentPlayer = false, show skip action. when player click the skip action it will call api as usual
{
  "success": true,
  "gameId": "f91a9c52-98ee-4c7e-ae0b-3d5afbbc2657",
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "playerId_1": "playerId_1",
    "playerId_2": "playerId_2",
    "gameStarted": true,
    "firstPlayer": 0,
    "currentPlayer": "playerId_2",
    "currentTurn": 0,
    "playersReady": {
      "playerId_1": true,
      "playerId_2": true
    },
    "currentBattle": {
      "actionType": "attackUnit",
      "attackingPlayerId": "playerId_2",
      "defendingPlayerId": "playerId_1",
      "pendingEvent": {
        "type": "PLAYER_ACTION",
        "playerId": "playerId_2",
        "gameId": "f91a9c52-98ee-4e7e-ae0b-3d5afbbc2657",
        "actionType": "attackUnit",
        "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
        "targetType": "unit",
        "targetUnitUid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
        "targetPlayerId": "playerId_1",
        "targetPilotUid": null
      },
      "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
      "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
      "targetPlayerId": "playerId_1",
      "status": "ACTION_STEP",
      "fromBurst": false,
      "openedAt": 1766134247891,
      "confirmations": {
        "playerId_2": false,
        "playerId_1": false
      }
    },
  }
}


12.
when player trigger Attack (to unit /shield) → it will go to Blocker selection phase(if opponent have any block) → then go to Action-Step Flow

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

  -after user select a blocker, 
    these field will show update. 
    "forcedTargetCarduid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
    "forcedTargetZone": "slot3",
    "forcedTargetPlayerId": "playerId_1"
    show always pointer to forcedTargetCarduid, if these field exist
    this.updateAttackIndicatorFromNotifications(raw, slots, positions);


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

 
  ———

  Action-step confirmations

  - Once currentBattle is populated:
      - Watch currentBattle.confirmations. For each player where the flag is false, render a “Confirm Battle” button.
      - Allowed actions while the action step is open:
          - POST /api/game/player/playerAction with actionType: 'useCommandCard' (payload depends on the command card) → processed immediately because
            needsPlayerInput() allows command-card events.
          - POST /api/game/player/playerAction with actionType: 'confirmBattle'.

            {
              "playerId": "playerId_2",
              "gameId": "733760d3-9ea2-4e88-b332-09085e5900e1",
              "actionType": "confirmBattle"
            }
            Backend flips the confirmation flag. When both players confirm, BattlePhaseManager.resolveBattle executes and clears currentBattle.
      - Do not send other actions (new attacks, end turn, etc.) while currentBattle exists unless the queue head explicitly permits it per the
        needsPlayerInput() rules.

  ———

  Frontend logic summary

  1. Polling every second
      - On success: replace local gameEnv.
      - On error: show message, pause user inputs until next success.
  2. UI gating
      - If queue head is a declared choice (blocker/target/burst): show corresponding dialog, block other actions.
      - If no blocking event but currentBattle exists: show action-step UI and confirm buttons for players with confirmations[playerId] === false.
        Allow command cards and confirmBattle POSTs only.
      - Otherwise: normal play controls.
  3. Action submission
      - Every button click maps to a backend endpoint:
          1. Attack / use ability / confirm battle → POST /playerAction with proper actionType.
          2. Blocker/target/burst choices → respective confirmation endpoints (e.g., /player/confirmBlockerChoice).
      - Disable the initiating button until the response arrives; on success, rely on the next poll to update UI.

  By following this contract, the frontend stays synchronized with the backend’s event queue and battle state without extra fields or guesswork.

8.if this is opponent turn, if  gameEnv.currentBattle!=null and gameEnv.currentBattle.confirmations.currentPlayer = false, show skip action. when player click the skip action it will call api as usual
{
  "success": true,
  "gameId": "f91a9c52-98ee-4c7e-ae0b-3d5afbbc2657",
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "playerId_1": "playerId_1",
    "playerId_2": "playerId_2",
    "gameStarted": true,
    "firstPlayer": 0,
    "currentPlayer": "playerId_2",
    "currentTurn": 0,
    "playersReady": {
      "playerId_1": true,
      "playerId_2": true
    },
    "currentBattle": {
      "actionType": "attackUnit",
      "attackingPlayerId": "playerId_2",
      "defendingPlayerId": "playerId_1",
      "pendingEvent": {
        "type": "PLAYER_ACTION",
        "playerId": "playerId_2",
        "gameId": "f91a9c52-98ee-4c7e-ae0b-3d5afbbc2657",
        "actionType": "attackUnit",
        "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
        "targetType": "unit",
        "targetUnitUid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
        "targetPlayerId": "playerId_1",
        "targetPilotUid": null
      },
      "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
      "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
      "targetPlayerId": "playerId_1",
      "status": "ACTION_STEP",
      "fromBurst": false,
      "openedAt": 1766134247891,
      "confirmations": {
        "playerId_2": false,
        "playerId_1": false
      }
    },
