import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDynamicTtsEndpoint } from '@/lib/ttsEndpointDynamic';
import { pcmToWav } from '@/lib/ttsPcm';
import { DEFAULT_TTS_CONFIG } from '@/lib/ttsConfig';

afterEach(() => vi.unstubAllGlobals());
describe('single-chunk speech synthesis', () => {
  it('preserves Together payload and MIME fallback', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'application/octet-stream' } })); vi.stubGlobal('fetch', fetch);
    const result = await getDynamicTtsEndpoint(DEFAULT_TTS_CONFIG, 'key').generateAudio('Hello');
    expect(result.contentType).toBe('audio/mpeg');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ model: DEFAULT_TTS_CONFIG.model, voice: 'af_nicole', input: 'Hello', response_format: 'mp3', sample_rate: 48000, stream: false });
  });
  it('makes one OpenAI request and wraps its PCM as WAV', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]))); vi.stubGlobal('fetch', fetch);
    const result = await getDynamicTtsEndpoint({ service: 'openAi', model: 'tts-1', voice: 'alloy' }, 'key').generateAudio('x'.repeat(2000));
    expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ model: 'tts-1', voice: 'alloy', input: 'x'.repeat(2000), response_format: 'pcm' });
    expect(result.contentType).toBe('audio/wav');
    expect(new TextDecoder().decode(result.audioBuffer.slice(0, 4))).toBe('RIFF');
    expect(new DataView(result.audioBuffer).getUint32(24, true)).toBe(24000);
    expect(new Uint8Array(result.audioBuffer).slice(44)).toEqual(new Uint8Array([1, 2]));
  });
  it('surfaces provider rejection without retrying or subdividing', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('private provider detail', { status: 400 })); vi.stubGlobal('fetch', fetch);
    await expect(getDynamicTtsEndpoint({ service: 'openAi', model: 'gpt-4o-mini-tts', voice: 'coral' }, 'key').generateAudio('x'.repeat(2000))).rejects.toMatchObject({ statusCode: 400 });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('forwards book disposal to the provider request', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason));
    })); vi.stubGlobal('fetch', fetch);
    const result = getDynamicTtsEndpoint(DEFAULT_TTS_CONFIG, 'key', controller.signal).generateAudio('Hello');
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('rejects invalid PCM', () => { expect(() => pcmToWav([new ArrayBuffer(1)])).toThrow('Invalid PCM'); });
});
