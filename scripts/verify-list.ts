/** npm run verify:list — regenerates VERIFY.md from the locale pack and scene flags. */
import { writeFileSync } from 'node:fs';
import { loadAll } from '../src/content/load';
import { buildVerifyMd } from '../src/content/verify';

const { content, locale, errors } = loadAll();
if (errors.length) {
  console.error('Fix content errors first (npm run validate).');
  process.exit(1);
}
writeFileSync('VERIFY.md', buildVerifyMd(content, locale));
console.log('Wrote VERIFY.md');
