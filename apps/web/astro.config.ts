import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  output: 'static',
  outDir: './dist',
  build: {
    format: 'directory',
  },
  vite: {
    server: {
      fs: {
        allow: [repoRoot],
      },
    },
  },
});
