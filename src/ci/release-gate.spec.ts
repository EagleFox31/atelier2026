import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Non-régression du Release gate de « Deploy AWS » (issue #83) : le script est
// lancé tel que le workflow le lance, contre de vrais dépôts git temporaires.
const SCRIPT = resolve(__dirname, '../../scripts/ci/release-gate.mjs');

function git(repo: string, ...args: string[]) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: 'pipe' });
}

function commit(repo: string, file: string, content: string, message: string) {
  writeFileSync(join(repo, file), content);
  git(repo, 'add', file);
  git(repo, 'commit', '-q', '-m', message);
}

function gate(repo: string, ...args: string[]) {
  const out = execFileSync('node', [SCRIPT, '--repo', repo, ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, GITHUB_OUTPUT: '' },
  });
  return Object.fromEntries(
    out
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

describe('release gate (deploy.yml)', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'release-gate-'));
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.email', 'ci@example.test');
    git(repo, 'config', 'user.name', 'CI');
    git(repo, 'config', 'commit.gpgsign', 'false');
    commit(repo, 'version.txt', '1.15.0\n', 'chore(main): release 1.15.0');
    commit(repo, 'app.ts', 'a', 'feat: something');
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('ne déploie pas un merge ordinaire', () => {
    expect(gate(repo, '--event', 'push', '--main-ref', 'main')).toMatchObject({
      deploy: 'false',
      version: '1.15.0',
    });
  });

  it('déploie le commit de release (version.txt modifié)', () => {
    commit(repo, 'version.txt', '1.16.0\n', 'chore(main): release 1.16.0');
    expect(gate(repo, '--event', 'push', '--main-ref', 'main')).toEqual({
      deploy: 'true',
      version: '1.16.0',
      reason: 'release v1.16.0',
    });
  });

  it('déploie le merge commit de la PR de release (1er parent = main)', () => {
    git(repo, 'checkout', '-q', '-b', 'release');
    commit(repo, 'version.txt', '1.16.0\n', 'chore(main): release 1.16.0');
    git(repo, 'checkout', '-q', 'main');
    commit(repo, 'other.ts', 'b', 'fix: other');
    git(repo, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #81', 'release');
    expect(gate(repo, '--event', 'push', '--main-ref', 'main').deploy).toBe('true');
  });

  it('déploie toujours sur Run workflow manuel', () => {
    expect(gate(repo, '--event', 'workflow_dispatch')).toMatchObject({ deploy: 'true', version: '1.15.0' });
  });

  it("ne redéploie pas une ancienne release remplacée sur main (re-run d'un vieux CI)", () => {
    commit(repo, 'version.txt', '1.16.0\n', 'chore(main): release 1.16.0');
    const oldRelease = git(repo, 'rev-parse', 'HEAD').trim();
    commit(repo, 'version.txt', '1.17.0\n', 'chore(main): release 1.17.0');
    git(repo, 'checkout', '-q', '--detach', oldRelease);
    expect(gate(repo, '--event', 'push', '--main-ref', 'main')).toMatchObject({
      deploy: 'false',
      reason: expect.stringContaining('remplacée par v1.17.0'),
    });
  });

  it('échoue au lieu de deviner quand la ref main est introuvable', () => {
    commit(repo, 'version.txt', '1.16.0\n', 'chore(main): release 1.16.0');
    expect(() => gate(repo, '--event', 'push', '--main-ref', 'origin/main')).toThrow();
  });
});
