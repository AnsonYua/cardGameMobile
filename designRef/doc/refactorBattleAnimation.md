i want you help me refactor the updateSlot especially the logic for handling battle animation.

goals
- replace the current animation flow (lockedSlots + mixed render) with a new flow
- during battle animation: render all slots from last gameEnv snapshot
- after the animation finishes: render the current gameEnv snapshot

new architecture
- new class: BattleAnimationQueue (or BattleAnimationGate)
  - responsibility: detect battle-related notifications, manage a FIFO queue, track running state
  - interface:
    - needsBattleAnimation(notificationQueue): boolean
    - enqueue(notificationQueue, lastGameEnvRaw, currentGameEnvRaw, ctx): void
    - isRunning(): boolean
    - onComplete(cb): void (optional)
- no lockedSlots or per-slot merge logic
- lastGameEnvRaw stored in BoardScene and used for render while battle animation is running

data requirements
- lastGameEnvRaw: previous snapshot.raw (not current) so visuals match the pre-battle state
- currentGameEnvRaw: current snapshot.raw for final render after animation completes
- notificationQueue: used to detect if battle animation is required
- affected cards: scan each notification.payload for cardUid references (attacker/target/etc)

new updateSlots flow (pseudo)
```
updateSlots(opts = {}) {
  const snapshot = engine.getSnapshot()
  const raw = snapshot.raw
  if (!raw) return
  const notificationQueue = getNotificationQueue(raw)
  const needsBattle = battleQueue.needsBattleAnimation(notificationQueue)

  if (battleQueue.isRunning() || needsBattle) {
    const lastRaw = this.lastGameEnvRaw ?? raw
    const lastSlots = slotPresenter.toSlots(lastRaw, playerId)
    renderSlots(lastSlots)

    if (needsBattle && !battleQueue.isRunning()) {
      battleQueue.enqueue({
        notificationQueue,
        lastRaw,
        currentRaw: raw,
        runAnimations: () => animationOrchestrator.run(...)
      })
      battleQueue.startIfIdle()
    }
    return
  }

  const currentSlots = slotPresenter.toSlots(raw, playerId)
  renderSlots(currentSlots)
  this.lastGameEnvRaw = raw
}
```

needsBattleAnimation (pseudo)
```
needsBattleAnimation(notificationQueue) {
  if (!notificationQueue?.length) return false
  for each note in notificationQueue:
    const payload = note.payload || {}
    if payload.attacker?.carduid or payload.target?.carduid: return true
    if payload.attackingCardUid or payload.defendingCardUid: return true
    if payload.attackingPlayerId or payload.defendingPlayerId: return true
  return false
}
```

queue behavior (pseudo)
```
enqueue({ notificationQueue, lastRaw, currentRaw, runAnimations }) {
  // store entries FIFO; each entry corresponds to one battle resolution
  // battle animations must run sequentially
}

startIfIdle() {
  if (running) return
  running = true
  while (queue not empty) {
    const entry = queue.shift()
    await runAnimations(entry)
  }
  running = false
  // after completion: render current snapshot and update lastGameEnvRaw
}
```

important changes
- remove lockedSlots usage in renderSlots
- battle animations drive the visual state (last snapshot during animation, current snapshot after)
- notification scanning determines whether to start the battle queue

refactor goals (new)
- centralize notification handling: UNIT_ATTACK_DECLARED, CARD_PLAYED, BATTLE_RESOLVED, CARD_STAT_MODIFIED
- remove per-handler queues; NotificationAnimationController should not own a queue
- keep AnimationOrchestrator thin (only dispatch/ordering, no queue logic)
- remove AnimationCaches if possible (ProcessedIdCache usage eliminated by new centralized queue)

new proposed structure (centerized + modular)
- new class: AnimationEventRouter
  - responsibility: interpret notificationQueue and map to domain events
  - outputs a normalized list of AnimationEvents (type + payload + affected cardUids)
  - owns dedupe rules (if needed) instead of per-handler caches

- new class: AnimationQueue (single queue for all animations)
  - FIFO queue, runs events sequentially
  - no per-handler queues
  - owns running state and lifecycle hooks (onStart/onComplete)

- new class: AnimationExecutor
  - takes one AnimationEvent and runs the corresponding animation
  - uses small, focused helpers:
    - CardPlayAnimator (play to slot/base/command)
    - BattleAnimator (battle resolution / attack sequence)
    - StatPulseAnimator (stat change effects)
    - AttackIndicatorUpdater (attack arrow updates)

- AnimationOrchestrator becomes a thin wrapper:
  - build events via AnimationEventRouter
  - enqueue into AnimationQueue
  - no internal queue or per-handler chain logic

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

event routing rules (examples)
```
if note.type == "CARD_PLAYED": event => CardPlayAnimator
if note.type == "UNIT_ATTACK_DECLARED": event => AttackIndicatorUpdater
if note.type == "BATTLE_RESOLVED": event => BattleAnimator
if note.type == "CARD_STAT_MODIFIED": event => StatPulseAnimator
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
- remove NotificationAnimationController internal queue and ProcessedIdCache usage
- remove AnimationCaches if no other code depends on it
- collapse handler classes if they only forward to another class
- reduce AnimationOrchestrator to "route + enqueue" logic only
