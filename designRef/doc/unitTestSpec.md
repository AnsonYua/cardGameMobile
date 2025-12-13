1.i predefined some gameEnv/gameStatus in backend. this just like a test case. by calling the action SetScenario in DebugControl.ts. it will set the gameid with my target environment.

2.i want u create some javascript function call such that u can trigger SetScenario. with these function you can make use of chrome-dev mcp to call these javascript in window.document and set a environment for me to further testing. this is the very first step of all test case.

### How to trigger testing hooks (after loading the page, e.g. http://localhost:5173/?mode=host)

We exposed helpers on `window.__cardTest` so you can call them via the browser console or through chrome-dev MCP `evaluate_script`:
setScenario
- `window.__cardTest.setScenario(path?)`  
  Injects a predefined scenario; defaults to `BasicCase/basicMainBasest01_016_1` if no path is provided.

- `window.__cardTest.pollOnce()`  
  Manually refreshes game status once.

- `window.__cardTest.startAutoPolling()` / `window.__cardTest.stopAutoPolling()`  
  Starts/stops a repeating status poll (current interval: 1s from DebugControls).

Example (chrome-dev MCP):
```js
() => window.__cardTest.setScenario('BasicCase/basicMainBasest01_016_1')
```

3.by the way, u should also start with http://localhost:5173?mode=host



