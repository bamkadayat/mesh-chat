import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Paths resolve from this file because package.json sits at the repository root. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    /**
     * Without this Vite binds IPv6 loopback only, and Firefox refuses to gather
     * ICE candidates on a page served over ::1, so no DataChannel ever opens.
     */
    host: true,
  },
});
