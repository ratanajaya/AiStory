import { describe, expect, it } from 'vitest';
import { formatErrorDetail, getErrorEnvelope } from './errorClient';

describe('client error details', () => {
  it('preserves diagnostics, nested causes, and provider stacks', () => {
    const error = {
      statusCode: 502,
      envelope: {
        name: 'MemoryGenerationError',
        message: 'AI memory patch generation failed for source batch 1/1.',
        details: { batch: 1 },
        cause: {
          name: 'AiStructuredOutputError',
          message: 'No output generated.',
          details: {
            provider: 'togetherai.chat',
            modelId: 'zai-org/GLM-5.2',
            finishReason: 'length',
            usage: { outputTokens: 4096 },
          },
          stack: 'AiStructuredOutputError: No output generated.\n    at chatObjectFull',
        },
      },
    };

    const detail = formatErrorDetail(getErrorEnvelope(error));

    expect(detail).toContain('MemoryGenerationError');
    expect(detail).toContain('AiStructuredOutputError');
    expect(detail).toContain('zai-org/GLM-5.2');
    expect(detail).toContain('"finishReason": "length"');
    expect(detail).toContain('"outputTokens": 4096');
    expect(detail).toContain('at chatObjectFull');
  });
});
