import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// package.json and the lockfile live at the repository root while the client lives
// in frontend/, so root and outDir are resolved from this file rather than from the
// directory the script happens to run in.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [react()],
});
