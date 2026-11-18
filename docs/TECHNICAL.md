# Technical documentation — Eigo Steps

## Overview

Eigo Steps is a static single-page application. TypeScript, React 19 and Vite build it to plain
HTML/CSS/JS that runs from any static host: GitHub Pages, a school file server, or `npm run
preview` on a laptop. There is **no backend, no account system and no network traffic**. Lessons,
progress and settings live in the browser's `localStorage`, and the Content Security Policy enforces
that.

| Concern       | Choice                                                  | Why                                                                           |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Language      | TypeScript (strict, `noUncheckedIndexedAccess`)         | Type-safe content model and domain logic                                      |
| UI            | React 19, plain CSS with design tokens                  | Widely known; no CSS framework needed                                         |
| Validation    | Zod 4 schemas                                           | One source of truth for types **and** runtime validation of untrusted content |
| Routing       | ~150-line hash router                                   | Works on any static host without rewrite rules; parameters are validated      |
| State         | Small observable store + `useSyncExternalStore`         | Explicit actions, no framework, easy to test                                  |
| Audio         | Web Speech API (device voices)                          | Free, offline-capable, no API key; graceful fallback                          |
| Illustrations | Noto Emoji SVGs (SIL OFL 1.1), 160 bundled              | Consistent on every school device, licensed for reuse                         |
| Tests         | Vitest + Testing Library (jsdom), Playwright + axe-core | Unit, integration, browser E2E and automated accessibility checks             |

## Project structure

```
src/
  domain/        Pure TypeScript, no React: schemas, grading, spaced review, progress, analytics,
                 lesson-check generation, synthetic demo data, import/export. Fully unit-tested.
  content/       The six built-in lessons (validated by the same schema as teacher lessons)
                 and the illustration manifest.
  services/      Browser adapters: storage (localStorage with validation) and speech synthesis.
  state/         AppStore (actions + persistence), React context and hooks, settings schema.
  app/           App shell, layout, hash router.
  features/      Screens: home, modules, activities (cards, matching, grammar, question sets,
                 listening, reading), review, progress, settings, teacher (library, editor,
                 export/print, class overview), about.
  ui/            Shared components (bilingual text, speak button, illustration, progress).
  styles/        Design tokens (light/dark), layout, components, activities, teacher, print.
e2e/             Playwright tests (journeys, teacher mode, accessibility, security, mobile) and
                 the screenshot generator.
scripts/         fetch-illustrations.mjs: downloads and checks the Noto Emoji SVGs.
docs/            Case study, this document, recruiter guides, screenshots.
```

The **domain layer has no UI dependencies**. Everything that matters educationally (grading,
feedback, scheduling, analytics) can be tested in milliseconds without a browser.

## Content model

A lesson (`Module`) contains metadata and content sections. All of them are defined in
`src/domain/schema.ts`:

- **Educational metadata** (required for every lesson): objectives, target level (CEFR + optional
  CEFR-J band), learner groups, student instructions (EN/JA), teacher instructions (overview,
  steps, differentiation, common errors), success criteria, feedback approach, assessment
  strategy (formative, summative, pass mark).
- **Vocabulary**: word, Japanese, picture (emoji), part of speech, example sentence with
  `[bracket]` highlighting, optional note (e.g. _go → went_).
- **Grammar**: pattern, bilingual explanation, example tabs, optional _switcher_, common mistakes.
- **Practice questions**: a discriminated union of `mcq`, `fill` (word bank or typed, accepted
  answers, authored common errors, hint) and `build` (sentence from tiles, alternatives,
  distractors). Every question carries **focus tags** such as `third-person-s` or `plural-s`.
- **Listening items**: a script with speakers, question, text or picture options (optionally
  picture-only), per-option feedback.
- **Reading**: paragraphs, glossary, multiple-choice questions.

**Activities are derived, not authored.** `getActivities(module)` (`src/domain/activities.ts`)
builds the sequence from the content that exists: words → cards and matching, grammar →
explanation, questions → practice, scripts → listening, text → reading, all → lesson check. It also
attaches instructions and the "why this activity?" notes. Instructions use a child-friendly
register (hiragana Japanese) when the primary audience is elementary.

## Grading and corrective feedback (`src/domain/grading.ts`)

- `normalizeAnswer` applies NFKC (full-width IME input → ASCII), unifies apostrophes and quotes,
  and ignores case and trailing punctuation.
- `checkFill` checks, in order: accepted answers → authored common errors → rule-based diagnosis
  (missing/extra third-person -s, plural -s, present-for-past, over-regularised irregular past
  using a table of common irregular verbs, near-miss spelling via edit distance) → authored hint.
- `checkBuild` checks exact orders and alternatives first. Otherwise it reports distractor tiles,
  missing words or wrong word order, says how many leading words are already right, and adds a
  tag-specific word-order hint (e.g. _“In questions, Do comes first”_).
- `QuestionSet` runs the hint-first / model-second sequence in practice mode and one try in quiz
  mode. It records an `ItemAnswer` (first-try result, first wrong answer, audio plays) for every item.

## Spaced review (`src/domain/srs.ts`)

A five-box Leitner system with intervals of 0 / 1 / 3 / 7 / 14 days (30 days after a correct answer
in box 5). Due dates are stored as **local calendar dates** (`YYYY-MM-DD`), not timestamps, so
"due today" means the learner's today regardless of time zone or daylight saving. Review sessions
mix three task types (picture → word, audio → picture, Japanese meaning → word). Each answer is
saved as soon as it is given.

## Progress and analytics

`src/domain/progress.ts` holds the persisted progress shape (Zod-validated on load) and pure
reducers:

- per activity: completion, attempts, best/last score;
- per item: attempts, first-try correct, the last 5 results, most common wrong answers, audio plays;
- spaced-review cards, active days (for streaks), and recent attempts (capped).

`src/domain/analytics.ts` derives module summaries, skill accuracy, **focus areas** (tags below 70%
recent first-try accuracy with at least 3 answers, each linked to the activity where it went worst),
tricky words, and **suggestions** in priority order (review → weakest area → continue → retake →
start next). `src/domain/report.ts` computes the class view from learner report files: overview,
class focus areas, **item analysis** (facility index + common wrong answers) and learners to check in
with.

## Demo mode and synthetic data (`src/domain/demo.ts`)

Recruiters can explore without registering. **Explore the demo** loads a synthetic learner,
"Sora". The class overview shows a synthetic class of 24 pseudonymous learners. The data is not
typed in by hand. A seeded simulation answers the **real lesson items** through the **same reducers**
that record real answers, using a Rasch-style model (ability − difficulty), with extra difficulty for
known L1-transfer trouble spots. As a result the dashboards, focus areas and item analysis behave
exactly as they would with real data, and the data is reproducible for tests. Demo mode can be
reset or cleared at any time.

## Persistence (local-first)

`src/services/storage.ts` wraps `localStorage` (falling back to memory if storage is blocked, e.g.
private browsing or a strict school device policy). Every stored value is parsed with its Zod
schema on load. Corrupt or tampered data is moved to `<key>:invalid`, not deleted, and the app
starts with defaults and a notice. Learners can download and restore a backup file.

## Security and privacy

| Threat                                                    | Mitigation                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS through lesson content (teacher-authored or imported) | Content is always rendered as text by React. ESLint forbids `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML` and `document.write`. An E2E test imports a lesson with `<img onerror>` / `<script>` payloads and checks nothing runs.                              |
| Malicious or malformed import files                       | Size limit (1 MB), JSON parse in a guard, strict Zod schemas (unknown keys stripped, length and count limits, cross-field checks), slug-only ids (blocks `__proto__` and path tricks), id collisions renamed                                                                 |
| Prototype pollution via stored data                       | Record keys validated against a slug pattern. Wrong-answer statistics are stored as arrays, not objects keyed by user text.                                                                                                                                                  |
| Data exfiltration / third-party tracking                  | No network requests at all. **Content Security Policy** (`default-src 'self'; connect-src 'self'; object-src 'none'; form-action 'none'; base-uri 'self'`) shipped in the production build. An E2E fixture fails any test that makes a request to another origin.            |
| CSV/formula injection in exports                          | Cells starting with `= + - @` are prefixed and every cell is quoted                                                                                                                                                                                                          |
| Children's personal data                                  | No accounts, no names (nicknames only), no analytics. Learner reports contain nickname + results only.                                                                                                                                                                       |
| Supply chain                                              | Few runtime dependencies (React, Zod, lucide-react). Dependencies installed with a 14-day release cooldown (`npm install --before`). Lockfile with `npm ci`; `npm audit` and `npm audit signatures` in CI. GitHub Actions pinned to commit SHAs. Dependabot with a cooldown. |
| Secrets                                                   | None needed or present. `.env*` ignored.                                                                                                                                                                                                                                     |

## Accessibility

- Semantic landmarks, a skip link, one `h1` per page that receives focus on navigation, and the
  page title updated on each route.
- All interactions are native controls: answer options are real radio inputs, matching cards and
  word tiles are buttons with descriptive labels (_“Add ‘like’”_), and tabs follow the ARIA tabs
  pattern with arrow keys.
- Feedback is announced in `aria-live` regions. Correct and incorrect are never shown by colour
  alone (icons + text + screen-reader text).
- Japanese text is marked `lang="ja"`. Contrast meets WCAG AA. Visible focus rings, 44 px touch
  targets, `prefers-reduced-motion` and `prefers-color-scheme` (dark mode) are respected.
- An option to always show listening transcripts (for deaf or hard-of-hearing learners).
- **axe-core** scans 17 pages for WCAG 2.1 A/AA issues in CI (serious/critical issues fail the build).

## Performance

The production build is code-split: the learner app is ~67 KB gzipped, React ~68 KB, other
libraries ~32 KB, and teacher tools load on demand. Illustrations are individual SVGs, cached by the
browser. There is no runtime network dependency, so lessons work on slow school networks once loaded.

## Testing strategy

| Layer       | Tool                                                         | What is covered                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                                                       | Grading and diagnosis (including IME input), Leitner scheduling and dates, progress reducers, analytics and suggestions, lesson-check generation, text utilities, schema security (prototype keys, XSS strings, limits, cross-field rules), import/export and CSV injection, synthetic class statistics, **validation of all built-in lessons and their answer keys** |
| Integration | Vitest + Testing Library (jsdom)                             | Question flows (hint → retry → model answer, quiz one-try, typing, tiles, listening with audio fake), activity pages (cards → spaced review, matching, preview mode not saving), lesson editor (validation summary, sample lesson save, duplicating built-ins), routing, demo/reset, Japanese-support toggle, corrupted-storage recovery, review sessions             |
| End-to-end  | Playwright (Edge locally, Chromium in CI), desktop + Pixel 7 | Learner journeys on the **production build** (CSP active), teacher create → preview → export → import, report hand-in, accessibility (axe on 17 pages, keyboard-only use, focus management), CSP presence, XSS import, no third-party requests, no console errors, no horizontal scrolling on mobile                                                                  |

```bash
npm test            # unit + integration (101 tests)
npm run test:e2e    # browser E2E (47 tests) — builds and serves the production bundle
npm run verify      # format + lint + typecheck + tests + build + E2E
npm run screenshots # regenerate docs/screenshots
```

## Running and deploying

```bash
npm ci              # install exactly what the lockfile says
npm run dev         # http://localhost:5188
npm run build       # static site in dist/
npm run preview     # serve dist/ at http://localhost:4188
```

**GitHub Pages:** push to `main` and enable _Settings → Pages → Source: GitHub Actions_. The
`deploy-pages.yml` workflow tests, builds and publishes `dist/`. Because assets use relative paths
and routing uses the URL hash, the same build works under any sub-path.

## Adding content

Teachers use **Teacher mode → Create a lesson** (with a one-click sample). Lesson files can be
shared with **Export → Lesson file** and **Import lesson file**. To add a built-in lesson in code,
create `src/content/modules/m7-*.ts` with `defineModule({...})` and add it to
`src/content/index.ts`. The content tests then validate it and check every answer key against the
grader. New emoji pictures are bundled by running `npm run illustrations`.

## Decisions and trade-offs

- **No backend.** Privacy, zero hosting cost and use in schools without approval cycles. The
  trade-off is file-based class data (see limitations in the case study).
- **Rule-based feedback, no AI service.** Predictable errors deserve predictable, explainable
  feedback that costs nothing and works offline. An AI model could later add open-ended writing
  feedback as an _optional_ layer.
- **Device speech synthesis, not recordings.** Every word and dialogue gets audio, including
  teacher-made lessons, with no recording work. Teacher recordings are the planned next step.
- **Derived activities.** Teachers write content, not flows, which keeps lessons pedagogically
  consistent.

## Roadmap (after the MVP)

1. Teacher voice recording for words and dialogues (MediaRecorder, stored locally).
2. Speaking practice with optional speech recognition where available.
3. Offline install (PWA) for school devices.
4. Optional school-hosted sync server for class data (keeping nickname-only identities).
5. More lessons aligned with Eiken Grade 5 → Pre-2 topics; furigana support for younger learners.
