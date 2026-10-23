/** npm run playtest -- --runs 1000 [--seed 1] [--hard] [--json] — exits 1 on any failure or unreachable scene. */
import { writeFileSync } from 'node:fs';
import { loadAll } from '../src/content/load';
import { createEngine } from '../src/engine/step';
import { runPlaytest } from '../src/sim/playtest';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const { content, locale, errors } = loadAll();
if (errors.length) {
  console.error('Content has errors; run npm run validate.');
  process.exit(1);
}
const engine = createEngine(content, locale);
const t0 = performance.now();
const r = runPlaytest(engine, { runs: arg('runs', 1000), seedStart: arg('seed', 1), mode: process.argv.includes('--hard') ? 'hard' : 'normal' });
const ms = performance.now() - t0;
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const pct = (n: number) => `${((n / r.runs) * 100).toFixed(1)}%`;

console.log(`Played ${r.runs} runs in ${(ms / 1000).toFixed(1)}s (70% random choices, 10% each best / foil / worst).\n`);
console.log('Endings:');
for (const [k, v] of Object.entries(r.endings).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(20)} ${String(v).padStart(5)}  ${pct(v)}`);
console.log('\nEndings by policy:');
for (const [p, e] of Object.entries(r.endingsByPolicy)) console.log(`  ${p.padEnd(8)} ${Object.entries(e).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
const d = (x: typeof r.netWorth, f: (n: number) => string) => `min ${f(x.min)} · p10 ${f(x.p10)} · median ${f(x.median)} · p90 ${f(x.p90)} · max ${f(x.max)}`;
console.log(`\nDecisions per run: ${d(r.decisionsPerRun, String)}`);
console.log(`Final net worth:   ${d(r.netWorth, usd)}`);
console.log(`Emergency months:  ${d(r.emergencyMonths, (n) => n.toFixed(1))}`);
console.log(`Wellbeing:         ${d(r.wellbeing, (n) => n.toFixed(0))}`);
console.log('\nCrises triggered (runs):', JSON.stringify(r.crises));
console.log('\nConcept exposure (decisions that taught it):');
for (const [k, v] of Object.entries(r.conceptExposure).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(26)} ${(v / r.runs).toFixed(2)} per run`);
console.log('\nRandom events (per 100 runs):', Object.entries(r.events).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((v / r.runs) * 100).toFixed(0)}`).join(', '));
if (process.argv.includes('--json')) writeFileSync('playtest-report.json', JSON.stringify(r, null, 2));

let failed = false;
if (r.unvisitedScenes.length) {
  failed = true;
  console.error(`\n✗ ${r.unvisitedScenes.length} scene(s) never reached: ${r.unvisitedScenes.join(', ')}`);
}
if (r.failures.length) {
  failed = true;
  console.error(`\n✗ ${r.failures.length} failed run(s):`);
  for (const f of r.failures.slice(0, 20)) console.error(`  seed ${f.seed} (${f.policy}): ${f.message}`);
}
if (failed) process.exit(1);
console.log('\n✓ No dead ends, unreachable scenes, NaN or impossible states.');
