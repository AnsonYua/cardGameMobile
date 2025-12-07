you should look at gameStatus for the slotDisplay
gameEnv.players.{currentPlayer}.zones.{slot1/slot2/slot3/slot4/slot5/slot6}
slot1,slot2,slot3 ,slot4,slot5,slot6 is matching exactly as the display in screen


this is the sample response.
          "slot1": {
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
              "damageReceived": 0,
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
              "totalDamageReceived": 0,
              "totalAP": 6,
              "totalHP": 3,
              "isRested": false
            }
          }

-----------------------------------------
1.if zone.slotX = empty no card should be display
if zone.slotX = {
  "unit":{,,,},
  "fieldCardValue":{...}
}
it will display unit card
/Users/hello/Desktop/card/unity/cardGameFrontend/unitpluspilot.png


if zone.slotX={
  "unit":{,,,},
  "pilot":{,,,},
  "fieldCardValue":{...}
}
it will display unit & pilot card
unit on the top pilot card in behind. 
the pilot move a bit down
/Users/hello/Desktop/card/unity/cardGameFrontend/unit.png


2.for slotOrder see /Users/hello/Desktop/card/unity/cardGameFrontend/slotOrder.png 

3. where card show in slot the width should fill up 80% width of the slot, the height should be square and image is being tirmed. unit card is tirm from top to bottom , and pilot is tirm from bottom to top.