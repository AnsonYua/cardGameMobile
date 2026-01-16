type LogArgs = unknown[];

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugLogs") === "1") return true;
  } catch {
    // Ignore invalid URL states.
  }
  try {
    return window.localStorage.getItem("debugLogs") === "1";
  } catch {
    return false;
  }
}

export function createLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    debug: (...args: LogArgs) => {
      if (!isDebugEnabled()) return;
      // eslint-disable-next-line no-console
      console.log(prefix, ...args);
    },
    info: (...args: LogArgs) => {
      if (!isDebugEnabled()) return;
      // eslint-disable-next-line no-console
      console.log(prefix, ...args);
    },
    warn: (...args: LogArgs) => {
      // eslint-disable-next-line no-console
      console.warn(prefix, ...args);
    },
    error: (...args: LogArgs) => {
      // eslint-disable-next-line no-console
      console.error(prefix, ...args);
    },
  };
}
