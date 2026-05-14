# AiStory Agent Guide

## Purpose

AiStory is a Next.js App Router application for template-driven interactive story generation. Users create templates, generate story segments with an LLM, summarize and group those segments into chapters, and play audio generated from story text.

## Stack

- Next.js 16 App Router with React 19 and TypeScript strict mode
- MongoDB with Mongoose models in `models/index.ts`
- NextAuth v5 with Google SSO
- Vercel AI SDK with Mistral, Together AI, and OpenAI wiring in `lib/aiEndpointDynamic.ts`
- Together AI TTS in `lib/ttsEndpointDynamic.ts`
- Ant Design, Tailwind CSS v4, and `react-resizable-panels`
- Vitest for unit tests, ESLint for linting

## Main Areas

- `app/page.tsx`: template library landing page
- `app/book/[bookId]/page.tsx`: main reader/editor flow for story generation, editing, chaptering, and audio playback
- `app/templates/**`: template CRUD UI
- `app/setting/page.tsx`: user LLM and API key settings UI
- `app/api/**`: authenticated route handlers for books, templates, AI, TTS, and settings
- `components/**`: reusable UI primitives and `FetcherProvider`
- `utils/**`: prompt-building and story-formatting helpers with the current unit tests

## Required Invariants

### Auth and Ownership

- Treat the app as authenticated by default. `middleware.ts` protects everything except `/login` and `/api/auth/*`.
- Server routes should continue to use `auth()` from `auth.ts` and scope reads and writes by `ownerEmail` where applicable.
- Login is allowed only for users already present in the `users` collection. Do not weaken that behavior unless explicitly asked.
- There is an auth override path in `lib/authSessionOverride.ts` for local/testing scenarios. Preserve it.

### Books and Concurrency

- `BookModel` uses optimistic locking through the `version` field in `app/api/books/[id]/route.ts`.
- Preserve version checks on book updates. If you change book update flows, make sure the client still handles version conflicts cleanly.
- Story data is stored as embedded arrays on the book document: `storySegments`, `segmentSummaries`, and `chapters`.

### Prompt Builder Compatibility

- Prompt rendering lives in `utils/_promptUtil.ts`. Keep changes backward compatible with existing template placeholders.
- Existing repo data uses mixed placeholder casing such as `{background}`, `{currentChapter}`, `{Narrator}`, and `{TextboxInput}`. If you change replacement logic, prefer compatibility over strictness.
- `narration2` prompt composition is important for user input flow. Review `app/book/[bookId]/page.tsx` and `utils/_promptUtil.test.ts` before changing it.
- Deprecated fields still exist in active data models: `prompt.narrator` and `chapter.endState`. Do not remove them casually.

### AI and TTS Boundaries

- `/api/ai` can return streaming plain text or JSON depending on the `stream` flag.
- `/api/ai/tts` returns raw audio bytes, not JSON. Client code should fetch it directly as a `Blob`; do not route TTS through `FetcherProvider`.
- User-specific AI and TTS credentials come from `getUserSettingWithFallback()` in `auth.ts`, which falls back to the `defaultValue` document in `keyvalues`.
- If you add or change providers, update all relevant layers together: `types/index.ts`, `models/index.ts`, settings routes, defaults, UI, and `lib/aiEndpointDynamic.ts`.
- Note the current mismatch: `types/index.ts` includes `openAi`, but the Mongoose enum in `models/index.ts` only allows `mistral` and `together`.

## Coding Patterns To Preserve

- Use the `@/*` path alias instead of deep relative imports.
- Reusable helpers are typically exported as default utility objects, for example `utils/_util.ts` and `utils/_promptUtil.ts`.
- Client components use `FetcherProvider` for JSON APIs and local `fetch` for streaming or binary responses.
- Keep changes minimal in `app/book/[bookId]/page.tsx`; it is already a large stateful client page. Prefer extracting logic into focused hooks or components if the change is substantial.
- Continue using the existing style in route handlers: validate inputs early, return `NextResponse.json(...)` for JSON errors, and log server-side failures.

### String Normalization Boundary

- Treat empty strings, null, undefined, and whitespace-only strings as equivalent unset values for user-facing config fields unless a field explicitly needs different semantics.
- Normalize to empty strings at controlled-input boundaries so React form components receive stable string values.
- Normalize to empty strings at persistence boundaries so database writes do not depend on ad hoc `|| ''`, `|| null`, or `?? null` checks.
- Reuse shared helpers from `utils/_util.ts` for config normalization and fallback merging instead of scattering inline string guards or field-by-field null handling.

## Validation

Run the narrowest useful checks for the files you touched:

- `npm run lint`
- `npm test`
- `npm run build` for route, auth, middleware, or app-router changes

Current tests only cover utility modules under `utils/**`. If you change prompt composition, story formatting, or text cleanup, add or update Vitest coverage.

## Environment Notes

Expected environment variables include:

- `MONGO_URI`
- `MONGO_DB_NAME`
- `GOOGLE_SSO_CLIENT_ID`
- `GOOGLE_SSO_CLIENT_SECRET`

The local app runs on port `7002`.

## Practical Editing Advice

- Read the touched route and its paired client caller before changing request or response shapes.
- For prompt-related changes, inspect both the utility tests and the real consumers in the book flow.
- For TTS changes, verify both server response headers and the IndexedDB cache behavior in `lib/ttsIndexedDb.ts`.
- For template changes, check both CRUD routes and merged-template consumers.