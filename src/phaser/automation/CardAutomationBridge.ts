import { resolvePlayerIds } from "../scene/boardStatusHelpers";
import type { ActionSource } from "../game/GameEngine";
import type { CardAutomation, CardUiSnapshot, ClickTarget, WaitOpts } from "./AutomationTypes";
import type { BridgeDeps } from "./bridgeDeps";
import { buildCardSnapshot, getBaseCard } from "./bridgeSnapshot";
import { buildInteractables } from "./bridgeInteractables";

const DEFAULT_WAIT_OPTS: Required<WaitOpts> = {
  timeoutMs: 10000,
  intervalMs: 100,
};

export class CardAutomationBridge {
  constructor(private deps: BridgeDeps) {}

  buildPublicApi(): CardAutomation {
    return {
      version: "1.0",
      enabled: true,
      snapshot: () => this.snapshot(),
      list: () => this.list(),
      click: (target) => this.click(target),
      waitFor: (predicate, opts) => this.waitFor(predicate, opts),
      waitForIdle: (opts) => this.waitForIdle(opts),
      action: {
        list: () => this.snapshot().ui.actionBar.buttons,
        clickPrimary: (source) => this.clickPrimaryAction(source),
        clickByLabel: (label) => this.clickActionByLabel(label),
        clickByIndex: (index) => this.clickActionByIndex(index),
        run: (id, source) => this.runAction(id, source),
      },
      hand: {
        list: () => this.snapshot().ui.hand.cards,
        select: (uid) => this.selectHand(uid),
        click: (uid) => this.clickHand(uid),
        getSelectedUid: () => this.snapshot().ui.hand.selectedUid,
      },
      slot: {
        list: () => this.snapshot().ui.slots.slots,
        click: (owner, slotId) => this.clickSlot(owner, slotId),
        getSelected: () => this.snapshot().ui.slots.selected,
      },
      base: {
        click: (side) => this.clickBase(side),
        get: (side) => this.snapshot().ui.base[side],
      },
      dialogs: {
        list: () => this.snapshot().ui.dialogs,
        promptChoose: (labelOrIndex) => Promise.resolve(this.deps.dialogs.promptChoiceDialog?.choose?.(labelOrIndex) ?? false),
        optionChoose: (index) => Promise.resolve(this.deps.dialogs.optionChoiceDialog?.choose?.(index) ?? false),
        tokenChoose: (index) => Promise.resolve(this.deps.dialogs.tokenChoiceDialog?.choose?.(index) ?? false),
        burstChoose: (decision) => Promise.resolve(this.deps.dialogs.burstChoiceDialog?.choose?.(decision) ?? false),
        pilotTargetChoose: (index) => this.choosePilotTarget(index),
        effectTargetChoose: (index) => this.chooseEffectTarget(index),
        mulliganChoose: (decision) => Promise.resolve(this.deps.dialogs.mulliganDialog?.choose?.(decision) ?? false),
        chooseFirstPlayer: (decision) => Promise.resolve(this.deps.dialogs.chooseFirstPlayerDialog?.choose?.(decision) ?? false),
      },
      engine: {
        pollOnce: async () => {
          await this.deps.debugControls?.pollOnce();
        },
        startAutoPolling: async () => {
          await this.deps.debugControls?.startAutoPolling();
        },
        stopAutoPolling: async () => {
          await this.deps.debugControls?.stopAutoPolling();
        },
        setScenario: async (path: string) => {
          await this.deps.debugControls?.setScenario(path);
        },
      },
    };
  }

  snapshot(): CardUiSnapshot {
    return buildCardSnapshot(this.deps);
  }

  list() {
    return buildInteractables(this.snapshot());
  }

  async click(target: ClickTarget): Promise<boolean> {
    if (typeof target !== "string") return this.clickByObject(target);

    if (target === "action:primary") return this.clickPrimaryAction("neutral");

    const actionIndexMatch = target.match(/^action:index:(\d+)$/);
    if (actionIndexMatch) return this.clickActionByIndex(Number(actionIndexMatch[1]));

    const handMatch = target.match(/^hand:uid:(.+)$/);
    if (handMatch) return this.clickHand(handMatch[1]);

    const slotMatch = target.match(/^slot:(player|opponent):([^:]+)$/);
    if (slotMatch) return this.clickSlot(slotMatch[1] as "player" | "opponent", slotMatch[2]);

    const baseMatch = target.match(/^base:(player|opponent)$/);
    if (baseMatch) return this.clickBase(baseMatch[1] as "player" | "opponent");

    const promptMatch = target.match(/^dialog:prompt:(\d+)$/);
    if (promptMatch) return Promise.resolve(this.deps.dialogs.promptChoiceDialog?.choose?.(Number(promptMatch[1])) ?? false);

    const optionMatch = target.match(/^dialog:option:(\d+)$/);
    if (optionMatch) return Promise.resolve(this.deps.dialogs.optionChoiceDialog?.choose?.(Number(optionMatch[1])) ?? false);

    const tokenMatch = target.match(/^dialog:token:(\d+)$/);
    if (tokenMatch) return Promise.resolve(this.deps.dialogs.tokenChoiceDialog?.choose?.(Number(tokenMatch[1])) ?? false);

    const burstMatch = target.match(/^dialog:burst:(trigger|cancel)$/);
    if (burstMatch) return Promise.resolve(this.deps.dialogs.burstChoiceDialog?.choose?.(burstMatch[1] as "trigger" | "cancel") ?? false);

    const mulliganMatch = target.match(/^dialog:mulligan:(yes|no)$/);
    if (mulliganMatch) return Promise.resolve(this.deps.dialogs.mulliganDialog?.choose?.(mulliganMatch[1] as "yes" | "no") ?? false);

    const firstMatch = target.match(/^dialog:first:(first|second)$/);
    if (firstMatch) return Promise.resolve(this.deps.dialogs.chooseFirstPlayerDialog?.choose?.(firstMatch[1] as "first" | "second") ?? false);

    const pilotMatch = target.match(/^dialog:pilot:(\d+)$/);
    if (pilotMatch) return this.choosePilotTarget(Number(pilotMatch[1]));

    const effectMatch = target.match(/^dialog:effect:(\d+)$/);
    if (effectMatch) return this.chooseEffectTarget(Number(effectMatch[1]));

    return false;
  }

  async waitFor(predicate: (snapshot: CardUiSnapshot) => boolean, opts?: WaitOpts): Promise<CardUiSnapshot> {
    const config = { ...DEFAULT_WAIT_OPTS, ...opts };
    const start = Date.now();
    while (Date.now() - start < config.timeoutMs) {
      const snapshot = this.snapshot();
      if (predicate(snapshot)) return snapshot;
      await this.delay(config.intervalMs);
    }
    throw new Error(`waitFor timeout after ${config.timeoutMs}ms`);
  }

  async waitForIdle(opts?: WaitOpts): Promise<CardUiSnapshot> {
    const config = { ...DEFAULT_WAIT_OPTS, ...opts };
    const start = Date.now();
    while (Date.now() - start < config.timeoutMs) {
      const running = this.deps.animationQueue?.isRunning?.() ?? false;
      if (!running) {
        await this.delay(100);
        if (!(this.deps.animationQueue?.isRunning?.() ?? false)) return this.snapshot();
      }
      await this.delay(config.intervalMs);
    }
    throw new Error(`waitForIdle timeout after ${config.timeoutMs}ms`);
  }

  private async clickByObject(target: Exclude<ClickTarget, string>): Promise<boolean> {
    switch (target.kind) {
      case "actionIndex":
        return this.clickActionByIndex(target.index);
      case "actionPrimary":
        return this.clickPrimaryAction(target.source);
      case "actionId":
        return this.runAction(target.id, target.source);
      case "hand":
        return this.clickHand(target.uid);
      case "slot":
        return this.clickSlot(target.owner, target.slotId);
      case "base":
        return this.clickBase(target.side);
      case "prompt":
        return Promise.resolve(this.deps.dialogs.promptChoiceDialog?.choose?.(target.labelOrIndex) ?? false);
      case "option":
        return Promise.resolve(this.deps.dialogs.optionChoiceDialog?.choose?.(target.index) ?? false);
      case "token":
        return Promise.resolve(this.deps.dialogs.tokenChoiceDialog?.choose?.(target.index) ?? false);
      case "burst":
        return Promise.resolve(this.deps.dialogs.burstChoiceDialog?.choose?.(target.decision) ?? false);
      case "pilotTarget":
        return this.choosePilotTarget(target.index);
      case "effectTarget":
        return this.chooseEffectTarget(target.index);
      case "mulligan":
        return Promise.resolve(this.deps.dialogs.mulliganDialog?.choose?.(target.decision) ?? false);
      case "chooseFirstPlayer":
        return Promise.resolve(this.deps.dialogs.chooseFirstPlayerDialog?.choose?.(target.decision) ?? false);
      default:
        return false;
    }
  }

  private async clickPrimaryAction(source: ActionSource = "neutral"): Promise<boolean> {
    const actionControls = this.deps.controls.actionControls;
    if (actionControls?.invokePrimary) return actionControls.invokePrimary();

    const actions = this.deps.engine.getAvailableActions(source);
    const primary = actions.find((item) => item.primary) ?? actions[0];
    if (!primary || primary.enabled === false) return false;
    return this.runAction(primary.id, source);
  }

  private async clickActionByLabel(label: string): Promise<boolean> {
    const state = this.deps.controls.actionControls?.getAutomationState?.();
    if (state) {
      const index = state.buttons.findIndex((button) => button.label.toLowerCase() === label.toLowerCase());
      if (index >= 0) return this.clickActionByIndex(index);
    }

    const actions = this.deps.engine.getAvailableActions("neutral");
    const found = actions.find((item) => item.label.toLowerCase() === label.toLowerCase());
    if (!found || found.enabled === false) return false;
    return this.runAction(found.id, "neutral");
  }

  private async clickActionByIndex(index: number): Promise<boolean> {
    const actionControls = this.deps.controls.actionControls;
    if (actionControls?.invokeByIndex) return actionControls.invokeByIndex(index);

    const actions = this.deps.engine.getAvailableActions("neutral");
    const found = actions[index];
    if (!found || found.enabled === false) return false;
    return this.runAction(found.id, "neutral");
  }

  private async runAction(id: string, source: ActionSource = "neutral"): Promise<boolean> {
    if (!this.deps.selectionAction) return false;
    try {
      await this.deps.selectionAction.runActionThenRefresh(id, source);
      return true;
    } catch {
      return false;
    }
  }

  private selectHand(uid: string): boolean {
    const raw = this.deps.engine.getSnapshot().raw;
    const playerId = this.deps.contextStore.get().playerId;
    const handCards = this.deps.handPresenter.toHandCards(raw, playerId);
    const card = handCards.find((item) => item.uid === uid);
    if (!card || !this.deps.selectionAction) return false;
    this.deps.selectionAction.handleHandCardSelected(card);
    return true;
  }

  private async clickHand(uid: string): Promise<boolean> {
    const handControls = this.deps.controls.handControls;
    if (handControls?.clickCard) {
      const clicked = handControls.clickCard(uid);
      if (!clicked) return false;
      this.deps.selectionAction?.refreshActions("hand");
      return true;
    }

    if (!this.selectHand(uid)) return false;
    this.deps.selectionAction?.refreshActions("hand");
    return true;
  }

  private async clickSlot(owner: "player" | "opponent", slotId: string): Promise<boolean> {
    const slotControls = this.deps.controls.slotControls;
    if (slotControls?.clickSlot) return slotControls.clickSlot(owner, slotId);

    if (!this.deps.selectionAction) return false;
    const raw = this.deps.engine.getSnapshot().raw;
    const slots = this.deps.slotPresenter.toSlots(raw, this.deps.contextStore.get().playerId);
    const target = slots.find((slot) => slot.owner === owner && slot.slotId === slotId);
    if (!target) return false;
    await this.deps.selectionAction.handleSlotCardSelected(target);
    return true;
  }

  private async clickBase(side: "player" | "opponent"): Promise<boolean> {
    if (!this.deps.selectionAction) return false;
    const raw = this.deps.engine.getSnapshot().raw as any;
    const players = raw?.gameEnv?.players ?? {};
    const { selfId, opponentId } = resolvePlayerIds(players, this.deps.contextStore.get().playerId);
    const targetPlayerId = side === "player" ? selfId : opponentId;
    const baseCard = targetPlayerId ? getBaseCard(raw, targetPlayerId) : undefined;
    if (!baseCard) return false;
    this.deps.selectionAction.handleBaseCardSelected({ side, card: baseCard });
    this.deps.selectionAction.refreshActions("base");
    return true;
  }

  private async choosePilotTarget(index: number): Promise<boolean> {
    return this.deps.dialogs.pilotTargetDialog?.selectTarget?.(index) ?? false;
  }

  private async chooseEffectTarget(index: number): Promise<boolean> {
    return this.deps.dialogs.effectTargetDialog?.selectTarget?.(index) ?? false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

declare global {
  interface Window {
    __card?: CardAutomation;
  }
}
