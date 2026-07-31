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

import { AI_API_LOG_LIMIT, appendAiApiLog, clearAiApiLogs, loadAiApiLogs } from './aiApiLog';

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
});
