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
