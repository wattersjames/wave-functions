# Wave functions

An interactive Next.js + TypeScript teaching app for visualizing simple wave functions on a normalized interval `x ∈ [0, 1]`.

The canvas shows:

- **Blue**: real component `Re ψ`
- **Orange**: imaginary component `Im ψ`
- **Violet fill**: peak-normalized `|ψ|²`

The app also includes an AI tutor endpoint that explains the selected preset and answers follow-up questions.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- Tailwind CSS 4
- KaTeX + react-markdown for math explanations
- Vercel AI SDK / AI Gateway model routing
- Node's built-in `node:test` runner for unit tests

## Getting started

Install dependencies:

```bash
npm ci
```

Run the development server:

```bash
npm run dev
```

Open <http://localhost:3000> in your browser.

## AI tutor configuration

The tutor API route defaults to `openai/gpt-5.4` and can be overridden with:

```bash
AI_EXPLAIN_MODEL=openai/gpt-5.4
```

The route expects `application/json` requests and includes guardrails for:

- Known preset IDs only
- Maximum request body size
- Maximum message count and character budgets
- Basic in-memory per-client rate limiting
- Generic client-facing provider error messages

## Available scripts

```bash
npm run dev        # Start local development server
npm run build      # Create a production build
npm run start      # Start the production server after building
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript without emitting files
npm run test       # Run unit tests with node:test
npm run check      # Run lint, typecheck, tests, and build
```

## Project layout

```text
src/app/                 Next.js App Router routes and global styles
src/app/api/explain/     Streaming AI tutor route
src/components/          Interactive visualization and tutor UI
src/lib/                 Physics, prompt, and request-validation helpers
tests/                   Unit tests for physics and API request helpers
```

## Notes for contributors

- Keep wave math deterministic and side-effect-free so it remains easy to unit test.
- Keep AI request validation outside the route when possible; `src/lib/explainRequest.ts` is covered by unit tests.
- The project avoids `next/font/google` so production builds do not need to fetch Google Fonts at build time.
- Run `npm run check` before opening a pull request.
