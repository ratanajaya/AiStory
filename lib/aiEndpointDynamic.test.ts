import { describe, expect, it } from 'vitest';
import { toAiSdkGenerationOptions } from './generationProfiles';

describe('toAiSdkGenerationOptions', () => {
  it('omits temperature when the profile uses the provider default', () => {
    expect(toAiSdkGenerationOptions({
      temperature: null,
      maxOutputTokens: 600,
      timeoutMs: 60000,
      maxRetries: 1,
    })).toEqual({
      maxOutputTokens: 600,
      timeout: { totalMs: 60000 },
      maxRetries: 1,
    });
  });

  it('passes an explicit supported temperature', () => {
    expect(toAiSdkGenerationOptions({
      temperature: 0.7,
      maxOutputTokens: 1200,
      timeoutMs: 60000,
      maxRetries: 1,
    })).toMatchObject({ temperature: 0.7, maxOutputTokens: 1200 });
  });
});
