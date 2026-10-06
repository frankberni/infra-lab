import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const envFields = {
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
};

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/** Validates env against the schema. Issue messages never include the offending values. */
export function parseEnv<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(env);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new ConfigError(`Invalid environment configuration:\n${details}`);
}

/** Fail-fast variant for process entry points: prints the problems and exits. */
export function loadConfig<T extends z.ZodType>(schema: T): z.infer<T> {
  try {
    return parseEnv(schema, process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
