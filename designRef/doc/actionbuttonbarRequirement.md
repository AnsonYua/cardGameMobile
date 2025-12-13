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