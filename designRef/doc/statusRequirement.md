in the top right corner (header), there is a status label
in the game logic
it will have 
1.Wait For Start
2.Milligan Phase
3.Reload Phase
4.Main Phase
5.Blocker Phase
6.Action Step
7.End Phase

currently (Wait For Start ,Milligan Phase ,Reload Phase,End Phase ) is not well defined.

For main phase, when `gameEnv.phase = MAIN_PHASE`, there is **no** unresolved `BLOCKER_CHOICE` in `processingQueue`, and `gameEnv.currentBattle = null`, we can say it is in main phase (the status label should show Main Phase).

For blocker phase, when `gameEnv.phase = MAIN_PHASE` and there is an unresolved `BLOCKER_CHOICE` in `processingQueue` (regardless of whether `gameEnv.currentBattle` is null), we can say it is in Blocker Phase (the status label should show Blocker Phase).
 
For Action step phase, when `gameEnv.phase = MAIN_PHASE`, there is **no** unresolved `BLOCKER_CHOICE` in `processingQueue`, and `gameEnv.currentBattle` is not null (and typically `currentBattle.status = ACTION_STEP`), we can say it is in Action Step (the status label should show Action Step).
