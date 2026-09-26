import { describe, expect, it } from 'vitest';
import { DEFAULT_TTS_CONFIG, resolveTtsConfig, ttsCacheConfigId, validateTtsConfig } from './ttsConfig';

describe('TTS configuration', () => {
  const openAi = { service: 'openAi' as const, model: 'tts-1', voice: 'nova' };
  it('resolves complete actor preferences, then defaults, then legacy settings', () => {
    expect(resolveTtsConfig(openAi, DEFAULT_TTS_CONFIG)).toEqual(openAi);
    expect(resolveTtsConfig({ service: 'openAi', model: ' ', voice: 'nova' }, DEFAULT_TTS_CONFIG)).toEqual(DEFAULT_TTS_CONFIG);
    expect(resolveTtsConfig(null, openAi)).toEqual(openAi);
    expect(resolveTtsConfig(undefined, null)).toEqual(DEFAULT_TTS_CONFIG);
    expect(validateTtsConfig({ service: ' ', model: ' ', voice: '' })).toEqual({ ok: true, value: null });
    expect(validateTtsConfig({ ...openAi, model: ' tts-1 ' })).toEqual({ ok: true, value: openAi });
  });
  it.each([[], 3, { service: 3 }, { ...openAi, voice: 2 }, { ...openAi, model: '' }, { ...openAi, service: 'unknown' }])('rejects malformed preferences %j', input => {
    expect(validateTtsConfig(input).ok).toBe(false);
  });
  it('includes provider, model and voice in the cache identity', () => {
    const variants = [DEFAULT_TTS_CONFIG, openAi, { ...openAi, voice: 'alloy' }, { ...openAi, model: 'tts-1-hd' }];
    expect(new Set(variants.map(ttsCacheConfigId)).size).toBe(4);
  });
});
