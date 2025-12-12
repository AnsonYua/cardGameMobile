i want to have clear definition and structure of the game flow.
assumption i am in MAIN_PHASE.
my though is it will call the test polling/polling api every 30s. when it is my turn gameEnv.currentPlayer = self.


during main_phase and if it is my turn , player is expected to do some interaction on handcard, slotcard , even base card.

hand cards have different type. No matter which hand card click, it will show play card button. When play card button is clicked. different card will have trigger different option. the option will ask user to select through popup dialog. after the dialog show and confirm, it will call api. when api return, may show another popup asking user to select sometime depend on the effect. 

with this ,help me design the function call and screen refreshing flow.

below is a sample response for test polling
{
    "success": true,
    "gameId": "177c19e1-f414-4208-b3a7-338309500765",
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
        "currentBattle": null,
        "players": {
            "playerId_1": {
                "id": "playerId_1",
                "name": "Player 1",
                "deck": {
                    "hand": [
                        {
                            "carduid": "ST01-005_c6825cb6-7337-42d6-a26f-f8dded9f0c88",
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
                            }
                        },
                        {
                            "carduid": "ST01-002_0240011b-a004-428f-bbcb-6cf94491c2ef",
                            "cardId": "ST01-002",
                            "cardData": {
                                "id": "ST01-002",
                                "name": "Gundam(MA Form)",
                                "cardType": "unit",
                                "color": "Blue",
                                "level": 5,
                                "cost": 3,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [
                                    "Amuro Ray"
                                ],
                                "ap": 4,
                                "hp": 3,
                                "effects": {
                                    "description": [
                                        "【When Paired･(White Base Team) pilot】Draw 1."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "paired_white_base_draw",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "conditions": [
                                                {
                                                    "type": "traitMatch",
                                                    "target": "pilot",
                                                    "traits": [
                                                        "White Base Team"
                                                    ]
                                                }
                                            ],
                                            "action": "draw",
                                            "parameters": {
                                                "value": 1
                                            },
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "ANY"
                                            },
                                            "target": {
                                                "type": "player",
                                                "scope": "self",
                                                "count": 1
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-015_2d81924c-bb00-41fd-b351-425a4784f478",
                            "cardId": "ST01-015",
                            "cardData": {
                                "id": "ST01-015",
                                "name": "White Base",
                                "cardType": "base",
                                "color": "Blue",
                                "level": 3,
                                "cost": 2,
                                "zone": [
                                    "Space",
                                    "Earth"
                                ],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team",
                                    "Warship"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】【Once per Turn】②：Deploy 1 [Gundam]((White Base Team)･AP3･HP3) Unit token if you have no Units in play, deploy 1 [Guncannon]((White Base Team)･AP2･HP2) Unit token if you have only 1 Unit in play, or deploy 1 [Guntank]((White Base Team)･AP1･HP1) Unit token if you have 2 or more Units in play."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "deploy"
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "action": "addToHand",
                                            "parameters": {
                                                "value": 1,
                                                "from": "shield"
                                            }
                                        },
                                        {
                                            "effectId": "activate_conditional_token_deploy",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE"
                                                ]
                                            },
                                            "cost": {
                                                "resource": 2,
                                                "oncePerTurn": true
                                            },
                                            "conditions": [
                                                "boardStateCheck"
                                            ],
                                            "action": "conditionalTokenDeploy",
                                            "parameters": {
                                                "condition1": {
                                                    "unitsInPlay": 0,
                                                    "token": {
                                                        "name": "Gundam",
                                                        "traits": [
                                                            "White Base Team"
                                                        ],
                                                        "ap": 3,
                                                        "hp": 3
                                                    }
                                                },
                                                "condition2": {
                                                    "unitsInPlay": 1,
                                                    "token": {
                                                        "name": "Guncannon",
                                                        "traits": [
                                                            "White Base Team"
                                                        ],
                                                        "ap": 2,
                                                        "hp": 2
                                                    }
                                                },
                                                "condition3": {
                                                    "unitsInPlay": ">=2",
                                                    "token": {
                                                        "name": "Guntank",
                                                        "traits": [
                                                            "White Base Team"
                                                        ],
                                                        "ap": 1,
                                                        "hp": 1
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-016_4922407e-86c5-45bb-ac94-bec3fa3c6296",
                            "cardId": "ST01-016",
                            "cardData": {
                                "id": "ST01-016",
                                "name": "Asticassia School of Technology, Earth House",
                                "cardType": "base",
                                "color": "White",
                                "level": 2,
                                "cost": 1,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Academy",
                                    "Stronghold"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "deploy"
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "action": "addToHand",
                                            "parameters": {
                                                "value": 1,
                                                "from": "shield"
                                            }
                                        },
                                        {
                                            "effectId": "activate_boost_link_units",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE"
                                                ],
                                                "duration": "UNTIL_END_OF_TURN"
                                            },
                                            "cost": {
                                                "tap": "self",
                                                "rest": "self"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "self_all_unit",
                                                "filters": {
                                                    "linkStatus": "linked"
                                                }
                                            },
                                            "action": "modifyAP",
                                            "parameters": {
                                                "value": 1
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-008_3003bc88-fdf1-4397-8ab4-df7ce5afcf27",
                            "cardId": "ST01-008",
                            "cardData": {
                                "id": "ST01-008",
                                "name": "Demi Trainer",
                                "cardType": "unit",
                                "color": "White",
                                "level": 1,
                                "cost": 1,
                                "zone": [
                                    "Space",
                                    "Earth"
                                ],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "<Blocker> (Rest this Unit to change the attack target to it.)"
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
                                            "action": "redirect_attack",
                                            "parameters": {
                                                "cost": "rest_self"
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-007_c47a5ece-3214-47d9-8341-389f3f64655b",
                            "cardId": "ST01-007",
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
                            "carduid": "ST01-011_cd2b3291-c03f-40dd-bbc8-856ebb478ca9",
                            "cardId": "ST01-011",
                            "cardData": {
                                "id": "ST01-011",
                                "name": "Suletta Mercury",
                                "cardType": "pilot",
                                "color": "White",
                                "level": 4,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 2,
                                "effects": {
                                    "description": [
                                        "【Burst】Add this card to your hand.",
                                        "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active."
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
                                            "effectId": "attack_activate_resource",
                                            "type": "triggered",
                                            "trigger": "ATTACK_PHASE",
                                            "optional": true,
                                            "restrictions": [
                                                "once_per_turn"
                                            ],
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "YOUR_TURN"
                                            },
                                            "sourceConditions": [
                                                {
                                                    "type": "controller",
                                                    "value": "self"
                                                },
                                                {
                                                    "type": "paired"
                                                }
                                            ],
                                            "target": {
                                                "type": "resource",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "setActive"
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-005_2e8508d4-e7c9-4338-a82a-00c9833e37d5",
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
                            }
                        },
                        {
                            "carduid": "ST01-002_25d60cac-f4db-4cd2-a169-a937f67de0e9",
                            "cardId": "ST01-002",
                            "cardData": {
                                "id": "ST01-002",
                                "name": "Gundam(MA Form)",
                                "cardType": "unit",
                                "color": "Blue",
                                "level": 5,
                                "cost": 3,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [
                                    "Amuro Ray"
                                ],
                                "ap": 4,
                                "hp": 3,
                                "effects": {
                                    "description": [
                                        "【When Paired･(White Base Team) pilot】Draw 1."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "paired_white_base_draw",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "conditions": [
                                                {
                                                    "type": "traitMatch",
                                                    "target": "pilot",
                                                    "traits": [
                                                        "White Base Team"
                                                    ]
                                                }
                                            ],
                                            "action": "draw",
                                            "parameters": {
                                                "value": 1
                                            },
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "ANY"
                                            },
                                            "target": {
                                                "type": "player",
                                                "scope": "self",
                                                "count": 1
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-011_58c994ce-5091-4b23-b834-434e48eff8ce",
                            "cardId": "ST01-011",
                            "cardData": {
                                "id": "ST01-011",
                                "name": "Suletta Mercury",
                                "cardType": "pilot",
                                "color": "White",
                                "level": 4,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 2,
                                "effects": {
                                    "description": [
                                        "【Burst】Add this card to your hand.",
                                        "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active."
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
                                            "effectId": "attack_activate_resource",
                                            "type": "triggered",
                                            "trigger": "ATTACK_PHASE",
                                            "optional": true,
                                            "restrictions": [
                                                "once_per_turn"
                                            ],
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "YOUR_TURN"
                                            },
                                            "sourceConditions": [
                                                {
                                                    "type": "controller",
                                                    "value": "self"
                                                },
                                                {
                                                    "type": "paired"
                                                }
                                            ],
                                            "target": {
                                                "type": "resource",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "setActive"
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-008_cae96bc9-8546-485f-94c8-fffeb4edd05d",
                            "cardId": "ST01-008",
                            "cardData": {
                                "id": "ST01-008",
                                "name": "Demi Trainer",
                                "cardType": "unit",
                                "color": "White",
                                "level": 1,
                                "cost": 1,
                                "zone": [
                                    "Space",
                                    "Earth"
                                ],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "<Blocker> (Rest this Unit to change the attack target to it.)"
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
                                            "action": "redirect_attack",
                                            "parameters": {
                                                "cost": "rest_self"
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    "handUids": [
                        "ST01-005_c6825cb6-7337-42d6-a26f-f8dded9f0c88",
                        "ST01-002_0240011b-a004-428f-bbcb-6cf94491c2ef",
                        "ST01-015_2d81924c-bb00-41fd-b351-425a4784f478",
                        "ST01-016_4922407e-86c5-45bb-ac94-bec3fa3c6296",
                        "ST01-008_3003bc88-fdf1-4397-8ab4-df7ce5afcf27",
                        "ST01-007_c47a5ece-3214-47d9-8341-389f3f64655b",
                        "ST01-011_cd2b3291-c03f-40dd-bbc8-856ebb478ca9",
                        "ST01-005_2e8508d4-e7c9-4338-a82a-00c9833e37d5",
                        "ST01-002_25d60cac-f4db-4cd2-a169-a937f67de0e9",
                        "ST01-011_58c994ce-5091-4b23-b834-434e48eff8ce",
                        "ST01-008_cae96bc9-8546-485f-94c8-fffeb4edd05d"
                    ],
                    "mainDeck": [
                        "ST01-008_f48ce84f-3281-4764-89c3-c9f30a7d78f8",
                        "ST01-008_8bfd00ea-d830-48d3-83d0-6270520765a9",
                        "ST01-016_eb48dd84-6a75-47e8-9921-590d5dd43dd4",
                        "ST01-007_04054db5-9573-4ecd-aafc-e7b0eba1f6f8",
                        "ST01-011_18a4b3d4-0171-4d35-9ec6-dbc3dfdd7f27",
                        "ST01-007_03cdc53c-edd6-43f8-accb-3b96321078f0",
                        "ST01-005_2eaa714a-36f5-470c-9ba1-40e2b85aae3c",
                        "ST01-013_19872960-3366-44a7-aa21-349ad3f4d36c",
                        "ST01-003_14ff722c-7c6b-4cab-a072-7ccafa2f71f9",
                        "ST01-010_d6b198e9-0ae4-41a8-8c05-9fd976793218",
                        "ST01-012_b85c1f67-8656-4371-853f-15718f9c8268",
                        "ST01-004_b31709be-7972-454e-9c08-dc8d2941322a",
                        "ST01-010_59bef40d-0570-4914-aa8d-76b75f86a59c",
                        "ST01-003_b1017e56-3023-4f99-993b-653de4c231db",
                        "ST01-010_0199a1b8-5810-4b68-8f2d-dd197428098a",
                        "ST01-011_0c399e8d-52b9-417c-b4df-41677d704e40",
                        "ST01-015_111b6ee2-597d-43c4-9a5a-bff44bdb6c6c",
                        "ST01-004_1bf163b1-6561-4296-970c-5f88c42e9eb8",
                        "ST01-010_64034210-158b-4579-8ea7-e4bb5e6e1cee",
                        "ST01-014_3c854dda-88a6-4b9b-ae1f-d3ad74a83904",
                        "ST01-007_064928f3-c91e-48d4-8d5c-492c6103f0e4",
                        "ST01-003_e79ba51a-c672-4c29-8626-3b2fb8f05656",
                        "ST01-001_bf8840c3-81e8-4c4a-a660-3a990438126a",
                        "ST01-016_c307095a-a25c-41f9-99b9-04a4b7846c23",
                        "ST01-012_90ce71b6-6e35-4b72-9543-f84ccf059492",
                        "ST01-001_2f281cbd-404d-4327-96b5-ceeae0b49b70",
                        "ST01-015_575138be-d306-4ff5-8ef9-0da2601b49ee",
                        "ST01-014_1cb9db7e-80e3-4466-b6b5-2152a09b2f27"
                    ]
                },
                "confirmIsRedraw": true,
                "isRedraw": true,
                "playerPoint": 0,
                "isReady": false,
                "zones": {
                    "slot1": {
                        "unit": {
                            "carduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
                            "cardId": "ST01-006",
                            "cardData": {
                                "id": "ST01-006",
                                "name": "Gundam Aerial (Permet Score Six)",
                                "cardType": "unit",
                                "color": "White",
                                "level": 5,
                                "cost": 4,
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
                                "ap": 4,
                                "hp": 4,
                                "effects": {
                                    "description": [
                                        "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "paired_ap_reduction",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "level": "<=5"
                                                },
                                                "count": 1
                                            },
                                            "effect": {
                                                "action": "modifyAP",
                                                "parameters": {
                                                    "modifier": "-3"
                                                },
                                                "duration": "turn"
                                            }
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1757865723440,
                            "placedBy": "playerId_1",
                            "isRested": true,
                            "originalAP": 4,
                            "originalHP": 4,
                            "isFirstPlay": true,
                            "damageReceived": 0,
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 4,
                            "totalOriginalHP": 4,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 4,
                            "totalHP": 4,
                            "isRested": true
                        }
                    },
                    "slot2": {
                        "unit": {
                            "carduid": "ST01-005_be13f9a5-9fc9-4e3b-a9b2-fdf999d9f63d",
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
                            "placedAt": 1757865726350,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalAP": 2,
                            "originalHP": 2,
                            "isFirstPlay": true,
                            "damageReceived": 0,
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "pilot": {
                            "carduid": "ST01-013_20d620d9-242e-4aa8-b1b6-6847dff89461",
                            "cardId": "ST01-013",
                            "cardData": {
                                "id": "ST01-013",
                                "name": "Kai's Resolve",
                                "cardType": "command",
                                "color": "Blue",
                                "level": 3,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 0,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
                                        "【Pilot】[Kai Shiden]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_heal_friendly",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "target": {
                                                "type": "unit",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "heal",
                                            "parameters": {
                                                "value": 3
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Kai Shiden",
                                                "AP": 1,
                                                "HP": 0
                                            }
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1757865729630,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalAP": 1,
                            "originalHP": 0,
                            "playedAs": "pilot",
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
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
                    "slot3": {
                        "fieldCardValue": {
                            "totalOriginalAP": 0,
                            "totalOriginalHP": 0,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 0,
                            "totalHP": 0,
                            "isRested": false
                        }
                    },
                    "slot4": {
                        "fieldCardValue": {
                            "totalOriginalAP": 0,
                            "totalOriginalHP": 0,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 0,
                            "totalHP": 0,
                            "isRested": false
                        }
                    },
                    "slot5": {
                        "fieldCardValue": {
                            "totalOriginalAP": 0,
                            "totalOriginalHP": 0,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 0,
                            "totalHP": 0,
                            "isRested": false
                        }
                    },
                    "slot6": {
                        "fieldCardValue": {
                            "totalOriginalAP": 0,
                            "totalOriginalHP": 0,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 0,
                            "totalHP": 0,
                            "isRested": false
                        }
                    },
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
                    "shieldArea": [
                        {
                            "carduid": "ST01-012_fb9ee6db-0bec-4b90-bd6e-649d3d6c33d6",
                            "cardId": "ST01-012",
                            "cardData": {
                                "id": "ST01-012",
                                "name": "Thoroughly Damaged",
                                "cardType": "shield",
                                "color": "Blue",
                                "level": 2,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
                                        "【Pilot】[Hayato Kobayashi]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_damage_rested",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "status": "rested"
                                                },
                                                "count": 1
                                            },
                                            "effect": {
                                                "action": "damage",
                                                "parameters": {
                                                    "amount": 1
                                                },
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Hayato Kobayashi",
                                                "AP": 0,
                                                "HP": 1
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "command"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalCardType": "command"
                        },
                        {
                            "carduid": "ST01-009_376c2f25-7a3e-4e2e-86d1-22c12a4dda9f",
                            "cardId": "ST01-009",
                            "cardData": {
                                "id": "ST01-009",
                                "name": "Zowort",
                                "cardType": "shield",
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
                                },
                                "originalCardType": "unit"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalCardType": "unit"
                        },
                        {
                            "carduid": "ST01-013_bbde86f5-9e48-4ad6-8bf1-98aad1e9f7be",
                            "cardId": "ST01-013",
                            "cardData": {
                                "id": "ST01-013",
                                "name": "Kai's Resolve",
                                "cardType": "shield",
                                "color": "Blue",
                                "level": 3,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 0,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
                                        "【Pilot】[Kai Shiden]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_heal_friendly",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "target": {
                                                "type": "unit",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "heal",
                                            "parameters": {
                                                "value": 3
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Kai Shiden",
                                                "AP": 1,
                                                "HP": 0
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "command"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "originalCardType": "command"
                        }
                    ],
                    "energyArea": [
                        {
                            "carduid": "energy_basic_1757854884783_0.7504689807684737",
                            "cardId": "energy_basic",
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1757855236369_0.5750561128259342",
                            "cardId": "energy_basic",
                            "placedAt": 1757855236370,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1757855240150_0.8499680907045319",
                            "cardId": "energy_basic",
                            "placedAt": 1757855240150,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1757855247317_0.04515323423092088",
                            "cardId": "energy_basic",
                            "placedAt": 1757855247317,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421272278_0.8086265250574685",
                            "cardId": "energy_basic",
                            "placedAt": 1759421272278,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421297332_0.031241243042460454",
                            "cardId": "energy_basic",
                            "placedAt": 1759421297332,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421301304_0.5082890981631254",
                            "cardId": "energy_basic",
                            "placedAt": 1759421301304,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421313974_0.37591716271740716",
                            "cardId": "energy_basic",
                            "placedAt": 1759421313974,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421333442_0.8971016833027359",
                            "cardId": "energy_basic",
                            "placedAt": 1759421333442,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421337105_0.28627342816570334",
                            "cardId": "energy_basic",
                            "placedAt": 1759421337105,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421356969_0.09744074226327792",
                            "cardId": "energy_basic",
                            "placedAt": 1759421356969,
                            "placedBy": "playerId_1",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        }
                    ],
                    "trashArea": [],
                    "repairAbilitiesCheckedThisCycle": true
                },
                "effectRegistry": {
                    "pilot_designation_ST01-013_20d620d9-242e-4aa8-b1b6-6847dff89461": {
                        "effectId": "pilot_designation",
                        "sourceCarduid": "ST01-013_20d620d9-242e-4aa8-b1b6-6847dff89461",
                        "sourcePlayerId": "playerId_1",
                        "effectData": {
                            "effectId": "pilot_designation",
                            "type": "special",
                            "trigger": "continuous",
                            "target": {
                                "type": "pilot",
                                "scope": "any"
                            },
                            "action": "designate_pilot",
                            "parameters": {
                                "pilotName": "Kai Shiden",
                                "AP": 1,
                                "HP": 0
                            }
                        },
                        "scope": "any",
                        "action": "designate_pilot",
                        "value": 0,
                        "conditions": [],
                        "active": true,
                        "timestamp": 1759418650840
                    }
                }
            },
            "playerId_2": {
                "id": "playerId_2",
                "name": "Player 2",
                "deck": {
                    "hand": [
                        {
                            "carduid": "ST01-016_c767a64f-9654-4b4f-bd0d-a24967461dde222",
                            "cardId": "ST01-016",
                            "cardData": {
                                "id": "ST01-016",
                                "name": "Asticassia School of Technology, Earth House",
                                "cardType": "base",
                                "color": "White",
                                "level": 2,
                                "cost": 1,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Academy",
                                    "Stronghold"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "deploy"
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "action": "addToHand",
                                            "parameters": {
                                                "value": 1,
                                                "from": "shield"
                                            }
                                        },
                                        {
                                            "effectId": "activate_boost_link_units",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE"
                                                ],
                                                "duration": "UNTIL_END_OF_TURN"
                                            },
                                            "cost": {
                                                "tap": "self",
                                                "rest": "self"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "self_all_unit",
                                                "filters": {
                                                    "linkStatus": "linked"
                                                }
                                            },
                                            "action": "modifyAP",
                                            "parameters": {
                                                "value": 1
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-013_51703d0a-9541-49b5-8b82-998293564235",
                            "cardId": "ST01-013",
                            "cardData": {
                                "id": "ST01-013",
                                "name": "Kai's Resolve",
                                "cardType": "command",
                                "color": "Blue",
                                "level": 3,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 0,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
                                        "【Pilot】[Kai Shiden]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_heal_friendly",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE"
                                                ]
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "heal",
                                            "parameters": {
                                                "value": 3
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Kai Shiden",
                                                "AP": 1,
                                                "HP": 0
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876",
                            "cardId": "ST01-004",
                            "cardData": {
                                "id": "ST01-004",
                                "name": "Guntank",
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
                                            "optional": false,
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "hp": "<=2"
                                                },
                                                "count": 1
                                            },
                                            "action": "rest",
                                            "timing": {
                                                "actionTurn": "ANY"
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d",
                            "cardId": "ST01-014",
                            "cardData": {
                                "id": "ST01-014",
                                "name": "Unforeseen Incident",
                                "cardType": "command",
                                "color": "White",
                                "level": 3,
                                "cost": 1,
                                "zone": [],
                                "traits": [],
                                "link": [],
                                "ap": 0,
                                "hp": 0,
                                "effects": {
                                    "description": [
                                        "【Burst】Activate this card's 【Main】.",
                                        "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_activate_main",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "activate_ability",
                                            "parameters": {
                                                "abilityType": "main"
                                            }
                                        },
                                        {
                                            "effectId": "main_action_ap_reduction",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE",
                                                    "ACTION_STEP"
                                                ],
                                                "duration": "UNTIL_END_OF_TURN"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "count": 1
                                            },
                                            "action": "modifyAP",
                                            "parameters": {
                                                "value": -3
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-009_b49f4b82-33b8-496e-bc4e-a5f7afa27a93",
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
                                            "action": "redirect_attack",
                                            "parameters": {
                                                "cost": "rest_self"
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
                                            "action": "restrict_attack",
                                            "parameters": {
                                                "restriction": "cannot_attack_player"
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-011_4677bc19-1b41-41e6-8754-d48b4b48dbbf",
                            "cardId": "ST01-011",
                            "cardData": {
                                "id": "ST01-011",
                                "name": "Suletta Mercury",
                                "cardType": "pilot",
                                "color": "White",
                                "level": 4,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 2,
                                "effects": {
                                    "description": [
                                        "【Burst】Add this card to your hand.",
                                        "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active."
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
                                            "effectId": "attack_activate_resource",
                                            "type": "triggered",
                                            "trigger": "ATTACK_PHASE",
                                            "optional": true,
                                            "restrictions": [
                                                "once_per_turn"
                                            ],
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "YOUR_TURN"
                                            },
                                            "sourceConditions": [
                                                {
                                                    "type": "controller",
                                                    "value": "self"
                                                },
                                                {
                                                    "type": "paired"
                                                }
                                            ],
                                            "target": {
                                                "type": "resource",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "setActive"
                                        }
                                    ]
                                }
                            }
                        },
                        {
                            "carduid": "ST01-007_4a1df7b9-a494-4819-86f1-c89f2ed95ac7",
                            "cardId": "ST01-007",
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
                            "carduid": "ST01-002_1a1022c3-c90c-408d-aa90-5dca46c586ad",
                            "cardId": "ST01-002",
                            "cardData": {
                                "id": "ST01-002",
                                "name": "Gundam(MA Form)",
                                "cardType": "unit",
                                "color": "Blue",
                                "level": 5,
                                "cost": 3,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [
                                    "Amuro Ray"
                                ],
                                "ap": 4,
                                "hp": 3,
                                "effects": {
                                    "description": [
                                        "【When Paired･(White Base Team) pilot】Draw 1."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "paired_white_base_draw",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "conditions": [
                                                {
                                                    "type": "traitMatch",
                                                    "target": "pilot",
                                                    "traits": [
                                                        "White Base Team"
                                                    ]
                                                }
                                            ],
                                            "action": "draw",
                                            "parameters": {
                                                "value": 1
                                            },
                                            "timing": {
                                                "duration": "instant",
                                                "actionTurn": "ANY"
                                            },
                                            "target": {
                                                "type": "player",
                                                "scope": "self",
                                                "count": 1
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    ],
                    "handUids": [
                        "ST01-016_c767a64f-9654-4b4f-bd0d-a24967461dde222",
                        "ST01-013_51703d0a-9541-49b5-8b82-998293564235",
                        "ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876",
                        "ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d",
                        "ST01-009_b49f4b82-33b8-496e-bc4e-a5f7afa27a93",
                        "ST01-011_4677bc19-1b41-41e6-8754-d48b4b48dbbf",
                        "ST01-007_4a1df7b9-a494-4819-86f1-c89f2ed95ac7",
                        "ST01-002_1a1022c3-c90c-408d-aa90-5dca46c586ad"
                    ],
                    "mainDeck": [
                        "ST01-015_d1e932b1-6734-411d-83f6-802f973fe0ac",
                        "ST01-009_6e5c2d09-a268-407e-a78f-f3878bc2bac6",
                        "ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876",
                        "ST01-010_ac5cb94c-3a30-48c4-bdd6-d001ac3e7264",
                        "ST01-010_2713abc3-2cdc-409f-a46c-e956f6ae440e",
                        "ST01-013_5987d465-8a71-4e9f-90fe-1502b7f96b92",
                        "ST01-008_3d902c27-d1c1-4d60-9e5c-50f20f10ca3b",
                        "ST01-003_6e919be3-b564-4c0e-84dd-212a7f9a5177",
                        "ST01-006_51703d0a-9541-49b5-8b82-998293564235",
                        "ST01-011_bf604944-a93d-4d64-8362-48e8a7a70a3e",
                        "ST01-005_255effdf-afda-4696-9126-134a5719f691",
                        "ST01-013_189cd52d-4082-43f3-b4d8-c5c03aa17839",
                        "ST01-008_457bbd0e-5384-4e61-8905-e750d7e2e480",
                        "ST01-016_bacd5311-e6e2-49d6-8704-ad299c8c94d0",
                        "ST01-015_ea13eeab-fee1-4cc8-bc11-aef4e3083d77",
                        "ST01-008_89e4fa38-c53e-480a-ab96-d0c1b3f6a0a0",
                        "ST01-003_f0dd2024-d077-4e98-8c35-0759d43df8a4",
                        "ST01-008_9f9070f0-7ecf-4c7c-a803-1c27dc6c1cfb",
                        "ST01-007_81573b20-58e1-4355-8184-9fd17c0960fa",
                        "ST01-010_99b865e8-ba9b-4dcd-86e7-a7c4c413a239",
                        "ST01-012_0868a55b-2a94-42a7-8a68-dc0554ac96e8",
                        "ST01-004_1898e22d-0ab9-4f91-9b30-6b776b79e0f0",
                        "ST01-010_67c73fcf-a159-4a79-acd2-12f3d74b688c",
                        "ST01-007_1f7a3db4-a736-4b20-b49f-edea47d8a39d",
                        "ST01-001_5d256c81-a1c6-4ac2-9596-40f5a12cd62d",
                        "ST01-014_8c8e154c-00ad-4c78-a466-20ecf7af44bc",
                        "ST01-005_814ffac1-5397-43b2-a16c-ca9f18f8f8dc",
                        "ST01-014_30106a87-4fd8-4f39-986e-a5ef18885087"
                    ]
                },
                "confirmIsRedraw": true,
                "isRedraw": true,
                "playerPoint": 0,
                "isReady": false,
                "zones": {
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
                    },
                    "slot2": {
                        "unit": {
                            "carduid": "ST01-007_9b9840b9-2ef1-4f03-953a-c89d8d9cb833",
                            "cardId": "ST01-007",
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
                            },
                            "placedAt": 1759421278103,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 3,
                            "originalHP": 4,
                            "isFirstPlay": false,
                            "damageReceived": 0,
                            "continueModifyAP": 2,
                            "continueModifyHP": 0
                        },
                        "pilot": {
                            "carduid": "ST01-011_8401fb6e-2c85-4b5e-9194-ee83e2a20f60",
                            "cardId": "ST01-011",
                            "cardData": {
                                "id": "ST01-011",
                                "name": "Suletta Mercury",
                                "cardType": "pilot",
                                "color": "White",
                                "level": 4,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Academy"
                                ],
                                "link": [],
                                "ap": 1,
                                "hp": 2,
                                "effects": {
                                    "description": [
                                        "【Burst】Add this card to your hand.",
                                        "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active."
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
                                            "effectId": "attack_activate_resource",
                                            "type": "activated",
                                            "timing": [
                                                "ATTACK_PHASE"
                                            ],
                                            "restrictions": [
                                                "once_per_turn"
                                            ],
                                            "target": {
                                                "type": "resource",
                                                "scope": "self",
                                                "count": 1
                                            },
                                            "action": "setActive"
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1759421328211,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 1,
                            "originalHP": 2,
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 4,
                            "totalOriginalHP": 6,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 2,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 6,
                            "totalHP": 6,
                            "isRested": false
                        }
                    },
                    "slot3": {
                        "unit": {
                            "carduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
                            "cardId": "ST01-001",
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
                            },
                            "placedAt": 1759421280128,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 3,
                            "originalHP": 4,
                            "isFirstPlay": true,
                            "damageReceived": 0,
                            "continueModifyAP": 2,
                            "continueModifyHP": 0
                        },
                        "pilot": {
                            "carduid": "ST01-012_675066d3-7c75-40dd-9a6c-84e1e32e90b5",
                            "cardId": "ST01-012",
                            "cardData": {
                                "id": "ST01-012",
                                "name": "Thoroughly Damaged",
                                "cardType": "command",
                                "color": "Blue",
                                "level": 2,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
                                        "【Pilot】[Hayato Kobayashi]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_damage_rested",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "status": "rested"
                                                },
                                                "count": 1
                                            },
                                            "action": "damage",
                                            "parameters": {
                                                "value": 1
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Hayato Kobayashi",
                                                "AP": 0,
                                                "HP": 1
                                            }
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1759421289275,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 0,
                            "originalHP": 1,
                            "playedAs": "pilot",
                            "originalCardType": "command",
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 3,
                            "totalOriginalHP": 5,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 2,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 5,
                            "totalHP": 5,
                            "isRested": false
                        }
                    },
                    "slot4": {
                        "unit": {
                            "carduid": "ST01-001_99bf72e0-45e9-42d1-b279-2aa8875edbbd",
                            "cardId": "ST01-001",
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
                            },
                            "placedAt": 1759421305044,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 3,
                            "originalHP": 4,
                            "isFirstPlay": true,
                            "damageReceived": 0,
                            "continueModifyAP": 2,
                            "continueModifyHP": 0
                        },
                        "pilot": {
                            "carduid": "ST01-012_bcf658c0-29b4-43ea-b923-6787983a0439",
                            "cardId": "ST01-012",
                            "cardData": {
                                "id": "ST01-012",
                                "name": "Thoroughly Damaged",
                                "cardType": "command",
                                "color": "Blue",
                                "level": 2,
                                "cost": 1,
                                "zone": [],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 1,
                                "effects": {
                                    "description": [
                                        "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
                                        "【Pilot】[Hayato Kobayashi]"
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "main_damage_rested",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "filters": {
                                                    "status": "rested"
                                                },
                                                "count": 1
                                            },
                                            "action": "damage",
                                            "parameters": {
                                                "value": 1
                                            }
                                        },
                                        {
                                            "effectId": "pilot_designation",
                                            "type": "special",
                                            "trigger": "continuous",
                                            "target": {
                                                "type": "pilot",
                                                "scope": "any"
                                            },
                                            "action": "designate_pilot",
                                            "parameters": {
                                                "pilotName": "Hayato Kobayashi",
                                                "AP": 0,
                                                "HP": 1
                                            }
                                        }
                                    ]
                                }
                            },
                            "placedAt": 1759421308327,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 0,
                            "originalHP": 1,
                            "playedAs": "pilot",
                            "originalCardType": "command",
                            "continueModifyAP": 0,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 3,
                            "totalOriginalHP": 5,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 2,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 5,
                            "totalHP": 5,
                            "isRested": false
                        }
                    },
                    "slot5": {
                        "unit": {
                            "carduid": "ST01-003_7cbc533a-96d0-428e-8eab-b07c7d5943e5",
                            "cardId": "ST01-003",
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
                            },
                            "placedAt": 1759421324067,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalAP": 2,
                            "originalHP": 4,
                            "isFirstPlay": true,
                            "damageReceived": 0,
                            "continueModifyAP": 2,
                            "continueModifyHP": 0
                        },
                        "fieldCardValue": {
                            "totalOriginalAP": 2,
                            "totalOriginalHP": 4,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 2,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 4,
                            "totalHP": 4,
                            "isRested": false
                        }
                    },
                    "slot6": {
                        "fieldCardValue": {
                            "totalOriginalAP": 0,
                            "totalOriginalHP": 0,
                            "totalTempModifyAP": 0,
                            "totalTempModifyHP": 0,
                            "totalContinueModifyAP": 0,
                            "totalContinueModifyHP": 0,
                            "totalDamageReceived": 0,
                            "totalAP": 0,
                            "totalHP": 0,
                            "isRested": false
                        }
                    },
                    "base": [],
                    "shieldArea": [
                        {
                            "carduid": "ST01-014_a3466e63-bec3-4dc0-9c9b-11d7e77f4637",
                            "cardId": "ST01-014",
                            "cardData": {
                                "id": "ST01-014",
                                "name": "Unforeseen Incident",
                                "cardType": "shield",
                                "color": "White",
                                "level": 3,
                                "cost": 1,
                                "zone": [],
                                "traits": [],
                                "link": [],
                                "ap": 0,
                                "hp": 0,
                                "effects": {
                                    "description": [
                                        "【Burst】Activate this card's 【Main】.",
                                        "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_activate_main",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "action": "activate_ability",
                                            "parameters": {
                                                "abilityType": "main"
                                            }
                                        },
                                        {
                                            "effectId": "main_action_ap_reduction",
                                            "type": "activated",
                                            "timing": {
                                                "windows": [
                                                    "MAIN_PHASE",
                                                    "ACTION_STEP"
                                                ],
                                                "duration": "UNTIL_END_OF_TURN"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "opponent",
                                                "count": 1
                                            },
                                            "action": "modifyAP",
                                            "parameters": {
                                                "value": -3
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "command"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalCardType": "command"
                        },
                        {
                            "carduid": "ST01-016_344d543e-eea7-49d2-bcf3-f3d406cbf07a",
                            "cardId": "ST01-016",
                            "cardData": {
                                "id": "ST01-016",
                                "name": "Asticassia School of Technology, Earth House",
                                "cardType": "shield",
                                "color": "White",
                                "level": 2,
                                "cost": 1,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Academy",
                                    "Stronghold"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "deploy",
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "effect": {
                                                "action": "addToHand",
                                                "parameters": {
                                                    "count": 1,
                                                    "from": "shield"
                                                },
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "activate_boost_link_units",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "cost": {
                                                "tap": "self"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "self_all",
                                                "filters": {
                                                    "linkStatus": "linked"
                                                }
                                            },
                                            "effect": {
                                                "action": "modifyAP",
                                                "parameters": {
                                                    "modifier": "+1"
                                                },
                                                "duration": "turn"
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "base"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalCardType": "base"
                        },
                        {
                            "carduid": "ST01-002_0faf4a73-374b-4846-ac35-3858e4a2e951",
                            "cardId": "ST01-002",
                            "cardData": {
                                "id": "ST01-002",
                                "name": "Gundam(MA Form)",
                                "cardType": "shield",
                                "color": "Blue",
                                "level": 5,
                                "cost": 3,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Earth Federation",
                                    "White Base Team"
                                ],
                                "link": [
                                    "Amuro Ray"
                                ],
                                "ap": 4,
                                "hp": 3,
                                "effects": {
                                    "description": [
                                        "【When Paired･(White Base Team) pilot】Draw 1."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "paired_white_base_draw",
                                            "type": "triggered",
                                            "trigger": "PAIRING_COMPLETE",
                                            "conditions": [
                                                {
                                                    "type": "traitMatch",
                                                    "target": "pilot",
                                                    "traits": [
                                                        "White Base Team"
                                                    ]
                                                }
                                            ],
                                            "target": {
                                                "type": "player",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "draw",
                                                "parameters": {
                                                    "amount": 1
                                                },
                                                "duration": "instant"
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "unit"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalCardType": "unit"
                        },
                        {
                            "carduid": "ST01-009_27616e68-59a6-4b97-9a87-9e3820290dfb",
                            "cardId": "ST01-009",
                            "cardData": {
                                "id": "ST01-009",
                                "name": "Zowort",
                                "cardType": "shield",
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
                                },
                                "originalCardType": "unit"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalCardType": "unit"
                        },
                        {
                            "carduid": "ST01-015_9f7db9af-e97a-4cbb-a136-b59e9644715a",
                            "cardId": "ST01-015",
                            "cardData": {
                                "id": "ST01-015",
                                "name": "White Base",
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
                                    "White Base Team",
                                    "Warship"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】【Once per Turn】②：Deploy 1 [Gundam]((White Base Team)･AP3･HP3) Unit token if you have no Units in play, deploy 1 [Guncannon]((White Base Team)･AP2･HP2) Unit token if you have only 1 Unit in play, or deploy 1 [Guntank]((White Base Team)･AP1･HP1) Unit token if you have 2 or more Units in play."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "deploy",
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "effect": {
                                                "action": "addToHand",
                                                "parameters": {
                                                    "count": 1,
                                                    "from": "shield"
                                                },
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "activate_conditional_token_deploy",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "cost": {
                                                "resource": 2,
                                                "oncePerTurn": true
                                            },
                                            "conditions": [
                                                "boardStateCheck"
                                            ],
                                            "effect": {
                                                "action": "conditionalTokenDeploy",
                                                "parameters": {
                                                    "condition1": {
                                                        "unitsInPlay": 0,
                                                        "token": {
                                                            "name": "Gundam",
                                                            "traits": [
                                                                "White Base Team"
                                                            ],
                                                            "ap": 3,
                                                            "hp": 3
                                                        }
                                                    },
                                                    "condition2": {
                                                        "unitsInPlay": 1,
                                                        "token": {
                                                            "name": "Guncannon",
                                                            "traits": [
                                                                "White Base Team"
                                                            ],
                                                            "ap": 2,
                                                            "hp": 2
                                                        }
                                                    },
                                                    "condition3": {
                                                        "unitsInPlay": ">=2",
                                                        "token": {
                                                            "name": "Guntank",
                                                            "traits": [
                                                                "White Base Team"
                                                            ],
                                                            "ap": 1,
                                                            "hp": 1
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "base"
                            },
                            "placedAt": 1757854884783,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalCardType": "base"
                        }
                    ],
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
                        {
                            "carduid": "energy_basic_1757855233104_0.29613414097292967",
                            "cardId": "energy_basic",
                            "placedAt": 1757855233104,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1757855238087_0.385315362359135",
                            "cardId": "energy_basic",
                            "placedAt": 1757855238087,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1757855245343_0.6822960923105597",
                            "cardId": "energy_basic",
                            "placedAt": 1757855245343,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1758009290197_0.5975102353525523",
                            "cardId": "energy_basic",
                            "placedAt": 1758009290197,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421274896_0.3214271277028944",
                            "cardId": "energy_basic",
                            "placedAt": 1759421274896,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421299513_0.991182954254967",
                            "cardId": "energy_basic",
                            "placedAt": 1759421299513,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421302609_0.3874309315933615",
                            "cardId": "energy_basic",
                            "placedAt": 1759421302609,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421315426_0.5929736388919873",
                            "cardId": "energy_basic",
                            "placedAt": 1759421315426,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421335004_0.13025304359126988",
                            "cardId": "energy_basic",
                            "placedAt": 1759421335004,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759421338368_0.624216850889034",
                            "cardId": "energy_basic",
                            "placedAt": 1759421338368,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        },
                        {
                            "carduid": "energy_basic_1759646535841_0.38861593733310107",
                            "cardId": "energy_basic",
                            "placedAt": 1759646535841,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "isExtraEnergy": false,
                            "cardData": {
                                "cardType": "energy"
                            }
                        }
                    ],
                    "trashArea": [
                        {
                            "carduid": "base_default",
                            "cardId": "base",
                            "cardData": {
                                "cardType": "base"
                            },
                            "placedAt": 1758009288063,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalHP": 3,
                            "damageReceived": 0
                        },
                        {
                            "carduid": "ST01-016_fba4786e-2dd2-4f90-9698-1cfd0067715f",
                            "cardId": "ST01-016",
                            "cardData": {
                                "id": "ST01-016",
                                "name": "Asticassia School of Technology, Earth House",
                                "cardType": "base",
                                "color": "White",
                                "level": 2,
                                "cost": 1,
                                "zone": [
                                    "Space"
                                ],
                                "traits": [
                                    "Academy",
                                    "Stronghold"
                                ],
                                "link": [],
                                "ap": 0,
                                "hp": 5,
                                "effects": {
                                    "description": [
                                        "【Burst】Deploy this card.",
                                        "【Deploy】Add 1 of your Shields to your hand.",
                                        "【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during this turn."
                                    ],
                                    "rules": [
                                        {
                                            "effectId": "burst_deploy",
                                            "type": "triggered",
                                            "trigger": "BURST_CONDITION",
                                            "target": {
                                                "type": "card",
                                                "scope": "self"
                                            },
                                            "effect": {
                                                "action": "deploy",
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "deploy_shield_to_hand",
                                            "type": "triggered",
                                            "trigger": "ENTERS_PLAY",
                                            "target": {
                                                "type": "card",
                                                "scope": "self_shield"
                                            },
                                            "effect": {
                                                "action": "addToHand",
                                                "parameters": {
                                                    "count": 1,
                                                    "from": "shield"
                                                },
                                                "duration": "instant"
                                            }
                                        },
                                        {
                                            "effectId": "activate_boost_link_units",
                                            "type": "activated",
                                            "timing": [
                                                "MAIN_PHASE"
                                            ],
                                            "cost": {
                                                "tap": "self"
                                            },
                                            "target": {
                                                "type": "unit",
                                                "scope": "self_all",
                                                "filters": {
                                                    "linkStatus": "linked"
                                                }
                                            },
                                            "effect": {
                                                "action": "modifyAP",
                                                "parameters": {
                                                    "modifier": "+1"
                                                },
                                                "duration": "turn"
                                            }
                                        }
                                    ]
                                },
                                "originalCardType": "base"
                            },
                            "placedAt": 1759421361520,
                            "placedBy": "playerId_2",
                            "isRested": false,
                            "originalHP": 5,
                            "damageReceived": 0
                        }
                    ],
                    "repairAbilitiesCheckedThisCycle": false
                },
                "effectRegistry": {
                    "pilot_designation_ST01-012_675066d3-7c75-40dd-9a6c-84e1e32e90b5": {
                        "effectId": "pilot_designation",
                        "sourceCarduid": "ST01-012_675066d3-7c75-40dd-9a6c-84e1e32e90b5",
                        "sourcePlayerId": "playerId_2",
                        "effectData": {
                            "effectId": "pilot_designation",
                            "type": "special",
                            "trigger": "continuous",
                            "target": {
                                "type": "pilot",
                                "scope": "any"
                            },
                            "action": "designate_pilot",
                            "parameters": {
                                "pilotName": "Hayato Kobayashi",
                                "AP": 0,
                                "HP": 1
                            }
                        },
                        "scope": "any",
                        "action": "designate_pilot",
                        "value": 0,
                        "conditions": [],
                        "active": true,
                        "timestamp": 1759421289278
                    },
                    "pilot_designation_ST01-012_bcf658c0-29b4-43ea-b923-6787983a0439": {
                        "effectId": "pilot_designation",
                        "sourceCarduid": "ST01-012_bcf658c0-29b4-43ea-b923-6787983a0439",
                        "sourcePlayerId": "playerId_2",
                        "effectData": {
                            "effectId": "pilot_designation",
                            "type": "special",
                            "trigger": "continuous",
                            "target": {
                                "type": "pilot",
                                "scope": "any"
                            },
                            "action": "designate_pilot",
                            "parameters": {
                                "pilotName": "Hayato Kobayashi",
                                "AP": 0,
                                "HP": 1
                            }
                        },
                        "scope": "any",
                        "action": "designate_pilot",
                        "value": 0,
                        "conditions": [],
                        "active": true,
                        "timestamp": 1759421308328
                    },
                    "pair_ap_boost_all_ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84": {
                        "effectId": "pair_ap_boost_all",
                        "sourceCarduid": "ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84",
                        "sourcePlayerId": "playerId_2",
                        "effectData": {
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
                        },
                        "scope": "self_all_unit",
                        "action": "modifyAP",
                        "value": 1,
                        "conditions": [],
                        "active": true,
                        "timestamp": 1759646535842
                    },
                    "pair_ap_boost_all_ST01-001_99bf72e0-45e9-42d1-b279-2aa8875edbbd": {
                        "effectId": "pair_ap_boost_all",
                        "sourceCarduid": "ST01-001_99bf72e0-45e9-42d1-b279-2aa8875edbbd",
                        "sourcePlayerId": "playerId_2",
                        "effectData": {
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
                        },
                        "scope": "self_all_unit",
                        "action": "modifyAP",
                        "value": 1,
                        "conditions": [],
                        "active": true,
                        "timestamp": 1759646535842
                    }
                }
            }
        },
        "processingQueue": [],
        "processingEnabled": true,
        "maxEventsPerCycle": 50,
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
            }
        ],
        "lastEventId": 0
    }
}