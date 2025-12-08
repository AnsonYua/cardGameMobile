you should look at gameStatus
gameEnv.players.{currentPlayer}.deck.hand

gameEnv.players.{currentPlayer}.deck.hand is array
[
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
            .....
]

Hand card area requirements (aligned with `ARCHITECTURE.md`)
1) Data source
- Drive rendering from the current `gameStatus` snapshot passed through `HandPresenter.toHandCards(gameEnv, playerId)`. The presenter already reads `gameEnv.players.{currentPlayer}.deck.hand` and builds view models (`HandCardView`) with `textureKey` = `{cardId}-preview`.

2) Image usage
- Use `{cardId}-preview` as the texture key when drawing cards. Textures are preloaded by `CardResourceLoader.loadFromGameStatus` during `GameEngine.fetchGameResources`; no extra network calls should happen from the hand renderer.

3) Layout & sizing
- Max 6 cards per row, up to 2 rows. When fewer than 6 cards in a row, expand widths to fill the available hand area evenly while keeping the card aspect ratio; rows share the same size when there are >6 cards.
- Cards are horizontally centered; vertically center the two rows within the hand area. Padding/gaps are handled inside `HandAreaHandler` so callers only pass the area bounds.

4) Labels for combat stats
- For `cardData.cardType` in (`unit`, `pilot`, `base`), render a black pill/label overlay using the mock at `designRef/refer.png` as visual guidance.
- For `effects.rules.effectId` = `pilot_designation` when `cardData.cardType` is `command`, render the same black pill using `effects.rules.parameters.AP|effects.rules.parameters.HP` as the label text.
- Label text format: `AP|HP` (e.g., `3|4`). If AP or HP is missing, treat it as `0`.

5) Interaction & refresh
- The hand view refreshes on `ENGINE_EVENTS.MAIN_PHASE_UPDATE` and when status snapshots change; `BoardScene.mainPhaseUpdate` delegates to `showHandCards()`, which uses `HandPresenter` and `HandAreaHandler.setHand`.
- Clearing/rehydrating the hand should flow through `HandAreaHandler.clearHand()` then `setHand(handCards)`; do not manipulate Phaser objects directly from `BoardScene`.

6) Long-press preview (mirrors slot preview style)
- Hold ~400ms on a hand card to open a preview; tap anywhere to dismiss. Preview stays visible after you release the press.
- Overlay dims the screen (alpha ~0.65) and draws the card at 300px width with an 88/64 aspect.
- Badge: a single 70x45 pill, centered on the card. For command cards with `pilot_designation`, use `effects.rules.parameters.AP|effects.rules.parameters.HP`; for pilot/base/unit (or `fromPilotDesignation`), use the same AP|HP logic from #4; otherwise hide the black label. Badge text is bold white on black.
