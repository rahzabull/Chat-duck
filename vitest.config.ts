import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@animation': resolve(__dirname, 'src/animation'),
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
