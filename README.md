# AiStory — AI-Powered Interactive Story Engine

Full-stack interactive fiction platform with **multi-provider LLM generation**, **real-time streaming narration**, and **AI text-to-speech playback**. Users create prompt templates, generate story segments through conversation with an LLM, organize them into chapters, and listen to AI-narrated audio — all in a single integrated workflow.

## Highlights

- **Multi-LLM Story Generation** — Together AI and OpenAI via unified Vercel AI SDK with real-time token streaming
- **AI Text-to-Speech** — Together AI and OpenAI model/voice selection, sample previews, and IndexedDB caching with automatic invalidation
- **Template-Driven Prompts** — Customizable prompt builders with placeholder substitution for repeatable story workflows
- **Audio Queue Playback** — Sequential narration with intelligent prefetching and chapter-aware playback barriers
- **Multi-Tenant by Design** — Ownership enforced at the database query level; per-user LLM credentials with system-wide fallbacks

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router (React 19 + TypeScript Strict)       │
│  Ant Design 5 · Tailwind CSS v4 · react-resizable-panels    │
└──────────┬──────────────────────┬───────────────────────────┘
           │ REST + Streaming     │ Raw Audio Bytes
┌──────────▼──────────┐  ┌───────▼───────────────────────────┐
│  /api/ai            │  │  /api/ai/tts                      │
│  LLM Chat (stream   │  │  Text-to-Speech synthesis          │
│  or JSON response)  │  │  Returns MP3 or WAV audio          │
└──────────┬──────────┘  └───────┬───────────────────────────┘
           │ Vercel AI SDK       │ Together / OpenAI Speech APIs
┌──────────▼──────────┐  ┌───────▼───────────────────────────┐
│  LLM Providers      │  │  TTS Model                        │
│  Together · OpenAI   │  │  MP3 / WAV · Client IndexedDB     │
│                     │  │  cache                             │
└─────────────────────┘  └───────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  MongoDB (Mongoose 9)                                        │
│  Books · Templates · Users · KeyValues (system defaults)     │
│  NextAuth v5 sessions · Google SSO                           │
└─────────────────────────────────────────────────────────────┘
```

## AI Integration

### Multi-Provider LLM Engine

Two LLM providers wired through Vercel AI SDK, using Together AI and OpenAI models. Selectable per-user with system-wide fallback defaults.

The AI route supports dual response modes — chunked streaming for real-time UI updates during story generation, and synchronous JSON for structured operations like summarization:

```
POST /api/ai
├── stream: true  → ReadableStream (text/plain, chunked transfer)
└── stream: false → JSON { content: string }
```

## Interactive Story Flow

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐    ┌─────────────┐
│  User Input  │───→│ Prompt Build │───→│  LLM Streaming │───→│  Story      │
│  (TextboxIn) │    │  (narr1+2)   │    │  (chunked SSE) │    │  Segments   │
└─────────────┘    └──────────────┘    └────────────────┘    └──────┬──────┘
                                                                    │
                        ┌───────────────────────────────────────────┤
                        ▼                    ▼                      ▼
                 ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
                 │  Summarize  │    │  Enhance     │    │  Wrap into       │
                 │  Segments   │    │  Segment     │    │  Chapters        │
                 └─────────────┘    └──────────────┘    └──────────────────┘
                                                                    │
                                                                    ▼
                                                         ┌──────────────────┐
                                                         │  TTS Audio       │
                                                         │  Playback Queue  │
                                                         └──────────────────┘
```

1. User enters story input via the input panel
2. Prompt builder assembles context from book history, chapter summaries, and template placeholders
3. LLM streams response tokens — UI updates in real-time as chunks arrive
4. Generated text saved as a story segment with optimistic version locking
5. Segments can be enhanced (rewritten by LLM), summarized, or grouped into chapters
6. TTS converts any segment to audio with cached playback

## Tech Stack

**Runtime:** Next.js 16 · React 19 · TypeScript (strict) · Node.js

**AI/LLM:** Vercel AI SDK 6 · @ai-sdk/togetherai · @ai-sdk/openai

**TTS:** Together AI and OpenAI speech APIs · IndexedDB client cache

**Database:** MongoDB · Mongoose 9 · Optimistic version locking

**Auth:** NextAuth v5 (beta) · Google SSO · verified Google registration and guest workspaces

**UI:** Ant Design 5 · Tailwind CSS 4 · react-resizable-panels · react-markdown

**Storage:** Google Cloud Storage (template images) · shortid (ID generation)

**Tooling:** Vitest · ESLint 9 · Vercel Analytics

## Getting Started

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Required: MONGO_URI, MONGO_DB_NAME, GOOGLE_SSO_CLIENT_ID, GOOGLE_SSO_CLIENT_SECRET

# Run development server
npm run dev          # Starts on port 7002

# Run tests
npm test

# Lint
npm run lint

# Production build
npm run build
npm start
```

## Public templates and guest workspaces

Visitors see published templates on the home page. Admins may publish only their own templates. Starting a book from a public template makes a private copy so later edits or unpublishing do not change the book.

Guests can create books and templates, upload up to five template images, generate text, and use audio. Their server-stored workspace expires seven days after creation. Google sign-in claims the workspace; new accounts retain unused trial allowance. A guest or trial account can save a personal Together AI key for text and audio or an OpenAI key for text and audio. Guest keys are encrypted server-side and are never returned by the guest settings API. Provider usage is billed by the provider and remains subject to provider limits.

The app-funded trial allows 20 text calls and 10,000 audio characters per workspace. Guest IPs additionally receive 60 text calls and 30,000 audio characters per UTC day. Personal-key requests do not consume these allowances. The UI warns at four text calls or 2,000 audio characters remaining and links to the key setup guide.

Guest writes and account claims require a transaction-capable MongoDB deployment. Configure `GUEST_KEY_ENCRYPTION_SECRET` with a strong random secret. On Vercel set `TRUSTED_CLIENT_IP_HEADER=x-vercel-forwarded-for`; for other deployments use a header written by a trusted edge proxy. Configure `CRON_SECRET` for the hourly `vercel.json` cleanup job. Run `npm run cleanup:guests` for manual or non-Vercel scheduled cleanup. Do not enable guest writes without the secret, trusted IP source, and hourly cleanup.

Production guest writes also require `GUEST_WRITES_ENABLED=true`. Set this only after the hourly cleanup scheduler is active, the trusted IP header is configured at the ingress, and encryption/cron secrets are provisioned. Workspace creation verifies MongoDB transaction support. Book outline drafts are saved through the narrow `/api/books/[id]/draft` endpoint before sign-in.

Validation helpers: `node scripts/verify-guest-flow.mjs` targets port 7002 with the auth override cleared. `RUN_GUEST_DB_TESTS=true npx vitest run lib/trial.integration.test.ts` checks concurrent reservations against configured MongoDB. Both create isolated test records and remove their own records afterward; neither dispatches real provider calls.

Rollout order: run `node scripts/setup-guest-indexes.mjs`, deploy with guest writes disabled, provision the encryption secret and trusted client IP source, activate hourly cleanup, then set `GUEST_WRITES_ENABLED=true`. Existing templates are private unless explicitly published by their admin owner.

## Speech settings

Choose a speech provider, model, and voice in the account sidebar or guest key/settings dialog, then select **Save voice**. Admins can set global defaults on the Settings page. Preferences apply across books; unset preferences inherit the global default, then Together Kokoro / `af_nicole`. Guest preferences transfer on sign-in only when the account has no saved preference.

**Test voice** previews the displayed fixed sample without saving the selection. Save any API key edits first. Previews use the same audio allowance or selected provider's personal key as narration. Catalogs are fetched on the backend using saved credentials: Together's Voices API supplies models and voices; OpenAI's Models API is filtered to supported speech models with compatible built-in voices. Reload models retries catalog failures.

Narration is generated paragraph by paragraph, with a 2,000-character (JavaScript string length) limit per speech request. Longer paragraphs split at sentence boundaries, then whitespace, then Unicode-safe hard boundaries. OpenAI returns one 24 kHz PCM WAV per request; Together returns MP3. Provider rejections are shown as errors without automatic subdivision. Voice previews still use one request.

Each open book shares a scheduler with two concurrent narration requests. Playback prepares the current part and the next two, starts as soon as the current part is ready, and displays `Part X/Y` with that part's elapsed time. Segment playback ends at the segment boundary; book playback follows story order. **Generate book audio** in the Book Audio panel prepares every nonempty assistant segment without autoplay or the playback prefetch limit. Playback receives scheduling priority. Preparation displays completed/total parts, pauses on the first error, and offers **Retry generation**, which uses current content and saved voice settings while reusing matching cached parts.

Generation belongs to the book view: leaving the book, switching books, reloading, or changing actor ends its jobs and aborts active requests. Returning does not automatically resume. Hiding the Book Audio panel keeps generation running. Stop immediately ends playback intent while already-admitted requests finish and cache their results. Pause retains playback position; saving voice settings affects newly started runs only.

Completed audio remains in IndexedDB. Chunk records match segment ID, exact content, synthesis configuration, and chunking version; different content/voice variants coexist. Valid older whole-segment recordings play as a single cached part without regeneration. Cache hits consume no trial allowance; each uncached part retains the endpoint's atomic quota reservation and existing failure/abort charging behavior. Cache-write failures pause preparation. Existing recordings need no backfill; restart a running development server after the schema update.

`node scripts/verify-tts-flow.mjs` checks local guest persistence, fallback, permissions, and catalogs on port 7002 and removes its isolated test workspace. It requires the configured MongoDB connection and guest setup. Set `TTS_SMOKE_GENERATE=true` to additionally synthesize one sample using app credentials and verify allowance accounting. Add `TTS_SMOKE_PROVIDER=openai` to verify an OpenAI preview override and WAV output. No real synthesis occurs by default.


### Private released books

Release creates or replaces a private reading copy of saved assistant text. Its URL stays stable. Available audio is copied from the current browser cache for the current TTS voice/model; no audio is generated. Releases require an account and survive source edits, deletion, and deactivation. Text-only releases need no audio bucket.

For audio releases, set `GCS_RELEASE_BUCKET_NAME` to a **dedicated private bucket**, distinct from the public template-image bucket. Reuse `GCS_PROJECT_ID` and `GCS_CREDENTIALS` (a service account able to sign V4 URLs). Enable uniform bucket-level access and public access prevention. Grant the service account object read/create/delete permissions and `storage.buckets.get` so the application can verify bucket privacy. Do not grant `allUsers` or `allAuthenticatedUsers` access. Signed uploads expire after 15 minutes, are size-bound and create-only; each release attempt is limited to 100 MiB.

Configure that bucket's CORS for the exact deployed application origin(s), with `PUT` as an allowed method, `Content-Type` as a response header, and a 3600-second max age. Include `http://localhost:7002` only for development. Example CORS configuration:

```json
[{ "origin": ["https://your-app.example"], "method": ["PUT"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600 }]
```

Before rollout, run `npm run setup:releases` to provision the release/attempt indexes. This checks that an audio bucket, when configured, has public access prevention enforced and uniform access enabled. The existing hourly `/api/internal/cleanup` cron also retries cleanup of abandoned and superseded audio after 24 hours; use `npm run cleanup:releases` for manual cleanup. Retain `CRON_SECRET` and hourly scheduling. Published audio is never removed by guest cleanup. A release becomes visible only after every declared upload is verified and the MongoDB transaction commits; account releases require transaction-capable MongoDB, as public-template starts already do.
