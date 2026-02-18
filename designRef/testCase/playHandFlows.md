# Play Hand Card Flows – BasicCase/basicMainBasest01_016_1

Load page `http://localhost:5173/game?mode=host&automation=1`, then run these snippets via console or chrome-dev MCP `evaluate_script`. They use `window.__card`.

## 1) Load scenario
```js
() => window.__card.engine.setScenario('BasicCase/basicMainBasest01_016_1')
```

## 2) Simulate UI clicks (select card, press Play Card)
Use semantic helpers on `window.__card`.

### Play a unit (uses `ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876`)
```js
async () => {
  window.__card.hand.select('ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876');
  await window.__card.action.clickPrimary('hand');
  await window.__card.engine.pollOnce();
  return 'unit played via UI flow';
}
```

### Play a regular command (non pilot-designation, `ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d`)
```js
async () => {
  window.__card.hand.select('ST01-014_208685cf-f7c9-4c50-b66f-2e125760ac0d');
  await window.__card.action.clickPrimary('hand');
  // If an effect target dialog appears, auto-select the first available target (index 0).
  await window.__card.dialogs.effectTargetChoose(0);
  await window.__card.engine.pollOnce();
  alert('command played via UI flow'); // acknowledge step
  return 'command played via UI flow';
}
```

### Play pilot-designation command as a pilot
`ST01-013_51703d0a-9541-49b5-8b82-998293564235`, target the unit from the first step.
```js
async () => {
  window.__card.hand.select('ST01-013_51703d0a-9541-49b5-8b82-998293564235');
  await window.__card.action.clickPrimary('hand'); // opens pilot designation dialog
  // If needed by flow, choose pilot mode first using action id:
  // await window.__card.action.run('playPilotDesignationAsPilot', 'neutral');
  // clicking Pilot button
  await new Promise((r) => setTimeout(r, 2000)); // small wait for dialog/targets to settle
  await window.__card.dialogs.pilotTargetChoose(0); // auto-select first eligible unit
  await window.__card.engine.pollOnce();
  alert('pilot-designation command as pilot triggered; ensure target selected'); // acknowledge step
  return 'pilot-designation command played as pilot via UI flow';
}
```
