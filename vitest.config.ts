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
  test: {
    include: process.env.DUCKY_OLLAMA_BAKEOFF === '1' ? ['tests/**/*.test.ts'] : ['tests/*.test.ts'],
    environment: 'node',
  },
});
