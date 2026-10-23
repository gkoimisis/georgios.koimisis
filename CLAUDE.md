# Compound — CLAUDE.md

A mobile-first story game that teaches personal finance. Vite + TypeScript + Preact, no backend.
All story and teaching content lives in YAML under `content/`; country rules live in `locales/`.

## Commands

```bash
npm install
npm run dev            # dev server (content hot-reloads)
npm run build          # production build to dist/ (fails on content errors)
npm run preview        # serve dist/
npm run typecheck
npm test               # Vitest: finance, engine, content, saves, 1,000-run playtest
npm run validate       # content validator: schema, references, coverage, readability (--verbose)
npm run playtest -- --runs 1000 [--seed N] [--hard] [--json]
npm run readability    # Flesch-Kincaid grade per explanation
npm run verify:list    # regenerate VERIFY.md (validator warns when stale)
npm run check          # typecheck + tests + validate + playtest — run before committing
```

## Architecture

```
content/            YAML: chapters/, events/ (random decks), crises, endings, characters, backgrounds, concepts
locales/us.yaml     Country facts (tax brackets, limits, typical rates) with kind/source/lastVerified
src/content/        zod schemas (build/test only), node loader, validator, readability, VERIFY.md builder
src/content/keys.ts Shared key lists — keep zod out of runtime imports (bundle size)
src/finance/        Pure, tested money math + calcs.ts (named calcs content can call)
src/engine/         Game state machine (pure): step.ts, tick.ts (monthly sim), effects, conditions, vars,
                    rng (stateless seeded), autoplay policies, report card (replays/counterfactuals)
src/sim/            Playtest bot
src/save/           localStorage saves (versioned, migrations, try/catch), save codes
src/i18n/           en.json (all interface strings), t(), formatter
src/ui/             Preact app: App, screens/, components/, styles/ (tokens.css + app.css)
scripts/            CLIs + Vite content plugin (virtual:compound-content)
tests/              Vitest
```

Key ideas:
- `step(engine, state, action)` is pure and returns a new state. UI, playtest bot, foil friend and report card all use it.
- Randomness is `rand(seed, tag, n)` — stateless, so replays with a different choice see the same events in the same months. Event decks pick a candidate per month first, then check eligibility.
- Money meters are **derived from the ledger** (checking, savings, card, loans, recurring lines). Wellbeing/relationships are 0–100 sub-meters.
- Every number in "Why it matters" comes from `src/finance/calcs.ts`, which wraps tested functions. Calc inputs and outputs can both appear in the text.
- The foil friend = `foilPolicy` (tempting choice, else worst). "Best path" = `bestPolicy`. Both replay from the chapter-start snapshot.
- Phases: `chapterIntro → scene → feedback → (summary) → … → episodeEnd → chapterEnd → ending`.

## Content conventions

- One chapter per file: `content/chapters/chN-slug.yaml`. Scene ids: `chN-eM-sK`; event-deck scenes `chN-ev-*`.
- Every scene needs: `concepts`, `setup` (2–4 sentences, second person), 2–4 `choices` (each with `quality`
  best/good/risky/costly and a 1–3 sentence `outcome`), `explanation` (≤ 80 words, grade ≤ 10),
  `whyItMatters` (calc + inputs), one-sentence `takeaway`, and a `review` item (answer must match an option).
- Mark one choice `tempting: true` (what the foil friend picks). Tag biases/dark patterns on choices:
  `bias: { id, resisted }`, `darkPattern: { id, resisted }`.
- Branching: gate scenes with `when` (flags / `player.*` vars); `goto` only to a later scene in the same
  episode or an interlude. Delayed consequences: `schedule: [{ event|scene, inMonths }]` with
  `drawable: false` events in a deck.
- Text placeholders: `{player.netMonthlyIncome}`, `{locale.hysaApy}`; in `whyItMatters.text` also the calc's
  input/output names (`{interest}`). Use `variants: [{ when, text }]` for edge cases (e.g., goal already met).
- **Never invent statistics, laws, limits or rates.** Put real-world figures in `locales/*.yaml` with a
  `source`; leave `lastVerified: null` until a human checks. Scenes that state how a law/product works get
  `needsVerification: true` + `sources`. Then run `npm run verify:list`.
- `illustrative: true` on `whyItMatters` when example numbers aren't the player's or are rounded rates.
- Coverage: each concept needs 3+ scenes in 2+ contexts once all its listed chapters exist (validator).
- Tone: warm, witty, never preachy or shaming. Mistakes are learning moments.

## UI conventions

- All interface strings in `src/i18n/en.json`; never hard-code English in components.
- Colors only via tokens in `tokens.css` (light, dark, high contrast). Check AA contrast when adding tokens.
- Each view focuses its heading on mount (`useAutoFocus`) and supports keyboard (`useHotkeys`: 1–4, Enter).
- Respect reduced motion (system + in-game setting). No dark patterns: no fake urgency, guilt or purchases.

## Phase status

- Phase 1 (vertical slice): done — engine, meters, feedback, saves, finance tests, validator, playtest bot, Chapter 1, report card.
- Next: Phase 2 retention systems (streaks, Daily Dilemma, spaced review, mastery map, badges, What if?), then
  Chapters 2–8, then PWA/accessibility audit/research mode/educator guide.
