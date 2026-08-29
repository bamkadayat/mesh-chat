import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** No DOM, so a Node assumption cannot pass by accident under jsdom. */
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
