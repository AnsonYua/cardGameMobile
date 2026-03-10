export type DismissFirstSubmitOpts = {
  isSubmitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  beforeDismiss?: () => void;
  dismiss: () => Promise<void> | void;
  submit?: () => Promise<void> | void;
};

/**
 * Shared dialog submit lifecycle:
 * lock, optionally prepare local state, dismiss the dialog, then run the submit callback.
 */
export async function runDismissFirstSubmit(opts: DismissFirstSubmitOpts): Promise<boolean> {
  if (opts.isSubmitting) return false;
  opts.setSubmitting(true);
  try {
    opts.beforeDismiss?.();
    await Promise.resolve(opts.dismiss());
    await Promise.resolve(opts.submit?.());
    return true;
  } finally {
    opts.setSubmitting(false);
  }
}
