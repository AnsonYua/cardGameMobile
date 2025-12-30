i want you help me refactor the updateSlot especially the logic for handling battle animation.

goals
- replace the current animation flow (lockedSlots + mixed render) with a new flow
- during battle animation: render all slots from last gameEnv snapshot
- after the animation finishes: render the current gameEnv snapshot

current architecture (refactor status)
- centralized queue + render controller
  - AnimationQueue
    - builds events from notificationQueue
    - dedupes by event id
    - executes animations in FIFO order
    - exposes event start/end hooks
  - SlotAnimationRenderController
    - snapshot map of previous slot visuals
    - hides running slots while their event animates
    - updates snapshot when event finishes
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
  // map supported notifications into AnimationEvent[]
  // extract cardUids from payload (attacker/target/played card)
}
```

queue behavior (pseudo)
```
enqueue(events, ctx) {
  // FIFO queue, dedupe by event id
}

onEventStart(event) -> hide affected slots (default)
onEventEnd(event) -> copy current slot into snapshot (default)
onIdle -> render current snapshot
```

important changes
- remove lockedSlots usage in renderSlots
- battle animations drive the visual state (last snapshot during animation, current snapshot after)
- notification scanning determines whether to start the battle queue

refactor goals (current state)
- centralize notification handling: UNIT_ATTACK_DECLARED, CARD_PLAYED, BATTLE_RESOLVED, CARD_STAT_MODIFIED
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
  - hides running slots and updates snapshot when events finish
  - composes final slot list for render

data flow (high level)
1) updateSlots() builds notificationQueue
2) AnimationEventRouter parses notificationQueue -> AnimationEvents
3) AnimationQueue runs events sequentially via AnimationExecutor
4) updateSlots renders lastGameEnvRaw while queue is running, renders current raw after queue finishes

event normalization (pseudo)
```
AnimationEvent = {
  type: "CARD_PLAYED" | "UNIT_ATTACK_DECLARED" | "BATTLE_RESOLVED" | "CARD_STAT_MODIFIED",
  payload: any,
  cardUids: string[] // attacker/target/played card references
}
```

event routing rules (current)
```
CARD_PLAYED -> NotificationAnimationController.playCardPlayed
UNIT_ATTACK_DECLARED -> update attack indicator + capture snapshot
BATTLE_RESOLVED -> BattleAnimationManager.playBattleResolution
CARD_STAT_MODIFIED -> playStatPulse
```

queue behavior (centralized)
```
class AnimationQueue {
  enqueue(events) { ... }
  runNext() { ... } // await executor.run(event)
  isRunning() { ... }
}
```

notification scan for battle gating
- central router extracts cardUids for attacker/target/played card
- if any event is battle-related -> start battle queue

removals / simplifications
- NotificationAnimationController queue removed
- AnimationCaches removed
- AnimationOrchestrator/handlers removed
