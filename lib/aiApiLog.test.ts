import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@/utils/_ls', () => ({
  default: {
    keys: { aiApiLogs: 'ai-story:ai-api-logs' },
    load: <T>(key: string) => {
      const value = storage.get(key);
      return value ? JSON.parse(value) as T : undefined;
    },
    set: (key: string, value: unknown) => storage.set(key, JSON.stringify(value)),
    remove: (key: string) => storage.delete(key),
  },
}));

import {
  AI_API_LOG_LIMIT,
  AI_API_LOG_RESPONSE_PREVIEW_LIMIT,
  appendAiApiLog,
  clearAiApiLogs,
  createAiApiLogDownload,
  getAiApiLogResponsePreview,
  loadAiApiLogs,
} from './aiApiLog';
import type { AiApiLogEntry } from '@/types';

const createEntry = (overrides: Partial<AiApiLogEntry> = {}): AiApiLogEntry => ({
  id: 'log-1',
  createdAt: Date.UTC(2026, 6, 31, 12, 34, 56, 789),
  kind: 'llm',
  status: 'success',
  feature: 'Narration',
  durationMs: 10,
  payload: { messages: [{ role: 'user', content: 'Hello' }] },
  response: { content: 'Hi' },
  ...overrides,
});

describe('aiApiLog', () => {
  beforeEach(() => clearAiApiLogs());

  it('stores LLM and TTS entries with flexible request and response data', () => {
    appendAiApiLog({
      kind: 'llm', status: 'success', feature: 'Narration', durationMs: 10,
      payload: { messages: [{ role: 'user', content: 'Hello' }] }, response: { content: 'Hi' },
    });
    appendAiApiLog({
      kind: 'tts', status: 'error', feature: 'TTS playback', durationMs: 20,
      payload: { input: 'Hello' }, error: { message: 'Failed' },
    });

    expect(loadAiApiLogs()).toHaveLength(2);
    expect(loadAiApiLogs().map((entry) => entry.kind)).toEqual(['tts', 'llm']);
  });

  it('keeps only the newest configured number of entries', () => {
    for (let index = 0; index < AI_API_LOG_LIMIT + 1; index += 1) {
      appendAiApiLog({
        id: `${index}`, createdAt: index, kind: 'llm', status: 'success', feature: 'Narration',
        durationMs: 0, payload: { index },
      });
    }

    const entries = loadAiApiLogs();
    expect(entries).toHaveLength(AI_API_LOG_LIMIT);
    expect(entries[0].id).toBe(`${AI_API_LOG_LIMIT}`);
    expect(entries.at(-1)?.id).toBe('1');
  });

  it('ignores malformed stored values', () => {
    storage.set('ai-story:ai-api-logs', JSON.stringify([{ invalid: true }]));
    expect(loadAiApiLogs()).toEqual([]);
  });

  it('returns a normalized and short text response preview', () => {
    expect(getAiApiLogResponsePreview(createEntry({ response: { content: '  Hello\n\nthere  ' } }))).toBe('Hello there');
    expect(getAiApiLogResponsePreview(createEntry({ response: { content: '   \n\t ' } }))).toBeNull();
    expect(getAiApiLogResponsePreview(createEntry({ response: { byteSize: 10 } }))).toBeNull();
    expect(getAiApiLogResponsePreview(createEntry({ status: 'error', response: { content: 'Hidden' } }))).toBeNull();

    const preview = getAiApiLogResponsePreview(createEntry({ response: { content: 'a'.repeat(AI_API_LOG_RESPONSE_PREVIEW_LIMIT + 1) } }));
    expect(preview).toHaveLength(AI_API_LOG_RESPONSE_PREVIEW_LIMIT);
    expect(preview).toBe(`${'a'.repeat(AI_API_LOG_RESPONSE_PREVIEW_LIMIT - 1)}…`);
  });

  it('creates a timestamped JSON download containing complete LLM call data', () => {
    const download = createAiApiLogDownload(createEntry({
      feature: 'Chapter summarizer!',
      bookId: 'book-1',
      bookName: 'My Book',
      httpStatus: 200,
      error: { message: 'No error, retained for completeness' },
    }));

    expect(download.filename).toBe('ai-api-log-chapter-summarizer-2026-07-31T12-34-56-789Z.json');
    expect(JSON.parse(download.content)).toEqual({
      id: 'log-1',
      createdAt: Date.UTC(2026, 6, 31, 12, 34, 56, 789),
      kind: 'llm',
      status: 'success',
      feature: 'Chapter summarizer!',
      bookId: 'book-1',
      bookName: 'My Book',
      httpStatus: 200,
      durationMs: 10,
      payload: { messages: [{ role: 'user', content: 'Hello' }] },
      response: { content: 'Hi' },
      error: { message: 'No error, retained for completeness' },
    });
  });

  it('preserves failed-call payload and error data in downloads', () => {
    const download = createAiApiLogDownload(createEntry({
      status: 'error',
      response: undefined,
      error: { message: 'Provider failed' },
    }));

    expect(JSON.parse(download.content)).toMatchObject({
      status: 'error',
      payload: { messages: [{ role: 'user', content: 'Hello' }] },
      error: { message: 'Provider failed' },
    });
    expect(JSON.parse(download.content)).not.toHaveProperty('response');
  });
});
