# Compound

A story game that teaches personal finance. You live one financial life — first paycheck onward — and every
decision comes with feedback: what happened, the concept, why it matters (with your own numbers and the math),
and a Money Rule to keep.

No accounts, no ads, no purchases. Everything stays on the device.

## Run it

Requires Node 22.12+.

```bash
npm install
npm run dev        # open the printed URL (use your phone on the same network with --host)
```

Production build:

```bash
npm run build      # outputs dist/ — a static site
npm run preview    # serves dist/ locally
```

`dist/` uses relative paths, so it can be uploaded to GitHub Pages (project or user site) or Netlify as-is.

## Check everything

```bash
npm run check      # typecheck, unit tests, content validator, 1,000-run playtest bot
```

## Add or edit a scene

1. Open the chapter file, e.g. `content/chapters/ch1-first-paycheck.yaml`, and copy an existing scene.
2. Give it a new `id`, list its `concepts` (from `content/concepts.yaml`), and write the `setup`, `choices`,
   `explanation`, `whyItMatters`, `takeaway` and `review`.
3. For "Why it matters", pick a calc from `src/finance/calcs.ts` and map its inputs to numbers, `player.*`
   variables or `locale.*` facts.
4. Run `npm run validate`. It tells you exactly what's missing or broken.
5. If the scene states a real-world rule or figure, add `sources`, set `needsVerification: true`, and run
   `npm run verify:list`.

See `CLAUDE.md` for the full content conventions and `VERIFY.md` for everything awaiting fact-checking.
