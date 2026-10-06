import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { ConfigError, envFields, parseEnv } from './config.ts';

const schema = z.object(envFields);

describe('parseEnv', () => {
  it('applies defaults to a valid environment', () => {
    const env = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', REDIS_URL: 'redis://localhost:6379' };

    expect(parseEnv(schema, env)).toEqual({ ...env, LOG_LEVEL: 'info' });
  });

  it('reports every invalid key without echoing secret values', () => {
    const secretUrl = 'mysql://admin:s3cret@db:3306/app';

    const parse = () => parseEnv(schema, { DATABASE_URL: secretUrl, LOG_LEVEL: 'loud' });

    expect(parse).toThrow(ConfigError);
    expect(parse).toThrow(/DATABASE_URL[\s\S]*REDIS_URL[\s\S]*LOG_LEVEL/);
    expect(parse).not.toThrow(/s3cret/);
  });
});
