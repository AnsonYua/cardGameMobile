# Play Hand Card Flows – BasicCase/basicMainBasest01_016_1

Load page `http://localhost:5173/?mode=host`, then run these snippets via console or chrome-dev MCP `evaluate_script`. They use `window.__cardTest` hooks we added and raw fetch calls to the backend API.

## 1) Load scenario
```js
() => window.__cardTest.setScenario('BasicCase/basicMainBasest01_016_1')
```

## 2) Prepare helper to play cards
```js
() => {
  const playCard = (carduid, playAs, extra = {}) =>
    fetch(`${location.origin}/api/game/player/playCard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: 'playerId_2',
        gameId: 'sample_play_card',
        action: { type: 'PlayCard', carduid, playAs, ...extra },
      }),
    }).then(r => r.json());
  window.__cardTest.playCard = playCard; // helper for later steps
  return 'playCard helper ready';
}
```

## 3) Play a unit
Uses `ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876` from the scenario hand.
```js
async () => {
  await window.__cardTest.playCard('ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876', 'unit');
  await window.__cardTest.pollOnce();
  return 'unit played';
}
```

## 4) Play a regular command (non pilot-designation)
Uses `ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d`.
```js
async () => {
  await window.__cardTest.playCard('ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d', 'command');
  await window.__cardTest.pollOnce();
  return 'command played';
}
```

## 5) Play pilot-designation command as a pilot
Uses `ST01-013_51703d0a-9541-49b5-8b82-998293564235`, targeting the unit from step 3.
```js
async () => {
  await window.__cardTest.playCard(
    'ST01-013_51703d0a-9541-49b5-8b82-998293564235',
    'pilot',
    { targetUnit: 'ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876' }
  );
  await window.__cardTest.pollOnce();
  return 'pilot-designation command played as pilot';
}
```

## 6) Play pilot-designation command as a command
Same card, no target.
```js
async () => {
  await window.__cardTest.playCard('ST01-013_51703d0a-9541-49b5-8b82-998293564235', 'command');
  await window.__cardTest.pollOnce();
  return 'pilot-designation command played as command';
}
```
