import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTtsModels, normalizeOpenAiTtsModels, normalizeTogetherTtsModels } from './ttsCatalog';

afterEach(() => vi.unstubAllGlobals());
describe('TTS catalogs', () => {
  it('filters OpenAI speech models and restricts legacy voices', () => {
    const models = normalizeOpenAiTtsModels({ data: ['tts-1', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'gpt-4o', 'whisper-1', 'tts-1', null].map(id => ({ id })) });
    expect(models.map(model => model.id)).toEqual(['tts-1', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15']);
    expect(models[0].voices.some(voice => voice.id === 'marin')).toBe(false);
    expect(models[1].voices.some(voice => voice.id === 'marin')).toBe(true);
  });
  it('uses Together IDs for synthesis, names for labels, and ignores invalid records', () => {
    expect(normalizeTogetherTtsModels({ data: [null, {}, { model: 'empty', voices: [] },
      { model: 'cartesia/sonic', voices: [{ id: 'uuid', name: 'Narrator' }, { id: 'uuid', name: 'Narrator' }, {}] },
      { model: 'hexgrad/Kokoro-82M', voices: [{ name: 'af_heart' }, { name: 'af_nicole' }] },
    ] })).toEqual([
      { id: 'cartesia/sonic', label: 'cartesia/sonic', voices: [{ id: 'uuid', label: 'Narrator' }], defaultVoice: 'uuid' },
      { id: 'hexgrad/Kokoro-82M', label: 'hexgrad/Kokoro-82M', voices: [{ id: 'af_heart', label: 'af_heart' }, { id: 'af_nicole', label: 'af_nicole' }], defaultVoice: 'af_nicole' },
    ]);
  });
  it('requires credentials and never exposes upstream error bodies', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('secret upstream body', { status: 401 })); vi.stubGlobal('fetch', fetch);
    await expect(fetchTtsModels('openAi', ' ')).rejects.toThrow('not configured');
    expect(fetch).not.toHaveBeenCalled();
    await expect(fetchTtsModels('openAi', 'key')).rejects.toMatchObject({ message: 'TTS catalog request failed', statusCode: 401 });
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ cache: 'no-store', headers: { Authorization: 'Bearer key' } }));
  });
});
