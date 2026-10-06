import type { Logger } from './logger.ts';
import { withTimeout } from './timeout.ts';

export interface ShutdownStep {
  name: string;
  close: () => Promise<unknown>;
}

/** Below the 10 s grace period of `docker stop` before SIGKILL. */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8_000;

async function closeInOrder(steps: readonly ShutdownStep[], logger: Logger): Promise<boolean> {
  let clean = true;
  for (const step of steps) {
    try {
      await step.close();
    } catch (error) {
      clean = false;
      logger.error({ err: error, step: step.name }, 'shutdown step failed');
    }
  }
  return clean;
}

/**
 * Runs the close steps sequentially; a failing step is logged and does not stop the next ones.
 * Resolves true only if every step succeeded within the timeout.
 */
export async function runShutdown(
  steps: readonly ShutdownStep[],
  logger: Logger,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
): Promise<boolean> {
  try {
    return await withTimeout(closeInOrder(steps, logger), timeoutMs, 'shutdown');
  } catch (error) {
    logger.error({ err: error }, 'shutdown did not complete');
    return false;
  }
}

/** On the first SIGTERM/SIGINT runs the steps, then exits (0 if clean, 1 otherwise). */
export function registerShutdown(
  steps: readonly ShutdownStep[],
  logger: Logger,
  timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
): void {
  let shuttingDown = false;

  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    void runShutdown(steps, logger, timeoutMs).then((clean) => {
      logger.info({ clean }, 'stopped');
      process.exit(clean ? 0 : 1);
    });
  };

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}
