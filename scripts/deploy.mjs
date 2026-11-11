import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const staging = mkdtempSync(join(tmpdir(), 'huilang-pages-'));
const git = (...args) => execFileSync('git', args, { cwd: staging, stdio: 'inherit' });
try {
  cpSync(join(root, 'dist'), staging, { recursive: true });
  writeFileSync(join(staging, '.nojekyll'), '');
  git('init', '--initial-branch=gh-page');
  git('config', 'user.name', 'Huilang Publisher');
  git('config', 'user.email', 'publisher@users.noreply.github.com');
  git('remote', 'add', 'origin', 'https://github.com/0xAliya/huilang2.git');
  git('fetch', 'origin', 'gh-page');
  git('add', '.');
  git('commit', '-m', 'Publish Huilang');
  git('push', '--force-with-lease', 'origin', 'gh-page');
  console.log('Published gh-page. GitHub Pages will update https://0xaliya.github.io/huilang2/');
} finally {
  rmSync(staging, { recursive: true, force: true });
}
