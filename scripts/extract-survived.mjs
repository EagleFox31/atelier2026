import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('reports/mutation/index.html', 'utf8');
const assignIdx = html.indexOf('app.report = {');
const jsonStart = assignIdx + 'app.report = '.length;
const jsonChunk = html.substring(jsonStart);

let depth = 0, inStr = false, escapeNext = false, i = 0;
for (; i < jsonChunk.length; i++) {
  const c = jsonChunk[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (inStr && c === String.fromCharCode(92)) { escapeNext = true; continue; }
  if (c === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) break; }
}

const jsonStr = jsonChunk.substring(0, i + 1);

const data = (new Function('return (' + jsonStr + ')'))();
const files = data.files || {};

let total = 0, killed = 0, survived = 0, noCov = 0;
const rows = [];

for (const [file, fdata] of Object.entries(files)) {
  const fname = file.split('/').pop();
  const fK = fdata.mutants.filter(x => x.status === 'Killed').length;
  const fS = fdata.mutants.filter(x => x.status === 'Survived').length;
  const fN = fdata.mutants.filter(x => x.status === 'NoCoverage').length;
  const fI = fdata.mutants.filter(x => x.status === 'Ignored').length;
  const fT = fdata.mutants.length;
  const den = fT - fN - fI;
  const score = den > 0 ? Math.round((fK / den) * 100) : 0;
  const survivedMutants = fdata.mutants.filter(x => x.status === 'Survived');
  rows.push({ fname, file, fT, fK, fS, fN, score, survivedMutants });
  total += fT; killed += fK; survived += fS; noCov += fN;
}

rows.sort((a, b) => a.score - b.score);

console.log('=== SCORES PAR FICHIER ===');
for (const r of rows) {
  const icon = r.score >= 80 ? 'OK ' : r.score >= 60 ? 'WAR' : 'ERR';
  console.log(`[${icon}] ${r.fname.padEnd(40)} ${String(r.score+'%').padStart(4)}  survived:${r.fS}  noCov:${r.fN}`);
}
const den = total - noCov;
console.log(`\nSCORE GLOBAL: ${Math.round(killed/den*100)}%`);

console.log('\n=== SURVIVANTS ===');
for (const r of rows) {
  if (r.survivedMutants.length === 0) continue;
  console.log(`\n-- ${r.fname} (${r.survivedMutants.length}) --`);
  for (const m of r.survivedMutants) {
    console.log(`  L${m.location.start.line}  [${m.mutatorName}]  -> ${m.replacement}`);
  }
}

writeFileSync('reports/mutation/survived.json', JSON.stringify(rows.flatMap(r => r.survivedMutants.map(m => ({file: r.file, fname: r.fname, ...m}))), null, 2));
console.log('\nSauvegarde: reports/mutation/survived.json');
