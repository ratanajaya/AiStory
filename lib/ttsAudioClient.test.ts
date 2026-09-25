import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TTS_CACHE_CONFIG_ID } from './ttsConfig';
import type { SegmentAudioRecord } from './ttsIndexedDb';

const mocks = vi.hoisted(() => ({
  getSegmentAudio: vi.fn(),
  deleteSegmentAudio: vi.fn(),
  saveSegmentAudio: vi.fn(),
  appendAiApiLog: vi.fn(),
}));

vi.mock('./ttsIndexedDb', async (importOriginal) => ({
  ...await importOriginal<typeof import('./ttsIndexedDb')>(),
  getSegmentAudio: mocks.getSegmentAudio,
  deleteSegmentAudio: mocks.deleteSegmentAudio,
  saveSegmentAudio: mocks.saveSegmentAudio,
}));
vi.mock('./aiApiLog', async (importOriginal) => ({
  ...await importOriginal<typeof import('./aiApiLog')>(),
  appendAiApiLog: mocks.appendAiApiLog,
}));

import { ensureSegmentAudioBlob, formatAudioTime } from './ttsAudioClient';

const cachedRecord = (overrides: Partial<SegmentAudioRecord> = {}): SegmentAudioRecord => ({
  segmentId: 'segment-1',
  content: 'Read this',
  mimeType: 'audio/mpeg',
  configId: TTS_CACHE_CONFIG_ID,
  audioBlob: new Blob(['cached'], { type: 'audio/mpeg' }),
  updatedAt: 1,
  ...overrides,
});

describe('ensureSegmentAudioBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSegmentAudio.mockResolvedValue(null);
    mocks.deleteSegmentAudio.mockResolvedValue(undefined);
    mocks.saveSegmentAudio.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reuses audio only when both the content and synthesis config match', async () => {
    const cached = cachedRecord();
    mocks.getSegmentAudio.mockResolvedValue(cached);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await ensureSegmentAudioBlob('segment-1', 'Read this')).toBe(cached.audioBlob);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.deleteSegmentAudio).not.toHaveBeenCalled();
    expect(mocks.saveSegmentAudio).not.toHaveBeenCalled();
  });

  it.each([
    ['changed content', { content: 'Old text' }],
    ['changed synthesis config', { configId: 'old-model|old-voice' }],
  ])('invalidates %s before fetching fresh audio', async (_reason, override) => {
    mocks.getSegmentAudio.mockResolvedValue(cachedRecord(override));
    const responseBlob = new Blob(['new audio'], { type: 'audio/wav' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBlob, {
      headers: { 'Content-Type': 'audio/wav' },
    })));

    const result = await ensureSegmentAudioBlob('segment-1', 'Read this', { feature: 'TTS playback' });

    expect(result).toEqual(responseBlob);
    expect(mocks.deleteSegmentAudio).toHaveBeenCalledWith('segment-1');
    expect(fetch).toHaveBeenCalledWith('/api/ai/tts', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ input: 'Read this' }),
    }));
    expect(mocks.saveSegmentAudio).toHaveBeenCalledWith(expect.objectContaining({
      segmentId: 'segment-1', content: 'Read this', configId: TTS_CACHE_CONFIG_ID,
      mimeType: 'audio/wav', audioBlob: expect.any(Blob),
    }));
    expect(mocks.appendAiApiLog).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'tts', status: 'success', httpStatus: 200,
      audio: expect.objectContaining({ mimeType: 'audio/wav', byteSize: responseBlob.size }),
    }));
  });

  it('uses the MP3 MIME fallback if the server omits Content-Type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['audio']))));

    await ensureSegmentAudioBlob('segment-1', 'Read this');

    expect(mocks.saveSegmentAudio).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/mpeg' }));
  });

  it('surfaces a JSON error without caching audio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Speech unavailable' }, { status: 503 })));

    await expect(ensureSegmentAudioBlob('segment-1', 'Read this', { feature: 'TTS playback' }))
      .rejects.toThrow('Speech unavailable');
    expect(mocks.saveSegmentAudio).not.toHaveBeenCalled();
    expect(mocks.appendAiApiLog).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'tts', status: 'error', httpStatus: 503,
    }));
  });
});

describe('formatAudioTime', () => {
  it('floors fractional seconds and clamps negative times', () => {
    expect(formatAudioTime(125.9)).toBe('2:05');
    expect(formatAudioTime(-5)).toBe('0:00');
  });
});
