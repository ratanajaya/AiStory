import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG, ttsCacheConfigId } from '@/lib/ttsConfig';
beforeEach(() => { vi.resetModules(); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
const attempt = { attemptId: 'a', title: 'Story', replacing: false, selectedTts: DEFAULT_TTS_CONFIG, segments: [{ id: 's', content: 'First.\n\nSecond.', expectedAudioParts: 2, audio: [] }] };
it('preserves partial current chunks in order and never generates missing audio', async () => {
  const { planTtsParts } = await import('@/lib/ttsChunkClient'); const db = await import('@/lib/ttsIndexedDb');
  const parts = await planTtsParts(attempt.segments, attempt.selectedTts, new AbortController().signal);
  const part = parts[1];
  await db.saveChunkAudio({ cacheKey: part.key, chunkVersion: 'paragraph-v1', segmentId: part.segmentId, content: part.content, configId: part.configId, mimeType: 'audio/mpeg', audioBlob: new Blob(['audio']), updatedAt: 1 });
  const { collectReleaseAudio } = await import('@/lib/releaseAudioClient');
  const result = await collectReleaseAudio(attempt, new AbortController().signal);
  expect(result.expectedParts).toBe(2); expect(result.files).toHaveLength(1); expect(result.files[0].manifest).toMatchObject({ partIndex: 1, whole: false });
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps valid whole recordings and skips changed text, voice, and empty recordings', async () => {
  const db = await import('@/lib/ttsIndexedDb'); const { collectReleaseAudio } = await import('@/lib/releaseAudioClient');
  const record = { segmentId: 's', content: attempt.segments[0].content, configId: ttsCacheConfigId(DEFAULT_TTS_CONFIG), mimeType: 'audio/wav', audioBlob: new Blob(['RIFFrecord']), updatedAt: 1 };
  await db.saveSegmentAudio(record);
  const result = await collectReleaseAudio(attempt, new AbortController().signal);
  expect(result.expectedParts).toBe(1); expect(result.files[0].manifest.whole).toBe(true);
  for (const altered of [{ ...record, content: 'old' }, { ...record, configId: 'different-voice' }, { ...record, audioBlob: new Blob([]) }]) {
    await db.saveSegmentAudio(altered); expect((await collectReleaseAudio(attempt, new AbortController().signal)).files).toEqual([]);
  }
  expect(fetch).not.toHaveBeenCalled();
});
