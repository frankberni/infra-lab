import { defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve workspace packages to their TypeScript sources, so tests never depend on a prior build.
  ssr: { resolve: { conditions: ['@infra-lab/source', ...defaultServerConditions] } },
  test: {
    include: ['{apps,packages}/*/src/**/*.test.ts'],
  },
});
