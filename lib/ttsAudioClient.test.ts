import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestTtsAudio, formatAudioTime } from '@/lib/ttsAudioClient';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';

afterEach(() => vi.unstubAllGlobals());
describe('binary audio client', () => {
  it('preserves MIME type, config, scope and cancellation signal', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Blob(['audio']), { headers: { 'Content-Type': 'audio/wav' } })); vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    const result = await requestTtsAudio('Hello', DEFAULT_TTS_CONFIG, { signal, scope: 'defaults' });
    expect(result.mimeType).toBe('audio/wav'); expect(result.audioBlob.size).toBe(5);
    expect(fetch).toHaveBeenCalledWith('/api/ai/tts?scope=defaults', expect.objectContaining({ signal, body: JSON.stringify({ input: 'Hello', selectedTts: DEFAULT_TTS_CONFIG }) }));
  });
  it('uses MP3 fallback and rejects empty audio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(new Blob(['audio']))).mockResolvedValueOnce(new Response(new Blob([]))));
    expect((await requestTtsAudio('Hi', DEFAULT_TTS_CONFIG)).mimeType).toBe('audio/mpeg');
    await expect(requestTtsAudio('Hi', DEFAULT_TTS_CONFIG)).rejects.toThrow('No audio');
  });
  it('preserves an error status and message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'Trial exhausted' } }, { status: 429 })));
    await expect(requestTtsAudio('Hi', DEFAULT_TTS_CONFIG)).rejects.toMatchObject({ message: 'Trial exhausted', statusCode: 429 });
  });
  it('formats elapsed time', () => { expect(formatAudioTime(125.9)).toBe('2:05'); expect(formatAudioTime(-5)).toBe('0:00'); });
});
