function normalize(value: unknown): string {
  return (value ?? "").toString().trim();
}

function findAttackDeclaration(raw: any, notificationId: string) {
  const notifications = raw?.gameEnv?.notificationQueue ?? raw?.notificationQueue;
  if (!Array.isArray(notifications) || !notificationId) return undefined;
  return notifications.find((note: any) => {
    const id = normalize(note?.id);
    const type = normalize(note?.type).toUpperCase();
    return id === notificationId && type === "UNIT_ATTACK_DECLARED";
  });
}

function findUnitByUid(raw: any, carduid: string): { unit: any; slotId?: string } | undefined {
  const players = raw?.gameEnv?.players ?? raw?.players;
  if (!players || typeof players !== "object") return undefined;

  for (const player of Object.values(players as Record<string, any>)) {
    const zones = (player as any)?.zones;
    if (!zones || typeof zones !== "object") continue;
    for (const [slotId, slot] of Object.entries(zones as Record<string, any>)) {
      const unit = (slot as any)?.unit;
      if (normalize(unit?.carduid) === carduid || normalize(unit?.cardUid) === carduid) {
        return { unit, slotId };
      }
    }
  }

  return undefined;
}

function isUnitDamaged(raw: any, carduid: string): boolean {
  const found = findUnitByUid(raw, carduid);
  if (!found?.unit) return false;

  const unitDamage = Number(found.unit?.damageReceived ?? 0);
  if (Number.isFinite(unitDamage) && unitDamage > 0) return true;

  const players = raw?.gameEnv?.players ?? raw?.players;
  if (!players || typeof players !== "object") return false;

  for (const player of Object.values(players as Record<string, any>)) {
    const slot = (player as any)?.zones?.[found.slotId || ""];
    const slotDamage = Number(slot?.fieldCardValue?.totalDamageReceived ?? 0);
    if (Number.isFinite(slotDamage) && slotDamage > 0) return true;
  }

  return false;
}

function buildExcludedAttackTargetHint(raw: any, payload: any, data: any, availableTargets: any[]): string | undefined {
  const notificationId = normalize(data?.cardPlayNotificationId || payload?.cardPlayNotificationId);
  if (!notificationId) return undefined;

  const attackDecl = findAttackDeclaration(raw, notificationId);
  const attackPayload = attackDecl?.payload ?? {};
  const targetCarduid = normalize(attackPayload?.targetCarduid);
  if (!targetCarduid) return undefined;

  const availableSet = new Set(
    (Array.isArray(availableTargets) ? availableTargets : [])
      .map((target) => normalize(target?.carduid || target?.cardUid))
      .filter(Boolean),
  );

  if (availableSet.has(targetCarduid)) return undefined;
  if (isUnitDamaged(raw, targetCarduid)) return undefined;

  const targetName =
    normalize(attackPayload?.targetName) ||
    normalize(findUnitByUid(raw, targetCarduid)?.unit?.cardData?.name) ||
    targetCarduid;
  const targetSlot = normalize(attackPayload?.targetSlotName || findUnitByUid(raw, targetCarduid)?.slotId);
  const slotSuffix = targetSlot ? ` (${targetSlot})` : "";
  return `${targetName}${slotSuffix} is not damaged, so it is not selectable.`;
}

export function buildTargetChoiceHint(opts: {
  raw: any;
  payload: any;
  data: any;
  availableTargets: any[];
}): string | undefined {
  const effect = opts?.data?.effect ?? {};
  const filters = effect?.target?.filters ?? {};
  const messages: string[] = [];

  if (filters?.damaged === true) {
    messages.push("Only damaged enemy units are selectable.");
    const excludedTarget = buildExcludedAttackTargetHint(opts.raw, opts.payload, opts.data, opts.availableTargets);
    if (excludedTarget) {
      messages.push(excludedTarget);
    }
  }

  if (messages.length === 0) return undefined;
  return messages.join(" ");
}
