#!/usr/bin/env node
/**
 * Atelier 2026 — Orchestrateur de développement
 * 1. Kill des ports existants
 * 2. Lancement NestJS :3001 (tsx) + Next.js :3000 (turbopack)
 * 3. Type-check backend + frontend en arrière-plan (parallèle)
 */

import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { networkInterfaces } from 'os';

const API_PORT  = 3001;
const NEXT_PORT = 3000;

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

const step = msg => console.log(`\n${CYAN}${BOLD}▶ ${msg}${RESET}`);
const ok   = msg => console.log(`${GREEN}${BOLD}  ✔${RESET}${DIM} ${msg}${RESET}`);
const fail = msg => console.log(`${RED}${BOLD}  ✘${RESET}${DIM} ${msg}${RESET}`);
const warn = msg => console.log(`${YELLOW}${BOLD}  ⚠${RESET}${DIM} ${msg}${RESET}`);
const info = msg => console.log(`${DIM}  · ${msg}${RESET}`);

// ─── 1. Vérifications ─────────────────────────────────────────────────────────
step('Vérifications préalables');

if (!existsSync('tsconfig.json')) { fail('Lance ce script depuis la racine du projet'); process.exit(1); }
ok('Racine du projet détectée');

if (!existsSync('node_modules')) { fail('node_modules absent — lance npm install'); process.exit(1); }
ok('node_modules présent');

if (!existsSync('.env') && !existsSync('.env.local')) {
  warn('.env introuvable — copie .env.example vers .env');
}

// ─── 2 & 3. Type-check parallèle (non-bloquant) ──────────────────────────────
step('Type-check (arrière-plan)');
info('Backend + Frontend en parallèle — les serveurs démarrent sans attendre');

function runTypeCheck(label, args) {
  const proc = spawn(
    process.platform === 'win32' ? 'cmd' : 'npx',
    process.platform === 'win32' ? ['/c', `npx tsc --noEmit ${args}`] : ['tsc', '--noEmit', ...args.split(' ').filter(Boolean)],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: false }
  );
  let out = '';
  proc.stdout.on('data', d => { out += d.toString(); });
  proc.stderr.on('data', d => { out += d.toString(); });
  proc.on('close', code => {
    if (code === 0) {
      ok(`${label} — aucune erreur TypeScript`);
    } else {
      fail(`${label} — erreurs TypeScript :`);
      console.error(out.trimEnd());
    }
  });
}

runTypeCheck('Backend', '-p tsconfig.server.json');
runTypeCheck('Frontend', '');

// ─── 4. Kill des ports ────────────────────────────────────────────────────────
step('Nettoyage des ports');
for (const port of [API_PORT, NEXT_PORT]) {
  try {
    if (process.platform === 'win32') {
      // netstat pour trouver le PID, puis taskkill
      const out = execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' }).toString();
      const pids = [...new Set(
        out.split('\n')
           .map(l => l.trim().split(/\s+/).pop())
           .filter(p => p && /^\d+$/.test(p) && p !== '0')
      )];
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); } catch {}
      }
    } else {
      execSync(`npx kill-port ${port}`, { stdio: 'pipe' });
    }
    ok(`Port ${port} libéré`);
  } catch {
    info(`Port ${port} déjà libre`);
  }
}

// Attente Windows — le socket se libère vraiment après 2s
await new Promise(r => setTimeout(r, 2000));

// ─── 5. Env Postman ───────────────────────────────────────────────────────────
try {
  writeFileSync('postman/env_dynamic.json', JSON.stringify({
    id: "atelier-env",
    name: "Atelier 2026 Local",
    values: [
      { key: "baseUrl", value: `http://localhost:${API_PORT}`, enabled: true }
    ],
    _postman_variable_scope: "environment"
  }, null, 2));
} catch {}

// ─── 6. Lancement ─────────────────────────────────────────────────────────────
step('Lancement des serveurs');

function getLocalIP() {
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

const localIP = getLocalIP();

console.log(`\n${CYAN}${BOLD}  Accès local${RESET}`);
info(`Next.js → http://localhost:${NEXT_PORT}`);
info(`NestJS  → http://localhost:${API_PORT}`);
info(`Swagger → http://localhost:${API_PORT}/api/docs`);

if (localIP) {
  console.log(`\n${GREEN}${BOLD}  Accès réseau (même WiFi)${RESET}`);
  info(`Next.js → http://${localIP}:${NEXT_PORT}`);
  info(`Swagger → http://${localIP}:${API_PORT}/api/docs`);
}
console.log('');

const processes = [];

function spawnServer(label, color, cmd, args, env = {}) {
  const prefix = `${color}${BOLD}[${label}]${RESET}`;
  const proc = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    shell: false, // shell:false évite les problèmes de signal sur Windows
  });
  proc.stdout.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => console.log(`${prefix} ${l}`))
  );
  proc.stderr.on('data', d =>
    d.toString().split('\n').filter(Boolean).forEach(l => console.log(`${prefix} ${RED}${l}${RESET}`))
  );
  proc.on('exit', code => {
    if (code !== 0 && code !== null)
      console.log(`${prefix} ${RED}Arrêté (code ${code})${RESET}`);
  });
  processes.push(proc);
  return proc;
}

const isWin = process.platform === 'win32';

// Sur Windows : on passe par cmd.exe /c pour exécuter les .cmd sans shell:true
// Sur Unix    : on appelle directement le binaire
function buildCmd(winCmd, unixCmd) {
  return isWin ? ['cmd', ['/c', winCmd]] : [unixCmd[0], unixCmd.slice(1)];
}

const [apiExe,  apiArgs]  = buildCmd(
  'node_modules\\.bin\\ts-node.cmd --project tsconfig.server.json server.ts',
  ['node_modules/.bin/ts-node', '--project', 'tsconfig.server.json', 'server.ts']
);
const [nextExe, nextArgs] = buildCmd(
  `node_modules\\.bin\\next.cmd dev --turbopack --port ${NEXT_PORT}`,
  ['node_modules/.bin/next', 'dev', '--turbopack', '--port', String(NEXT_PORT)]
);

async function waitForApiHealth() {
  const url = `http://localhost:${API_PORT}/api/health`;
  const maxAttempts = 60;
  const intervalMs = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        ok(`NestJS prêt (${url})`);
        return;
      }
    } catch {
      // API pas encore à l'écoute — on réessaie
    }
    if (attempt === 1) info(`En attente de NestJS sur le port ${API_PORT}…`);
    await new Promise(r => setTimeout(r, intervalMs));
  }

  warn(`NestJS non joignable après ${maxAttempts * intervalMs / 1000}s — Next.js démarre quand même`);
}

// NestJS — immédiatement
spawnServer('API ', '\x1b[35m', apiExe, apiArgs, { API_PORT: String(API_PORT) });

// Next.js — uniquement quand /api/health répond (évite ECONNREFUSED au proxy)
waitForApiHealth().then(() => {
  spawnServer('NEXT', '\x1b[34m', nextExe, nextArgs, { BACKEND_URL: `http://localhost:${API_PORT}` });
});

// ─── 7. Arrêt propre ──────────────────────────────────────────────────────────
function shutdown() {
  console.log(`\n${YELLOW}${BOLD}Arrêt des serveurs...${RESET}`);
  for (const p of processes) {
    try {
      if (process.platform === 'win32' && p.pid) {
        execSync(`taskkill /F /PID ${p.pid} /T`, { stdio: 'ignore' });
      } else {
        p.kill('SIGTERM');
      }
    } catch {}
  }
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

console.log(`${DIM}Ctrl+C pour arrêter les deux serveurs${RESET}\n`);
