# Animation Flow (Frontend)

This document explains how animation is triggered, queued, and rendered in the frontend. It covers card play animations, battle animations, attack indicators, and slot visibility/locking.

## Key Files and Responsibilities

- `src/phaser/BoardScene.ts`
  - Central orchestration for UI updates on each engine snapshot.
  - Calls `updateSlots()` to parse `notificationQueue`, trigger animations, and update slot UI.
  - Holds instances of `AnimationOrchestrator`, `NotificationAnimationController`,
    `BattleAnimationManager`, `AttackIndicatorController`.

- `src/phaser/animations/AnimationOrchestrator.ts`
  - Centralized animation pipeline entry point.
  - Runs handler prepare hooks before any animations, then executes handlers in FIFO order.
  - Maintains a run-level FIFO queue so consecutive `run()` calls never overlap.
  - Aggregates locked slots from handlers for `BoardScene.applyLockedSlotOverrides()`.

- `src/phaser/animations/AttackContextHandler.ts`
  - Computes attack context from `notificationQueue` (active/pending attack, target slot key, battle slot keys).
  - Populates `attackSnapshotNote` for battle snapshots.
  - Updates attack indicator through the orchestrator callback.

- `src/phaser/animations/NotificationAnimationController.ts`
  - Handles non-battle animations (currently `CARD_PLAYED`).
  - Runs animations serially via an internal promise queue.
  - Locks/hides slots while a play animation is in progress.

- `src/phaser/animations/StatChangeAnimationHandler.ts`
  - Handles `CARD_STAT_MODIFIED` notifications.
  - Plays AP/HP pulse animation sequentially in the animation queue.

- `src/phaser/animations/BattleAnimationManager.ts`
  - Handles battle snapshots (from `UNIT_ATTACK_DECLARED`) and resolution animations (from `BATTLE_RESOLVED`).
  - Maintains snapshot cache and processed id cache.
  - Locks slots used in battle so the normal slot render does not fight with animations.
  - Tracks pending locks (timestamped) to keep slots stable until resolution starts; resolved attacks are ignored to prevent re-locks during polling.

- `src/phaser/animations/PlayCardAnimationManager.ts`
  - Low-level card flight animation utility used by `NotificationAnimationController`.

- `src/phaser/controllers/AttackIndicatorController.ts`
  - Draws the attack arrow for the latest active attack.

- `src/phaser/utils/AttackResolver.ts`
  - Normalizes attack payloads and resolves target positions (slot, base, or shield anchors).
- `src/phaser/utils/NotificationUtils.ts`
  - Central helpers for reading `notificationQueue`, selecting active/pending attack notes,
    and computing slot keys for hiding/locking.

- `src/phaser/ui/SlotDisplayHandler.ts`
  - Renders slots; can hide individual slots when told to by animation controllers.

- `src/phaser/animations/AnimationCaches.ts`
  - Shared caches for snapshot TTL and processed ids.


## Data Sources and Trigger Points

Animations are driven by the backend `notificationQueue` on each snapshot update.

Flow overview:

1) `GameEngine` fetches status and emits `MAIN_PHASE_UPDATE` or `MAIN_PHASE_UPDATE_SILENT`.
2) `BoardScene.mainPhaseUpdate()` -> `BoardScene.updateSlots()`.
3) `updateSlots()` parses `notificationQueue` and triggers:
   - `AnimationOrchestrator.run()` to execute animation handlers (queued, non-overlapping)
   - `AttackIndicatorController.updateFromNotifications()`
4) `slotControls.setSlots()` receives merged slots with any animation locks applied.


## Notification Processing Order

Inside `BoardScene.updateSlots()`:

- `AnimationOrchestrator.run()` performs:
  1) Prepare phase for all handlers (attack context + battle snapshots captured here).
  2) Notification handler, then stat-change handler, then battle handler.
- This preserves the ordering: play animations before battle resolution when both exist.
- The orchestrator chains runs so a new `run()` call waits for the previous one to finish.

File reference: `src/phaser/BoardScene.ts`.


## Animation Types

### 1) CARD_PLAYED

Trigger:
- `notificationQueue` contains `CARD_PLAYED` with `payload.isCompleted === true`.

Handler:
- `NotificationAnimationController.process()` via `NotificationAnimationHandler`

Behavior:
- Cards animate from hand to a slot or base area.
- The destination slot is hidden during the animation (to avoid double cards).
- A snapshot of that slot is locked so subsequent `setSlots()` calls don't clear it mid-animation.

Files:
- `src/phaser/animations/NotificationAnimationController.ts`
- `src/phaser/animations/PlayCardAnimationManager.ts`


### 2) UNIT_ATTACK_DECLARED

Trigger:
- `notificationQueue` contains `UNIT_ATTACK_DECLARED`.

Handler:
- `BattleAnimationManager.captureAttackSnapshot(snapshotNote)` via `BattleAnimationHandler.prepare()`

Cache/lock details:
- Snapshot cache key: `snapshotNote.id` (UNIT_ATTACK_DECLARED id).
- Stored snapshot: attacker seed, target seed, target point, attackId (same as note id).
- Pending locks: attacker/target slot snapshots stored with timestamp until battle resolution runs.
- Resolved attack cache: prevents capturing/locking again for an attack already resolved (polling safety).

Behavior:
- Saves an attacker + target snapshot for later use by the battle resolution animation.
- Uses slot positions if cards are still present.
- If cards already vanished (rapid battle end), it builds a payload-based sprite using card uid/name.
- Locks attacker/target slots so the board rendering does not remove the visuals mid-animation.

Files:
- `src/phaser/animations/BattleAnimationManager.ts`
- `src/phaser/utils/AttackResolver.ts`


### 3) BATTLE_RESOLVED

Trigger:
- `notificationQueue` contains `BATTLE_RESOLVED`.

Handler:
- `BattleAnimationManager.processBattleResolutionNotifications()` via `BattleAnimationHandler.handle()`

Behavior:
- Looks up the snapshot captured from `UNIT_ATTACK_DECLARED`.
- Animates attacker sprite to the target point, plays impact effects, then returns or fades out.
- Releases slot locks when done.
- If snapshot is missing, it unlocks slots using payload `attacker.slot` / `target.slot` to prevent lock leaks.

Queue/cache/lock details:
- Resolution queue: `battleAnimationQueue` chains promises so battle animations run FIFO.
- Processed resolution cache: `processedResolutions` prevents duplicate resolution handling.
- Resolved attack cache: marks an attack as resolved after animation to ignore later duplicate snapshots.
- Locks:
  - Pending locks are promoted to active when battle animation starts.
  - `getLockedSlots()` returns pending + active locks with timestamps.
  - Expiration: pending/active locks are evicted after a short TTL to avoid stale cards persisting if a resolution never arrives.

Files:
- `src/phaser/animations/BattleAnimationManager.ts`


### 4) CARD_STAT_MODIFIED

Trigger:
- `notificationQueue` contains `CARD_STAT_MODIFIED`.

Handler:
- `StatChangeAnimationHandler.handle()`

Behavior:
- Resolves the slot key from payload `playerId` + `zone` (or card uid fallback).
- Plays a pulse animation on the slot AP/HP badge using the handler queue.
- Slot AP/HP badge no longer auto-pulses on value change without this notification.

Example notification:
```
{
  "id": "card_stat_modified_1766926053793_8hq4ayrsc",
  "type": "CARD_STAT_MODIFIED",
  "metadata": {
    "timestamp": 1766926053793,
    "expiresAt": 1766926056793,
    "requiresAcknowledgment": false,
    "frontendProcessed": false,
    "priority": "normal"
  },
  "payload": {
    "playerId": "playerId_1",
    "carduid": "ST01-009_d0276af7-b917-45ba-8e16-692d241a7360",
    "cardId": "ST01-009",
    "cardName": "Zowort",
    "zone": "slot3",
    "stat": "modifyAP",
    "delta": -3,
    "modifierValue": -3,
    "timestamp": 1766926053793
  }
}
```

Files:
- `src/phaser/animations/StatChangeAnimationHandler.ts`
- `src/phaser/ui/SlotDisplayHandler.ts`


## Slot Locking and Merge Rules

Both animation systems can lock slots:

- `NotificationAnimationController` locks a slot while a card is flying in.
- `BattleAnimationManager` locks attacker/target slots while a battle animation is running.

`BoardScene.applyLockedSlotOverrides()` merges locked snapshots collected from `AnimationOrchestrator.getLockedSlots()`
so the UI does not flicker.

File reference:
- `src/phaser/BoardScene.ts`


## Attack Indicator

The attack arrow is separate from battle animation. It is updated every refresh using the latest attack note.

File reference:
- `src/phaser/controllers/AttackIndicatorController.ts`


## Example Scenarios

### Scenario A: Play a unit from hand

Notification queue:
- `CARD_PLAYED` (playAs: "unit")

Flow:
1) `NotificationAnimationController.process()` creates a flight animation from hand to slot.
2) Target slot is hidden during the flight.
3) Slot lock prevents slot render from removing the card mid-animation.

Relevant files:
- `src/phaser/animations/NotificationAnimationController.ts`
- `src/phaser/animations/PlayCardAnimationManager.ts`

Sequence (simplified):
```
Backend -> GameEngine: status (notificationQueue)
GameEngine -> BoardScene: MAIN_PHASE_UPDATE
BoardScene -> NotificationAnimationController: process(CARD_PLAYED)
NotificationAnimationController -> PlayCardAnimationManager: play()
NotificationAnimationController -> SlotDisplayHandler: hide slot
PlayCardAnimationManager -> NotificationAnimationController: done
NotificationAnimationController -> SlotDisplayHandler: show slot + unlock
```

Key snippet (slot play path):
```ts
if (type === "CARD_PLAYED") {
  const task = this.buildCardPlayedTask(note.payload ?? {}, args);
  if (!task) return;
  this.processedIds.add(note.id);
  this.enqueueAnimation(note.id, task);
}
```


### Scenario B: Attack declared then resolved immediately (battleEnd true)

Notification queue (same update):
- `UNIT_ATTACK_DECLARED` (battleEnd: true)
- `BATTLE_RESOLVED`

Flow:
1) `captureAttackSnapshot(pendingAttackSnapshotNote)` runs first and creates a snapshot.
2) If slots already removed, payload-based fallback builds the attacker/target sprite.
3) `processBattleResolutionNotifications()` plays the battle animation after play animations finish.

Relevant files:
- `src/phaser/animations/BattleAnimationManager.ts`
- `src/phaser/utils/AttackResolver.ts`

Sequence (simplified):
```
BoardScene -> BattleAnimationManager: captureAttackSnapshot(UNIT_ATTACK_DECLARED)
BoardScene -> BattleAnimationManager: processBattleResolutionNotifications(BATTLE_RESOLVED)
BattleAnimationManager -> FxToolkit: runTween + impact effects
BattleAnimationManager -> SlotDisplayHandler: hide attacker/target slots
BattleAnimationManager -> SlotDisplayHandler: unlock slots
```

Key snippet (snapshot + resolution):
```ts
this.snapshotCache.set(note.id, {
  attacker: attackerSeed,
  target: targetSeed,
  targetPoint,
});
...
this.battleAnimationQueue = this.battleAnimationQueue
  .then(() => this.playBattleResolutionAnimation(snapshot, payload))
  .finally(() => {
    this.releaseLockedSlotsForSnapshot(snapshot);
    this.snapshotCache.delete(attackId);
  });
```


### Scenario C: Opponent chooses blocker

Notification queue:
- `UNIT_ATTACK_DECLARED` with `forcedTarget*` fields

Flow:
1) `resolveAttackTargetPoint()` detects forced target (blocker) and resolves the correct slot.
2) Attack indicator points to blocker target.
3) Battle snapshot uses the forced target for the animation.

Relevant files:
- `src/phaser/utils/AttackResolver.ts`
- `src/phaser/controllers/AttackIndicatorController.ts`

Sequence (simplified):
```
BoardScene -> AttackIndicatorController: updateFromNotifications()
AttackIndicatorController -> AttackResolver: resolveAttackTargetPoint(forcedTarget*)
AttackIndicatorController -> UI: draw arrow to blocker slot
```

Key snippet (forced target resolution):
```ts
const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid;
const slotVm = findSlotForAttack(slots, targetCarduid, targetOwner, targetSlotId);
return getSlotCenterFromMap(positions, slotVm, targetOwner, targetSlotId);
```


### Scenario D: Card play + battle resolved in same queue

Notification queue order:
- `CARD_PLAYED`
- `BATTLE_RESOLVED`

Flow:
1) `NotificationAnimationController.process()` runs first (queued).
2) After it resolves, `BattleAnimationManager.processBattleResolutionNotifications()` runs.
3) Prevents overlapping animations.

Relevant files:
- `src/phaser/BoardScene.ts`

Sequence (simplified):
```
BoardScene.updateSlots()
  -> NotificationAnimationController.process()
  -> (after promise resolves) BattleAnimationManager.processBattleResolutionNotifications()
```

Key snippet (ordering):
```ts
const notificationPromise = this.notificationAnimator?.process(...);
const processBattles = () => {
  this.battleAnimations?.processBattleResolutionNotifications(notificationQueue);
};
if (notificationPromise) {
  notificationPromise.then(processBattles);
} else {
  processBattles();
}
```


### Scenario E: Base or shield target

Notification queue:
- `UNIT_ATTACK_DECLARED` with target `base` or `shieldArea`

Flow:
1) `resolveAttackTargetPoint()` uses base/shield anchors, not slot positions.
2) Battle animation moves attacker to the anchor point.

Relevant files:
- `src/phaser/utils/AttackResolver.ts`
- `src/phaser/animations/BattleAnimationManager.ts`

Sequence (simplified):
```
BattleAnimationManager.captureAttackSnapshot()
  -> resolveAttackTargetPoint() -> base/shield anchor
  -> animate attacker to anchor
```

Key snippet (base/shield anchors):
```ts
if (!hasForcedTarget && isBaseTarget(normalizedSlot, normalizedName)) {
  const anchor = context.anchors.getBaseAnchor?.(isOpponentTarget);
  if (anchor) return { x: anchor.x, y: anchor.y };
}
```


## Quick Trace Checklist

If animation does not run:

1) Is the notification present in `notificationQueue`?
2) Does `captureAttackSnapshot()` log a snapshot (attackerSeed exists)?
3) Does `processBattleResolutionNotifications()` log missing snapshot?
4) Are slot locks released after animation?

Main log tags:
- `[NotificationAnimator] ...`
- `[BattleAnimation] captureAttackSnapshot ...`
- `[BattleAnimation] completed resolution ...`
- `[BattleAnimation] unlockSlot ...`



   
    const raw = this.engine.getSnapshot().raw as any;
    const slots = this.slotPresenter.toSlots(raw, this.gameContext.playerId);
    this.slotControls?.setSlots(slots);