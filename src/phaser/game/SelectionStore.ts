export type SelectionKind = "hand" | "slot" | "base";

export type SelectionTarget =
  | { kind: "hand"; uid: string; cardType?: string }
  | { kind: "slot"; slotId: string; owner: string }
  | { kind: "base"; side: "player" | "opponent"; cardId?: string };

export class SelectionStore {
  private current?: SelectionTarget;

  select(target: SelectionTarget) {
    this.current = target;
  }

  clear() {
    this.current = undefined;
  }

  get(): SelectionTarget | undefined {
    return this.current;
  }
}
