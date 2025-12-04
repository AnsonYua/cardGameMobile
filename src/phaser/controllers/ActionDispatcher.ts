type ActionHandler = () => void;

export class ActionDispatcher {
  private handlers: Map<number, ActionHandler> = new Map();

  register(index: number, handler: ActionHandler) {
    this.handlers.set(index, handler);
  }

  dispatch(index: number) {
    const handler = this.handlers.get(index);
    if (handler) handler();
  }
}
