import { describe, expect, it } from 'vitest';
import {
  getDefaultGenerationProfiles,
  isAiGenerationFeature,
  normalizeGenerationProfileConfig,
  validateGenerationProfileConfig,
} from './generationProfiles';

describe('generationProfiles', () => {
  it('provides independent global defaults for every feature', () => {
    const first = getDefaultGenerationProfiles();
    const second = getDefaultGenerationProfiles();

    expect(first.narration).toEqual({
      temperature: null,
      maxOutputTokens: 1200,
      timeoutMs: 60000,
      maxRetries: 1,
    });
    expect(first).not.toBe(second);
    expect(first.narration).not.toBe(second.narration);
    expect(first.longTermMemory).toEqual({
      temperature: null,
      maxOutputTokens: 4096,
      timeoutMs: 120000,
      maxRetries: 1,
    });
  });

  it('recognizes supported request features only', () => {
    expect(isAiGenerationFeature('narration')).toBe(true);
    expect(isAiGenerationFeature('default')).toBe(true);
    expect(isAiGenerationFeature('longTermMemory')).toBe(true);
    expect(isAiGenerationFeature('unknown')).toBe(false);
  });

  it('uses defaults when legacy configuration has no profiles', () => {
    expect(normalizeGenerationProfileConfig(null)).toEqual(getDefaultGenerationProfiles());
    expect(validateGenerationProfileConfig(undefined)).toEqual({
      ok: true,
      value: getDefaultGenerationProfiles(),
    });
  });

  it('rejects invalid persisted settings payloads', () => {
    const profiles = getDefaultGenerationProfiles();
    expect(validateGenerationProfileConfig({ ...profiles, narration: { ...profiles.narration, temperature: 3 } }))
      .toEqual({
        ok: false,
        message: "Generation profile 'narration' temperature must be null or a number from 0 to 2.",
      });
    expect(validateGenerationProfileConfig({ ...profiles, enhancer: { ...profiles.enhancer, maxRetries: 3 } }))
      .toEqual({
        ok: false,
        message: "Generation profile 'enhancer' maxRetries must be an integer from 0 to 2.",
      });
  });
});
