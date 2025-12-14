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

4. Current SlotDisplayHandler rendering logic (code-aligned)
- Slot footprint: cards are rendered at ~80% of the slot size (square footprint). When a card is present, a frame is drawn behind the stack.
- Unit-only: unit uses ~90% of the slot size, centered vertically; no pilot slice is drawn.
- Unit + pilot: unit ratio 0.75, pilot ratio 0.25 (derived as 1 - unitRatio). Both use the same width; pilot and unit share the same height basis (slotSize * 0.9) but the pilot image is cropped to the bottom slice (pilotRatio) while the unit uses the top portion.
- Cropping: unit is drawn with its top portion visible (no bottom crop). Pilot is cropped from the bottom slice using the pilotRatio (currently 0.25). This preserves the visible split while keeping the overall footprint square.
- Borders: both unit and pilot layers draw an outline stroke sized to the visible slice (unit uses unitRatio, pilot uses pilotRatio). Stroke currently uses a 3px line and follows the visible height of each slice.
- Slot order: positioned per `slotOrder.png` — top row `slot4/slot5/slot6`, second row `slot1/slot2/slot3` (opponent side), mirrored for player rows; the FieldHandler uses an explicit slotOrder array to map grid positions to slot ids.


5.Labels for combat stats
- there will be a label similar to that with hand card.
- even there is unit and pilot in the slot , there will be only 1 label
- we should look at fieldCardValue,totalAP and totalHP and display as  `AP|HP` (e.g., `3|4`). If AP or HP is missing, treat it as `0`.

6.when the card in slot is long press, it will show a preview of card in slot, after the preview show, when touch any place if the screen, the preview will disappear.
 it has 2 types of display. 
6.1 for unit alone, you can see the mock up in (/Users/hello/Desktop/card/unity/cardGameFrontend/preview_unit.png), there will be 2 black label . the label inside the card unit.cardData.ap|unit.cardData.hp, the label outside the card should show fieldCardValue.totalAP|fieldCardValue.totalHP
6.2 for unit + pilot, you can see  the mock up in (/Users/hello/Desktop/card/unity/cardGameFrontend/preview_unit_pilot.png)
the unit card in front (blue one)
the pilot card in back layer , and move a bit down (green one)
there will be 3 black label , black label for unit, black label for pilot and black label for the total set(just below the pilot card) 
black label for unit should use unit.cardData.ap|unit.cardData.hp
black label for pilot should use 
  if cardType = pilot pilot.cardData.ap|pilot.cardData.hp
  if cardType = command , find the pilot.effects.rules = pilot_designation and use the value pilot.effects.rules.parameters.AP|pilot.effects.rules.parameters.AP.cardData.hp
black label for the total set(just below the pilot card) ,show fieldCardValue.totalAP|fieldCardValue.totalHP

-----------------------------------------
7. Implementation constants (code-aligned; do not omit above rules)
- Slot footprint: card scale ~80% of slot; frame scale ~86% with shadow offset 3px. Borders: 3px stroke per slice.
- Unit/pilot sizing: unit height ratio 0.75, pilot 0.25 when both present; unit-only uses ~90% slot height.
- Cropping: pilot cropped from bottom slice; unit uses upper slice (center crop). Pilot slice ratio 0.4 of source height.
- Stat pill in-slot: positioned using hand-style factors (w*0.4, h*0.3, offsets x*0.34, y*0.36). Fallback to slot ap/hp if fieldCardValue missing.
- Preview trigger: long-press ~400ms; overlay alpha ~0.65; fade in 180ms, fade out 150ms; tap anywhere to dismiss (not on release).
- Preview layout: base width 300px, aspect 88/64. Pilot offset ~20% down (10% for command pilots); unit offset up by 40% of pilot offset.
- Preview badges: size 70x45; font ~20px. Total badge color blue (0x284cfc) with a 10px gap below the stack. Pilot badge uses pilot ap|hp (or pilot_designation AP|HP for command), unit badge uses unit ap|hp, total badge uses fieldCardValue.totalAP|totalHP.



6.when slot card is clicked (my slot card , not opponent slot card).it will check if opponent slot have unit. if have unit it will show attack Unit,attack Shield and Cancel Button(no end turn button). if dont have unit , it will only show attach Shield and Cancel Button(no end turn button). when click cancel it will deselect the card and show back the End Turn Button. when me placeholder for attack unit and attack shield.


7.when click a slot card, the white frame will become green as an highlight for selected