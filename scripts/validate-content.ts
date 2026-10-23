/** npm run validate — schema, references, coverage and readability. Exits 1 on errors. */
import { existsSync, readFileSync } from 'node:fs';
import { loadAll } from '../src/content/load';
import { buildVerifyMd } from '../src/content/verify';
import { validateContent } from '../src/content/validate';

const { content, locale, errors: loadErrors, files } = loadAll();
const report = loadErrors.length ? null : validateContent(content, locale);
const errors = [...loadErrors, ...(report?.errors ?? [])];
const verbose = process.argv.includes('--verbose');

console.log(`Checked ${files.length} files.`);
if (report) {
  const s = report.stats;
  console.log(`${s.chapters} chapter(s), ${s.scenes} scenes, ${s.events} events. Decisions per chapter: ${JSON.stringify(s.decisionsPerChapter)}`);
  console.log('\nConcept coverage (scenes / contexts):');
  for (const r of report.coverage.filter((r) => r.scenes > 0 || verbose)) {
    const mark = r.scenes >= 3 && r.contexts >= 2 ? '✓' : r.enforced ? '✗' : '…';
    console.log(`  ${mark} ${r.id.padEnd(26)} ${String(r.scenes).padStart(2)} / ${r.contexts}   (${r.kind}, ch ${r.chapters.join(',')})`);
  }
  const untaught = report.coverage.filter((r) => r.scenes === 0).length;
  if (untaught) console.log(`  … ${untaught} concept(s) not taught yet (future chapters). Use --verbose to list.`);
  const verify = buildVerifyMd(content, locale);
  if (!existsSync('VERIFY.md') || readFileSync('VERIFY.md', 'utf8') !== verify) report.warnings.push('VERIFY.md is out of date — run npm run verify:list');
  if (report.warnings.length) {
    console.log(`\n${report.warnings.length} warning(s):`);
    for (const w of report.warnings) console.log(`  ⚠ ${w}`);
  }
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\nContent OK.');
