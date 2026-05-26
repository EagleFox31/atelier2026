import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('reports/mutation/index.html', 'utf8');
const assignIdx = html.indexOf('app.report = {');
const jsonStart = assignIdx + 'app.report = '.length;
const jsonChunk = html.substring(jsonStart);

let depth = 0, inStr = false, escapeNext = false, i = 0;
for (; i < jsonChunk.length; i++) {
  const c = jsonChunk[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (inStr && c === '\\') { escapeNext = true; continue; }
  if (c === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) break; }
}

const jsonStr = jsonChunk.substring(0, i + 1);
console.log('JSON length:', jsonStr.length);
const data = JSON.parse(jsonStr);
const files = data.files || {};
console.log('File count:', Object.keys(files).length);

let total = 0, killed = 0, survived = 0, noCov = 0, timeout = 0, ignored = 0;
const rows = [];

for (const [file, fdata] of Object.entries(files)) {
  const fname = file.split('/').pop();
  const fT = fdata.mutants.length;
  const fK = fdata.mutants.filter(x => x.status === 'Killed').length;
  const fS = fdata.mutants.filter(x => x.status === 'Survived').length;
  const fN = fdata.mutants.filter(x => x.status === 'NoCoverage').length;
  const fTm = fdata.mutants.filter(x => x.status === 'Timeout').length;
  const fI = fdata.mutants.filter(x => x.status === 'Ignored').length;
  const den = fT - fN - fI;
  const score = den > 0 ? Math.round((fK / den) * 100) : 0;
  const survivedMutants = fdata.mutants.filter(x => x.status === 'Survived');
  rows.push({ fname, file, fT, fK, fS, fN, fTm, score, survivedMutants });
  total += fT; killed += fK; survived += fS; noCov += fN; timeout += fTm; ignored += fI;
}

rows.sort((a, b) => a.score - b.score);

console.log('\n=== RÉSULTATS PAR FICHIER ===');
for (const r of rows) {
  const icon = r.score >= 80 ? 'OK ' : r.score >= 60 ? 'WAR' : 'ERR';
  console.log(`[${icon}] ${r.fname.padEnd(45)} ${(r.score + '%').padStart(4)}  k:${r.fK} s:${r.fS} nc:${r.fN} tot:${r.fT}`);
}

console.log('');
const den = total - noCov - ignored;
const globalScore = den > 0 ? Math.round((killed / den) * 100) : 0;
console.log(`GLOBAL  total:${total}  killed:${killed}  survived:${survived}  noCov:${noCov}  timeout:${timeout}`);
console.log(`MUTATION SCORE: ${globalScore}%   (seuils: high>=80  low>=60  break<50)`);

console.log('\n=== MUTANTS SURVIVANTS (logique non testée) ===');
for (const r of rows) {
  if (r.survivedMutants.length === 0) continue;
  console.log(`\n-- ${r.fname} (${r.survivedMutants.length} survivants) --`);
  for (const m of r.survivedMutants) {
    console.log(`  L${m.location.start.line}  [${m.mutatorName}]  ${m.replacement}`);
  }
}

const survivedDetails = rows.flatMap(r =>
  r.survivedMutants.map(m => ({ file: r.file, fname: r.fname, ...m }))
);
writeFileSync('reports/mutation/survived.json', JSON.stringify(survivedDetails, null, 2));
console.log('\nDétails sauvegardés dans reports/mutation/survived.json');
