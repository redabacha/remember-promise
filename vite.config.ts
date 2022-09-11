import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['.pnp.cjs', '.pnp.loader.mjs'],
    },
  },
});
