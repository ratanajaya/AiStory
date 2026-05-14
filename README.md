# AiStory — AI-Powered Interactive Story Engine

Full-stack interactive fiction platform with **multi-provider LLM generation**, **real-time streaming narration**, and **AI text-to-speech playback**. Users create prompt templates, generate story segments through conversation with an LLM, organize them into chapters, and listen to AI-narrated audio — all in a single integrated workflow.

## Highlights

- **Multi-LLM Story Generation** — Mistral and Together AI via unified Vercel AI SDK with real-time token streaming
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
│  Mistral · Together  │  │  48 kHz MP3 · Client IndexedDB    │
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

Two LLM providers wired through Vercel AI SDK, using the most advanced models from Mistral and Together AI. Selectable per-user with system-wide fallback defaults.

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

**AI/LLM:** Vercel AI SDK 6 · @ai-sdk/mistral · @ai-sdk/togetherai

**TTS:** Together AI Audio API · IndexedDB client cache

**Database:** MongoDB · Mongoose 9 · Optimistic version locking

**Auth:** NextAuth v5 (beta) · Google SSO · Invite-only user allowlist

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
