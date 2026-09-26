# AiStory — AI-Powered Interactive Story Engine

Full-stack interactive fiction platform with **multi-provider LLM generation**, **real-time streaming narration**, and **AI text-to-speech playback**. Users create prompt templates, generate story segments through conversation with an LLM, organize them into chapters, and listen to AI-narrated audio — all in a single integrated workflow.

## Highlights

- **Multi-LLM Story Generation** — Together AI and OpenAI via unified Vercel AI SDK with real-time token streaming
- **AI Text-to-Speech** — Together AI with client-side IndexedDB caching and automatic invalidation
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
│  or JSON response)  │  │  Returns audio/mpeg blob           │
└──────────┬──────────┘  └───────┬───────────────────────────┘
           │ Vercel AI SDK       │ Together AI Audio API
┌──────────▼──────────┐  ┌───────▼───────────────────────────┐
│  LLM Providers      │  │  TTS Model                        │
│  Together · OpenAI   │  │  48 kHz MP3 · Client IndexedDB    │
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

**TTS:** Together AI Audio API · IndexedDB client cache

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

Guests can create books and templates, upload up to five template images, generate text, and use audio. Their server-stored workspace expires seven days after creation. Google sign-in claims the workspace; new accounts retain unused trial allowance. A guest or trial account can save a personal Together AI key for text and audio or an OpenAI key for text. Guest keys are encrypted server-side and are never returned by the guest settings API. Provider usage is billed by the provider and remains subject to provider limits.

The app-funded trial allows 20 text calls and 10,000 audio characters per workspace. Guest IPs additionally receive 60 text calls and 30,000 audio characters per UTC day. Personal-key requests do not consume these allowances. The UI warns at four text calls or 2,000 audio characters remaining and links to the key setup guide.

Guest writes and account claims require a transaction-capable MongoDB deployment. Configure `GUEST_KEY_ENCRYPTION_SECRET` with a strong random secret. On Vercel set `TRUSTED_CLIENT_IP_HEADER=x-vercel-forwarded-for`; for other deployments use a header written by a trusted edge proxy. Configure `CRON_SECRET` for the hourly `vercel.json` cleanup job. Run `npm run cleanup:guests` for manual or non-Vercel scheduled cleanup. Do not enable guest writes without the secret, trusted IP source, and hourly cleanup.

Production guest writes also require `GUEST_WRITES_ENABLED=true`. Set this only after the hourly cleanup scheduler is active, the trusted IP header is configured at the ingress, and encryption/cron secrets are provisioned. Workspace creation verifies MongoDB transaction support. Book outline drafts are saved through the narrow `/api/books/[id]/draft` endpoint before sign-in.

Validation helpers: `node scripts/verify-guest-flow.mjs` targets port 7002 with the auth override cleared. `RUN_GUEST_DB_TESTS=true npx vitest run lib/trial.integration.test.ts` checks concurrent reservations against configured MongoDB. Both create isolated test records and remove their own records afterward; neither dispatches real provider calls.

Rollout order: run `node scripts/setup-guest-indexes.mjs`, deploy with guest writes disabled, provision the encryption secret and trusted client IP source, activate hourly cleanup, then set `GUEST_WRITES_ENABLED=true`. Existing templates are private unless explicitly published by their admin owner.
