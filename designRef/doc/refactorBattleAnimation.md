i want you help me refactor the updateSlot especially the logic for handling battle animation.

goals
- replace the old lockedSlots + mixed render flow with an event-driven snapshot flow
- keep a preview snapshot for affected slots and update it as events finish
- hide slots during the battle animation itself, then show them again when it finishes

current architecture (refactor status)
- centralized queue + render controller
  - AnimationQueue
    - builds events from notificationQueue
    - dedupes by event id
    - executes animations in FIFO order
    - exposes event start/end hooks
  - SlotAnimationRenderController
    - snapshot map of pre-animation slot visuals (preview snapshot)
    - updates snapshot for CARD_STAT_MODIFIED using preview slot as base
    - composes the final slots to render
- no lockedSlots or per-slot merge logic
- BoardScene orchestrates:
  - build events → start render snapshot → enqueue
  - render snapshots on event start/end

data requirements
- previous snapshot raw: used to snapshot the pre-animation slot visuals
- current snapshot raw: used to update snapshots when each event finishes
- notificationQueue: parsed into AnimationEvent list
- affected cards: extracted from notification payload (attacker/target/played card)

current updateSlots flow (pseudo)
```
updateSlots() {
  snapshot = engine.getSnapshot()
  raw = snapshot.raw
  previousRaw = snapshot.previousRaw
  if (!raw) return

  currentSlots = slotPresenter.toSlots(raw, playerId)
  events = animationQueue.buildEvents(notificationQueue)
  queueRunning = animationQueue.isRunning()

  if (allowAnimations && events.length > 0 && !queueRunning) {
    previousSlots = slotPresenter.toSlots(previousRaw ?? raw, playerId)
    initialSlots = slotAnimationRender.startBatch(events, previousSlots, currentSlots)
    renderSlots(initialSlots)         // render snapshot BEFORE enqueue
    animationQueue.enqueue(events, ctx)
    return
  }

  if (allowAnimations && queueRunning) return
  renderSlots(currentSlots)
}
```

animationQueue event build (pseudo)
```
buildEvents(notificationQueue) {
  // map supported notifications into SlotNotification[]
}
```

queue behavior (pseudo)
```
enqueue(events, ctx) {
  // FIFO queue, dedupe by event id
}

onEventStart(event) -> hide affected slots (default)
onEventStart(CARD_STAT_MODIFIED) -> update preview snapshot using delta
onEventEnd(event) -> copy current slot into snapshot (default)
onIdle -> render current snapshot
```

important changes
- remove lockedSlots usage in renderSlots
- preview snapshots drive visual state during animations
- notification scanning determines whether to start the queue

refactor goals (current state)
- centralize notification handling: UNIT_ATTACK_DECLARED, CARD_PLAYED_COMPLETED, BATTLE_RESOLVED, CARD_STAT_MODIFIED
- NotificationAnimationController no longer owns a queue
- AnimationQueue is the single FIFO queue and also builds events
- AnimationCaches removed

structure now (centerized + modular)
- AnimationQueue (single queue + event builder + executor)
  - FIFO queue, runs events sequentially
  - dedupe by event id
  - triggers onEventStart/onEventEnd to update render snapshots
  - executes card play, battle resolution, stat pulses, attack indicator updates

- SlotAnimationRenderController
  - owns snapshot map for pre-animation slot visuals
  - updates snapshot on CARD_STAT_MODIFIED based on preview snapshot
  - composes final slot list for render

data flow (high level)
1) updateSlots() builds notificationQueue
2) AnimationQueue.buildEvents parses notificationQueue
3) SlotAnimationRenderController.startBatch builds preview snapshots
4) AnimationQueue runs events sequentially
5) BoardScene renders snapshots on event start/end, current slots on idle

event routing rules (current)
```
CARD_PLAYED_COMPLETED -> NotificationAnimationController.playCardPlayed
UNIT_ATTACK_DECLARED -> update attack indicator + capture snapshot
REFRESH_TARGET -> update attack indicator with forced target
BATTLE_RESOLVED -> BattleAnimationManager.playBattleResolution
CARD_STAT_MODIFIED -> playStatPulse
```

expected payloads (minimum fields)

CARD_PLAYED_COMPLETED
```
{
  "id": "string",
  "type": "CARD_PLAYED_COMPLETED",
  "payload": {
    "carduid": "string",
    "playerId": "string",
    "playAs": "command|base|unit|pilot",
    "reason": "hand",
    "isCompleted": true
  }
}
```
field usage
- `carduid`: used to locate the card and slot destination.
- `playerId`: determines self vs opponent for animation origin.
- `playAs`: routes to command/base/slot animation path.
- `reason`: must be `"hand"` for animation to run.
- `isCompleted`: must be true before animation runs.

UNIT_ATTACK_DECLARED
```
{
  "id": "string",
  "type": "UNIT_ATTACK_DECLARED",
  "payload": {
    "attackingPlayerId": "string",
    "defendingPlayerId": "string",
    "attackerCarduid": "string",
    "attackerSlot": "slot1",
    "targetCarduid": "string",
    "targetSlotName": "slot3",
    "forcedTargetCarduid": "string",
    "forcedTargetZone": "slot3",
    "forcedTargetPlayerId": "string"
  }
}
```
field usage
- `attackingPlayerId` / `defendingPlayerId`: resolve attacker/defender owner side.
- `attackerCarduid`: locate attacking slot for arrow start.
- `attackerSlot`: fallback slot id if carduid lookup fails.
- `targetCarduid`: locate target slot for arrow end.
- `targetSlotName`: fallback slot id if carduid lookup fails.
- `forcedTargetCarduid` / `forcedTargetZone` / `forcedTargetPlayerId`: overrides normal target resolution.

REFRESH_TARGET
```
{
  "id": "string",
  "type": "REFRESH_TARGET",
  "payload": {
    "attackingPlayerId": "string",
    "defendingPlayerId": "string",
    "attackerCarduid": "string",
    "attackerSlot": "slot1",
    "forcedTargetCarduid": "string",
    "forcedTargetZone": "slot3",
    "forcedTargetPlayerId": "string",
    "sourceNotificationId": "string"
  }
}
```
field usage
- `attackingPlayerId` / `defendingPlayerId`: resolve attacker/defender owner side.
- `attackerCarduid`: locate attacking slot for arrow start.
- `attackerSlot`: fallback slot id if carduid lookup fails.
- `forcedTargetCarduid` / `forcedTargetZone` / `forcedTargetPlayerId`: overrides target resolution for the arrow.
- `sourceNotificationId`: link back to the original UNIT_ATTACK_DECLARED event.

BATTLE_RESOLVED
```
{
  "id": "string",
  "type": "BATTLE_RESOLVED",
  "payload": {
    "battleType": "attackUnit",
    "attackNotificationId": "string",
    "attackingPlayerId": "string",
    "defendingPlayerId": "string",
    "forcedTargetCarduid": "string",
    "forcedTargetZone": "slot3",
    "forcedTargetPlayerId": "string",
    "attacker": {
      "playerId": "string",
      "slot": "slot1",
      "unit": { "carduid": "string" }
    },
    "target": {
      "playerId": "string",
      "slot": "slot3",
      "unit": { "carduid": "string" }
    },
    "result": {
      "attackerDestroyed": true,
      "defenderDestroyed": true
    }
  }
}
```
field usage
- `battleType`: selects battle animation style if needed.
- `attackNotificationId`: ties resolution back to the declared attack.
- `attackingPlayerId` / `defendingPlayerId`: resolve sides for fallback target resolution.
- `attacker.playerId` / `target.playerId`: preferred owner resolution.
- `attacker.slot` / `target.slot`: slot fallback for sprite seed.
- `attacker.unit.carduid` / `target.unit.carduid`: find attacker/target slot in current render snapshot.
- `forcedTargetCarduid` / `forcedTargetZone` / `forcedTargetPlayerId`: overrides normal target resolution in AttackResolver and attack indicator.
- `result.attackerDestroyed` / `result.defenderDestroyed`: decide fade out vs return/pulse.

CARD_STAT_MODIFIED
```
{
  "id": "string",
  "type": "CARD_STAT_MODIFIED",
  "payload": {
    "playerId": "string",
    "carduid": "string",
    "zone": "slot2",
    "stat": "modifyAP|modifyHP",
    "delta": -3
  }
}
```
field usage
- `playerId` + `zone`: preferred slot key for stat pulse.
- `carduid`: fallback for resolving slot if zone missing.
- `stat`: selects AP vs HP update in preview snapshot.
- `delta`: value applied to preview snapshot and pulse intensity.

queue behavior (centralized)
```
class AnimationQueue {
  enqueue(events) { ... }
  runNext() { ... } // await executor.run(event)
  isRunning() { ... }
}
```

render snapshots (current)
- snapshot is built once per batch (previousRaw → currentSlots)
- CARD_STAT_MODIFIED:
  - find affected slot keys
  - apply delta to preview snapshot (AP/HP) so intermediate values show
- on event end:
  - UNIT_ATTACK_DECLARED keeps preview snapshot
  - CARD_STAT_MODIFIED keeps preview snapshot
  - others copy current slot into snapshot

removals / simplifications
- NotificationAnimationController queue removed
- AnimationCaches removed
- AnimationOrchestrator/handlers removed

battle animation specifics (current)
- BattleAnimationManager now hides attacker/target slots during animation
- Sprite uses slot visuals (unit + pilot + AP/HP) via SlotDisplayHandler.createSlotSprite
- resolveAttackTargetPoint supports nested payloads (payload.target.*)
- attack indicator is cleared on BATTLE_RESOLVED
