import type { AnimationContext } from "../AnimationTypes";
import type { SlotNotification } from "../NotificationAnimationController";
import type { SlotViewModel } from "../../ui/SlotTypes";

export function handleGameEnvRefresh(
  deps: {
    refreshSnapshot?: (event: SlotNotification, ctx: AnimationContext) => Promise<any> | any;
    getSlotsFromRaw?: (raw: any) => SlotViewModel[];
  },
  event: SlotNotification,
  ctx: AnimationContext,
) {
  const refresh = deps.refreshSnapshot;
  if (!refresh) return Promise.resolve();
  return Promise.resolve(refresh(event, ctx)).then((nextRaw) => {
    if (!nextRaw) return;
    ctx.previousRaw = ctx.currentRaw ?? ctx.previousRaw;
    ctx.currentRaw = nextRaw;
    if (deps.getSlotsFromRaw) {
      ctx.slots = deps.getSlotsFromRaw(nextRaw);
    }
  });
}

