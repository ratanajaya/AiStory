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

- `middleware.ts` opens the homepage, guest-capable pages and APIs, public catalog, and auth routes. Each handler must resolve the actor or authenticate independently and return explicit 401/403 errors.
- Scope account-owned records by `ownerEmail` and guest records by `guestId` through `lib/guest.ts`; never trust ownership fields supplied by the client. Guest work expires after seven days and is claimed transactionally after Google sign-in.
- Google sign-in registers verified emails; new accounts are non-admin trial accounts. Preserve the local/test override in `lib/authSessionOverride.ts`.
- `/api/settings` manages global defaults and is admin-only; `/api/user/settings` may update only the current user's LLM selection and API keys.

### Public and guest behavior

- `isPublic` defaults to false. Only admins may set it on their own templates; public card responses expose no private fields. Starting a public template creates a private copy and book.
- Guest books, templates, images, and keys use a temporary workspace. Keep guest mutations coordinated with claim and cleanup through workspace state and MongoDB transactions. Run hourly cleanup via the Vercel cron or `npm run cleanup:guests`.
- App-funded guest/new-account generation uses a 20-call text and 10,000-character audio trial; guest IP limits are 60 calls and 30,000 characters per UTC day. Personal provider keys bypass trial consumption only for the corresponding provider. Do not expose keys in logs or API responses.

### Book mutations

- `Book` embeds `storySegments`, `segmentSummaries`, and `chapters`.
- The old book `version` field and whole-document `PUT /api/books/[id]` flow are retired. Use the narrow subresource routes and update only the array/field they own.
- Validate book mutation payloads with `lib/bookMutationValidation.ts`. Include the resolved actor ownership filter in the atomic query and do not overwrite unrelated embedded arrays.

### Prompts, AI, and TTS

- Keep prompt placeholders backward compatible, including mixed casing such as `{background}`, `{currentChapter}`, `{Narrator}`, and `{TextboxInput}`. Preserve `narration2` user-input behavior; check its book-page consumer and `_promptUtil.test.ts` together.
- `/api/ai` returns plain-text chunks when `stream: true` and `{ content }` JSON otherwise. Streaming failures are appended with the sentinel protocol in `lib/streamProtocol.ts`; clients should use `streamAiRequest()` so split sentinels and error envelopes are handled correctly.
- `/api/ai/tts` returns raw audio bytes. Fetch it as a `Blob` through `lib/ttsAudioClient.ts`; preserve its content-type handling and IndexedDB invalidation rules in `lib/ttsIndexedDb.ts`/`lib/ttsConfig.ts`.
- Use `lib/apiError.ts` for route error envelopes. Validate request bodies early and avoid exposing credentials or provider internals in errors/logs.
- Resolve generation credentials through `getActorGenerationSettings()` (account fallback uses `getUserSettingWithFallback()`); unset values fall back to the `keyvalues.defaultValue` document.
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

- Production guest workspace creation is gated by `GUEST_WRITES_ENABLED=true`, transaction-capable MongoDB, encryption/cron secrets, and the trusted IP configuration. Provision indexes and hourly cleanup before enabling it. Preserve pending draft saves via `aistory:before-signin`.
