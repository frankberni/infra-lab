import { pino, type Logger } from 'pino';

import type { LOG_LEVELS } from './config.ts';

export type { Logger };

export function createLogger(name: string, level: (typeof LOG_LEVELS)[number]): Logger {
  return pino({ name, level, timestamp: pino.stdTimeFunctions.isoTime });
}
