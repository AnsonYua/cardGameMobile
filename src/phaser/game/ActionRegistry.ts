import { SelectionTarget } from "./SelectionStore";

export type ActionContext = {
  selection?: SelectionTarget;
  gameId?: string | null;
  playerId?: string | null;
  runPlayCard?: (payload: { playerId: string; gameId: string; action: any }) => Promise<any>;
  runEndTurn?: (payload: { playerId: string; gameId: string }) => Promise<any>;
  refreshStatus?: () => Promise<any>;
  pilotTargetUid?: string;
  clearSelection?: () => void;
  setPilotTarget?: (uid?: string) => void;
};

export type ActionDescriptor = {
  id: string;
  label: string;
  enabled: boolean;
  primary?: boolean;
  reason?: string;
};

export type ActionHandler = (ctx: ActionContext) => Promise<void | boolean>;

export class ActionRegistry {
  private registry = new Map<string, ActionHandler>();

  register(id: string, handler: ActionHandler) {
    this.registry.set(id, handler);
  }

  get(id: string) {
    return this.registry.get(id);
  }
}
