# AiStory Agent Guide

AiStory is a Next.js 16 App Router app for creating template-driven stories, grouping generated segments into chapters, and generating audio. It uses React 19, strict TypeScript, MongoDB/Mongoose, NextAuth v5, the Vercel AI SDK (Together AI/OpenAI), Together AI TTS, Ant Design, and Tailwind CSS v4.

## Map

- `app/book/[bookId]/page.tsx`: main generation/editor flow; keep changes focused and extract substantial new logic.
- `app/api/**`: authenticated books, templates, AI, TTS, and settings routes.
- `models/index.ts`, `types/index.ts`: persistence and shared contracts.
- `utils/_promptUtil.ts`: backward-compatible prompt rendering.
- `lib/aiStreamClient.ts`, `lib/ttsAudioClient.ts`: clients for streaming text and binary audio.
- `components/FetcherProvider.tsx`: JSON API client; do not use it for streams or blobs.

## Invariants

### Auth and data ownership

- `middleware.ts` protects everything except `/login` and `/api/auth/*`, but route handlers must still authenticate with `auth()` (or `getCurrentUser()`) and return explicit 401/403 errors.
- Scope user-owned book/template reads and writes by `ownerEmail`; never trust an owner supplied by the client.
- Google sign-in is restricted to emails already in the `users` collection. Preserve the local/test override in `lib/authSessionOverride.ts`.
- `/api/settings` manages global defaults and is admin-only; `/api/user/settings` may update only the current user's LLM selection and API keys.

### Book mutations

- `Book` embeds `storySegments`, `segmentSummaries`, and `chapters`.
- The old book `version` field and whole-document `PUT /api/books/[id]` flow are retired. Use the narrow subresource routes and update only the array/field they own.
- Validate book mutation payloads with `lib/bookMutationValidation.ts`. Include `ownerEmail` in the atomic query and do not overwrite unrelated embedded arrays.

### Prompts, AI, and TTS

- Keep prompt placeholders backward compatible, including mixed casing such as `{background}`, `{currentChapter}`, `{Narrator}`, and `{TextboxInput}`. Preserve `narration2` user-input behavior; check its book-page consumer and `_promptUtil.test.ts` together.
- `/api/ai` returns plain-text chunks when `stream: true` and `{ content }` JSON otherwise. Streaming failures are appended with the sentinel protocol in `lib/streamProtocol.ts`; clients should use `streamAiRequest()` so split sentinels and error envelopes are handled correctly.
- `/api/ai/tts` returns raw audio bytes. Fetch it as a `Blob` through `lib/ttsAudioClient.ts`; preserve its content-type handling and IndexedDB invalidation rules in `lib/ttsIndexedDb.ts`/`lib/ttsConfig.ts`.
- Use `lib/apiError.ts` for route error envelopes. Validate request bodies early and avoid exposing credentials or provider internals in errors/logs.
- User AI credentials and LLM selection come from `getUserSettingWithFallback()`; unset values fall back to the `keyvalues.defaultValue` document.
- Provider or generation-feature changes must stay synchronized across types, Mongoose schemas, constants/defaults, validators, settings routes/UI, and AI endpoint wiring. Add tests for validators and endpoint behavior.

### Data normalization

- For user-facing config, treat `null`, `undefined`, empty, and whitespace-only strings as unset unless the field explicitly differs.
- Normalize controlled inputs and persisted config to stable strings using helpers in `utils/_util.ts`; do not scatter ad hoc `|| ''`, `?? null`, or trim checks.

## Working conventions

- Use the `@/*` alias. Read both a route and its caller before changing a request/response contract.
- Use local `fetch` for streaming/binary endpoints and `FetcherProvider` for JSON APIs.
- Keep secrets server-side. Relevant env vars are documented in `README.md`; uploads additionally use `GCS_PROJECT_ID`, `GCS_CREDENTIALS`, and `GCS_BUCKET_NAME`.
- The local server runs on port `7002`.

## Validation

Run the narrowest relevant checks, then broaden for cross-cutting changes:

- `npm test` for utility, validation, stream, endpoint, or client logic; add/update focused Vitest coverage.
- `npm run lint` for code changes.
- `npm run build` for routes, auth, middleware, app-router boundaries, or shared contracts.
