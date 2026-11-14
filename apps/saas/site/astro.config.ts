import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const saasRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  output: 'static',
  outDir: '../dist',
  build: {
    format: 'directory',
  },
  vite: {
    server: {
      fs: {
        allow: [saasRoot],
      },
    },
  },
});
