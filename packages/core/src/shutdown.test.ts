import { describe, expect, it } from 'vitest';

import { createLogger } from './logger.ts';
import { runShutdown } from './shutdown.ts';

const logger = createLogger('test', 'silent');

describe('runShutdown', () => {
  it('closes steps in order and keeps going after a failure', async () => {
    const closed: string[] = [];
    const step = (name: string, fail = false) => ({
      name,
      close: () => {
        closed.push(name);
        return fail ? Promise.reject(new Error(`${name} failed`)) : Promise.resolve();
      },
    });

    const clean = await runShutdown([step('server'), step('queue', true), step('pool')], logger);

    expect(closed).toEqual(['server', 'queue', 'pool']);
    expect(clean).toBe(false);
  });

  it('gives up after the timeout', async () => {
    const hanging = { name: 'hanging', close: () => new Promise<never>(() => undefined) };

    await expect(runShutdown([hanging], logger, 20)).resolves.toBe(false);
  });
});
