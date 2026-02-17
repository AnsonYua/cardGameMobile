# UI Test Spec (`/game`) - Chrome MCP + Console

This document replaces the old `unitTestSpec.md` and merges:
- Legacy test hooks: `window.__cardTest` (existing implementation)
- New semantic automation bridge: `window.__card` (current implementation)

## 1) Start URL

Use:
- `http://localhost:5173/game?mode=host&automation=1`

Optional query flags:
- `isAutoPolling=1`
- `aimode=1`

Notes:
- `window.__card` is exposed only when `automation=1` or `automation=true`.
- `window.__cardTest` remains available for backward compatibility.

## 2) Legacy Hooks (`window.__cardTest`)

These existed before and still work:
- `window.__cardTest.setScenario(path?)`
- `window.__cardTest.pollOnce()`
- `window.__cardTest.startAutoPolling()`
- `window.__cardTest.stopAutoPolling()`

Example:
```js
() => window.__cardTest.setScenario('BasicCase/basicMainBasest01_016_1')
```

## 3) New Automation API (`window.__card`)

### Core
- `window.__card.snapshot()`
- `window.__card.list()`
- `await window.__card.click(target)`
- `await window.__card.waitFor(predicate, { timeoutMs, intervalMs })`
- `await window.__card.waitForIdle({ timeoutMs, intervalMs })`

### Action Bar
- `window.__card.action.list()`
- `await window.__card.action.clickPrimary(source?)`
- `await window.__card.action.clickByLabel(label)`
- `await window.__card.action.clickByIndex(index)`
- `await window.__card.action.run(actionId, source?)`

### Hand
- `window.__card.hand.list()`
- `window.__card.hand.select(uid)`
- `await window.__card.hand.click(uid)`
- `window.__card.hand.getSelectedUid()`

### Slots
- `window.__card.slot.list()`
- `await window.__card.slot.click(owner, slotId)`
- `window.__card.slot.getSelected()`

### Base
- `await window.__card.base.click('player' | 'opponent')`
- `window.__card.base.get('player' | 'opponent')`

### Dialogs
- `window.__card.dialogs.list()`
- `await window.__card.dialogs.promptChoose(labelOrIndex)`
- `await window.__card.dialogs.optionChoose(index)`
- `await window.__card.dialogs.tokenChoose(index)`
- `await window.__card.dialogs.burstChoose('trigger' | 'cancel')`
- `await window.__card.dialogs.pilotTargetChoose(index)`
- `await window.__card.dialogs.effectTargetChoose(index)`
- `await window.__card.dialogs.mulliganChoose('yes' | 'no')`
- `await window.__card.dialogs.chooseFirstPlayer('first' | 'second')`

### Engine helpers (reuse DebugControls)
- `await window.__card.engine.pollOnce()`
- `await window.__card.engine.startAutoPolling()`
- `await window.__card.engine.stopAutoPolling()`
- `await window.__card.engine.setScenario(path)`

## 4) Typical MCP Agent Flow

1. Initialize game state:
```js
await window.__card.engine.setScenario('BasicCase/basicMainBasest01_016_1');
await window.__card.engine.pollOnce();
```

2. Read current UI state:
```js
const snapshot = window.__card.snapshot();
```

3. Get semantic interactables:
```js
const targets = window.__card.list();
```

4. Play one action:
```js
const hand = snapshot.ui.hand.cards;
if (hand.length && hand[0].uid) {
  await window.__card.hand.click(hand[0].uid);
  await window.__card.action.clickPrimary('hand');
}
```

5. Wait for UI stability / prompt:
```js
await window.__card.waitForIdle({ timeoutMs: 10000 });
await window.__card.waitFor(
  s => s.ui.dialogs.some(d => d.type === 'PROMPT_CHOICE'),
  { timeoutMs: 8000 }
);
await window.__card.dialogs.promptChoose(0);
```

## 5) Target String IDs for `click(...)`

Supported examples:
- `action:primary`
- `action:index:0`
- `hand:uid:<uid>`
- `slot:player:slot1`
- `slot:opponent:slot4`
- `base:player`
- `base:opponent`
- `dialog:prompt:0`
- `dialog:option:1`
- `dialog:token:0`
- `dialog:burst:trigger`
- `dialog:mulligan:yes`
- `dialog:first:first`
- `dialog:pilot:0`
- `dialog:effect:0`

## 6) Behavior Contract

- APIs are semantic (controller callbacks), not pixel-coordinate clicks.
- Most actions return `false` when unavailable instead of throwing.
- `waitFor` / `waitForIdle` throw on timeout.
- Existing game logic and flow are unchanged; this layer only exposes automation interfaces.
