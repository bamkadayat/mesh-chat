import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The server suite deliberately runs without a DOM, so a Node assumption in the room
// manager cannot pass by accident under jsdom.
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
