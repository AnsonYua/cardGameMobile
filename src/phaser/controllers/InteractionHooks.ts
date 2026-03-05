export type InteractionErrorOptions = {
  headerText?: string;
};

export type InteractionHooks = {
  onLoadingStart?: () => void;
  onLoadingEnd?: () => void;
  onReportError?: (err: unknown, opts?: InteractionErrorOptions) => void;
};

type LoadingHooks = Pick<InteractionHooks, "onLoadingStart" | "onLoadingEnd"> | undefined;

export async function withInteractionLoading<T>(
  hooks: LoadingHooks,
  run: () => Promise<T>,
): Promise<T> {
  hooks?.onLoadingStart?.();
  try {
    return await run();
  } finally {
    hooks?.onLoadingEnd?.();
  }
}
