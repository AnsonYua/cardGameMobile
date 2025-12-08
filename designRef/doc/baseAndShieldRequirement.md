you should look at gameStatus for the shield and base
for shield look at gameEnv.players.{currentPlayer}.zone.shieldArea
          "shieldArea": [
            {
              "carduid": "ST01-004_f625d0b5-7621-469d-a67f-47a2a18dcdbb",
              "cardId": "ST01-004",
              "cardData": {
                "id": "ST01-004",
                "name": "Guntank",
                "cardType": "shield",
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
                  "Hayato Kobayashi"
                ],
                "ap": 2,
                "hp": 3,
                "effects": {
                  "description": [
                    "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it."
                  ],
                  "rules": [
                    {
                      "effectId": "deploy_rest_low_hp",
                      "type": "triggered",
                      "trigger": "ENTERS_PLAY",
                      "target": {
                        "type": "unit",
                        "scope": "opponent",
                        "filters": {
                          "hp": "<=2"
                        },
                        "count": 1
                      },
                      "effect": {
                        "action": "rest",
                        "duration": "permanent"
                      }
                    }
                  ]
                },
                "originalCardType": "unit"
              },
              "placedAt": 1757854884783,
              "placedBy": "playerId_1",
              "isRested": false,
              "originalCardType": "unit"
            },...
          ],
the number of card in shield should equal to the number of card in the array

for base look at gameEnv.players.{currentPlayer}.zone.base
          "base": [
            {
              "carduid": "base_default",
              "cardId": "base_default",
              "cardData": {
                "cardType": "base"
              },
              "placedAt": 1757854884783,
              "placedBy": "playerId_1",
              "isRested": false,
              "originalHP": 3,
              "damageReceived": 0,
              "fieldCardValue": {
                "totalOriginalAP": 0,
                "totalOriginalHP": 3,
                "totalTempModifyAP": 0,
                "totalTempModifyHP": 0,
                "totalContinueModifyAP": 0,
                "totalContinueModifyHP": 0,
                "totalDamageReceived": 0,
                "totalAP": 0,
                "totalHP": 3,
                "isRested": false
              }
            }
          ],

if "cardId" =  "base_default" , use ex-base from public/ex-base.png for image display, else retreive the image from cache using cardId, all the label value should use fieldCardValue.totalAP and fieldCardValue.totalHP as `AP|HP` format,
if base = [] , hide the base area( just the base card , the shield card still show). When base is empty, disable the long-press preview/hit area; preview only works when base data exists.


 if base=[] is a empty array, the base card should not show

Long-press preview (mirrors slot preview style)
- Hold ~400ms on a hand card to open a preview; tap anywhere to dismiss. Preview stays visible after you release the press.
- Overlay dims the screen (alpha ~0.65) and draws the card at 300px width with an 88/64 aspect.
- there are 2 badges. 1 badge color black with size 70x45 in bottom right corner. and it will use value fieldCardValue.totalOriginalAP|totalOriginalHP.
- the other badges: size 70x45; font ~20px. Total badge color blue (0x284cfc) with a 10px gap below the stack.  base badge uses unit ap|hp, total badge uses fieldCardValue.totalAP|totalHP.
