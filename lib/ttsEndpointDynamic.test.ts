import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDynamicTtsEndpoint } from './ttsEndpointDynamic';
import { pcmToWav, splitSpeechInput } from './ttsPcm';
import { DEFAULT_TTS_CONFIG } from './ttsConfig';

afterEach(() => vi.unstubAllGlobals());
describe('speech synthesis', () => {
  it('preserves the existing Together payload and MIME fallback', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'application/octet-stream' } })); vi.stubGlobal('fetch', fetch);
    const result = await getDynamicTtsEndpoint(DEFAULT_TTS_CONFIG, 'key').generateAudio('Hello');
    expect(result.contentType).toBe('audio/mpeg');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ model: DEFAULT_TTS_CONFIG.model, voice: 'af_nicole', input: 'Hello', response_format: 'mp3', sample_rate: 48000, stream: false });
  });
  it('splits long OpenAI requests and combines sequential PCM responses into one WAV', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([1, 2]))).mockResolvedValueOnce(new Response(new Uint8Array([3, 4]))); vi.stubGlobal('fetch', fetch);
    const input = 'a'.repeat(4095) + ' ' + 'b'.repeat(904);
    const result = await getDynamicTtsEndpoint({ service: 'openAi', model: 'tts-1', voice: 'alloy' }, 'key').generateAudio(input);
    const bodies = fetch.mock.calls.map(call => JSON.parse(call[1].body));
    expect(bodies.map(body => body.input).join('')).toBe(input);
    expect(bodies.every(body => body.input.length <= 4096 && body.response_format === 'pcm' && !('sample_rate' in body))).toBe(true);
    expect(result.contentType).toBe('audio/wav');
    expect(new TextDecoder().decode(result.audioBuffer.slice(0, 4))).toBe('RIFF');
    expect(new DataView(result.audioBuffer).getUint32(24, true)).toBe(24000);
    expect(new Uint8Array(result.audioBuffer).slice(44)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
  it('fails the whole request when a later chunk fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([1, 2]))).mockResolvedValueOnce(new Response('credentials', { status: 429 })));
    await expect(getDynamicTtsEndpoint({ service: 'openAi', model: 'tts-1', voice: 'alloy' }, 'key').generateAudio('x'.repeat(5000))).rejects.toMatchObject({ statusCode: 429 });
  });
  it('prefers sentence boundaries and preserves Unicode and all source text', () => {
    expect(splitSpeechInput('Hello. Next word', 10)).toEqual(['Hello. ', 'Next word']);
    const input = 'a'.repeat(4095) + '\u{1F600}' + 'b'.repeat(900);
    const chunks = splitSpeechInput(input);
    expect(chunks.join('')).toBe(input);
    expect(chunks[0].length).toBe(4095);
    expect(() => pcmToWav([new ArrayBuffer(1)])).toThrow('Invalid PCM');
  });
});
