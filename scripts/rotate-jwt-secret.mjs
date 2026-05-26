#!/usr/bin/env node
/**
 * Rotation JWT : déplace JWT_SECRET → JWT_SECRET_PREVIOUS, génère un nouveau JWT_SECRET.
 *
 * Usage:
 *   node scripts/rotate-jwt-secret.mjs           # applique sur .env
 *   node scripts/rotate-jwt-secret.mjs --dry-run   # affiche sans écrire
 *   node scripts/rotate-jwt-secret.mjs --env path  # autre fichier env
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const envFlagIndex = args.indexOf('--env');
const envPath = envFlagIndex >= 0
  ? path.resolve(args[envFlagIndex + 1])
  : path.join(__dirname, '..', '.env');

function parseEnvLines(content) {
  return content.split(/\r?\n/);
}

function getVar(lines, key) {
  const prefix = `${key}=`;
  const line = lines.find((l) => l.startsWith(prefix) || l.startsWith(`${key} =`));
  if (!line) return '';
  const match = line.match(/^[^=]+=\s*(.*)$/);
  if (!match) return '';
  return match[1].trim().replace(/^["']|["']$/g, '');
}

function setVar(lines, key, value) {
  const quoted = `"${value.replace(/"/g, '\\"')}"`;
  const prefixRegex = new RegExp(`^\\s*${key}\\s*=`);
  let found = false;
  const next = lines.map((line) => {
    if (prefixRegex.test(line)) {
      found = true;
      return `${key}=${quoted}`;
    }
    return line;
  });
  if (!found) {
    next.push(`${key}=${quoted}`);
  }
  return next;
}

function generateSecret() {
  return crypto.randomBytes(48).toString('base64url');
}

if (!fs.existsSync(envPath)) {
  console.error('Fichier env introuvable:', envPath);
  process.exit(1);
}

const original = fs.readFileSync(envPath, 'utf8');
const lines = parseEnvLines(original);
const current = getVar(lines, 'JWT_SECRET');

if (!current) {
  console.error('JWT_SECRET absent dans', envPath);
  process.exit(1);
}

const nextSecret = generateSecret();
let updated = setVar(lines, 'JWT_SECRET_PREVIOUS', current);
updated = setVar(updated, 'JWT_SECRET', nextSecret);
const output = updated.join('\n').replace(/\n?$/, '\n');

const summary = {
  envPath,
  dryRun,
  previousPromoted: `${current.slice(0, 6)}…${current.slice(-4)} (${current.length} chars)`,
  newSecret: `${nextSecret.slice(0, 6)}…${nextSecret.slice(-4)} (${nextSecret.length} chars)`,
  nextSteps: [
    'Redémarrer l\'API NestJS pour charger les nouveaux secrets',
    'Laisser JWT_SECRET_PREVIOUS actif pendant au moins JWT_EXPIRES_IN (défaut 1j)',
    'Puis vider JWT_SECRET_PREVIOUS="" ou supprimer la ligne',
  ],
};

console.log(JSON.stringify(summary, null, 2));

if (dryRun) {
  console.log('\n--dry-run: aucune modification écrite.');
  process.exit(0);
}

fs.writeFileSync(envPath, output, 'utf8');
console.log('\nRotation appliquée. Redémarrez le backend.');
