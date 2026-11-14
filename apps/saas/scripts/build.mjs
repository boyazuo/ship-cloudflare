import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const saasRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

rmSync(resolve(saasRoot, 'dist'), { recursive: true, force: true });

execFileSync('pnpm', ['exec', 'astro', 'build', '--root', 'site'], {
  cwd: saasRoot,
  stdio: 'inherit',
});

execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'app/vite.config.ts'], {
  cwd: saasRoot,
  stdio: 'inherit',
});
