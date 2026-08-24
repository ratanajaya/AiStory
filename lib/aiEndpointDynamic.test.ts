import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultGenerationProfiles, toAiSdkGenerationOptions } from './generationProfiles';

const mocks = vi.hoisted(() => ({
  getUserSettingWithFallback: vi.fn(),
  createOpenAI: vi.fn(),
  createTogetherAI: vi.fn(),
  createOpenAICompatible: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock('@/auth', () => ({ getUserSettingWithFallback: mocks.getUserSettingWithFallback }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock('@ai-sdk/togetherai', () => ({ createTogetherAI: mocks.createTogetherAI }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: mocks.createOpenAICompatible }));
vi.mock('ai', async (importOriginal) => ({
  ...await importOriginal<typeof import('ai')>(),
  generateText: mocks.generateText,
  streamText: mocks.streamText,
}));

import { getDynamicAiEndpoint } from './aiEndpointDynamic';

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

describe('Together structured output', () => {
  const textModel = { provider: 'togetherai.chat', modelId: 'zai-org/GLM-5.2' };
  const structuredModel = { provider: 'togetherai.chat', modelId: 'zai-org/GLM-5.2' };
  const textProvider = vi.fn(() => textModel);
  const structuredProvider = vi.fn(() => structuredModel);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSettingWithFallback.mockResolvedValue({
      selectedLlm: { service: 'together', model: 'zai-org/GLM-5.2' },
      apiKey: { together: 'test-together-key', openAi: '' },
      generationProfiles: getDefaultGenerationProfiles(),
    });
    mocks.createTogetherAI.mockReturnValue(textProvider);
    mocks.createOpenAICompatible.mockReturnValue(structuredProvider);
  });

  it('uses a JSON-Schema-capable Together model only for object generation', async () => {
    mocks.generateText.mockResolvedValue({ output: { operations: [] } });

    const { endpoint } = await getDynamicAiEndpoint();
    const output = await endpoint.chatObjectFull<{ operations: unknown[] }>(
      'system',
      [{ role: 'user', content: 'content' }],
      getDefaultGenerationProfiles().longTermMemory,
      { type: 'object' },
    );

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: 'togetherai',
      baseURL: 'https://api.together.xyz/v1',
      apiKey: 'test-together-key',
      supportsStructuredOutputs: true,
    });
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: structuredModel,
      maxOutputTokens: 4096,
    }));
    expect(output).toEqual({ operations: [] });
  });

  it('retries a length-truncated object once at 4096 tokens and returns diagnostics if it still fails', async () => {
    const truncatedResult = (outputTokens: number) => {
      const result = {
        finishReason: 'length',
        rawFinishReason: 'length',
        usage: { outputTokens },
        warnings: [],
        text: '{"operations":[',
      };
      Object.defineProperty(result, 'output', {
        get: () => { throw Object.assign(new Error('No output generated.'), { name: 'AI_NoOutputGeneratedError' }); },
      });
      return result;
    };
    mocks.generateText
      .mockResolvedValueOnce(truncatedResult(2000))
      .mockResolvedValueOnce(truncatedResult(4096));

    const { endpoint } = await getDynamicAiEndpoint();
    const error = await endpoint.chatObjectFull(
      null,
      [{ role: 'user', content: 'content' }],
      { temperature: null, maxOutputTokens: 2000, timeoutMs: 120000, maxRetries: 1 },
      { type: 'object' },
    ).catch((caught: unknown) => caught);

    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText.mock.calls.map(([options]) => options.maxOutputTokens)).toEqual([2000, 4096]);
    expect(error).toMatchObject({
      name: 'AiStructuredOutputError',
      details: {
        provider: 'togetherai.chat',
        modelId: 'zai-org/GLM-5.2',
        finishReason: 'length',
        generatedText: '{"operations":[',
        attempts: [
          { attempt: 1, maxOutputTokens: 2000, finishReason: 'length' },
          { attempt: 2, maxOutputTokens: 4096, finishReason: 'length' },
        ],
      },
    });
    expect((error as Error).message).toContain('increase the long-term-memory output limit');
  });
});
