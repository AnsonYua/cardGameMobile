1.Shield:0 should refer to number of shield card which is 
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

(you can look at the sampleGameEnv.json structure)

2.For Active(E), you can see , you need to court the number where "isRested": false and "isExtraEnergy" false
"energyArea": [
                        {
                            "carduid": "energy_extra_1757854884783_0.7532637448015431",
                            "cardId": "energy_extra",
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": true,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },

        ......
]
(you can look at the sampleGameEnv.json structure)


3.For Rested(E), you can see , you need to court the number where "isRested": true and "isExtraEnergy" false
"energyArea": [
                        {
                            "carduid": "energy_extra_1757854884783_0.7532637448015431",
                            "cardId": "energy_extra",
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": true,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },

        ......
]
(you can look at the sampleGameEnv.json structure)


4.For Rested(E), you can see , you need to court the number where "isRested": false and "isExtraEnergy" true
"energyArea": [
                        {
                            "carduid": "energy_extra_1757854884783_0.7532637448015431",
                            "cardId": "energy_extra",
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": true,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },

        ......
]
(you can look at the sampleGameEnv.json structure)