type LogArgs = unknown[];

export function createLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    debug: (...args: LogArgs) => {
      void args;
    },
    info: (...args: LogArgs) => {
      void args;
    },
    warn: (...args: LogArgs) => {
      void args;
    },
    error: (...args: LogArgs) => {
      // eslint-disable-next-line no-console
      console.error(prefix, ...args);
    },
  };
}
