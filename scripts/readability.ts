/** npm run readability — Flesch-Kincaid grade for every explanation; flags those above grade 10. */
import { loadAll } from '../src/content/load';
import { validateContent, READABILITY_GRADE_WARN } from '../src/content/validate';

const { content, locale, errors } = loadAll();
if (errors.length) {
  console.error('Fix content errors first (npm run validate).');
  process.exit(1);
}
const rows = validateContent(content, locale).readability.sort((a, b) => b.grade - a.grade);
const flagged = rows.filter((r) => r.grade > READABILITY_GRADE_WARN);
for (const r of rows) console.log(`${r.grade > READABILITY_GRADE_WARN ? '⚠' : ' '} ${r.grade.toFixed(1).padStart(5)}  ${r.id}`);
const avg = rows.reduce((s, r) => s + r.grade, 0) / Math.max(1, rows.length);
console.log(`\nAverage grade ${avg.toFixed(1)}; ${flagged.length} of ${rows.length} above grade ${READABILITY_GRADE_WARN}.`);
