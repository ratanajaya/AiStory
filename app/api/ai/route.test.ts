import { describe, expect, it, vi } from 'vitest';
import { getDefaultGenerationProfiles } from '@/lib/generationProfiles';

const mocks = vi.hoisted(() => ({ getDynamicAiEndpoint: vi.fn() }));
vi.mock('@/lib/aiEndpointDynamic', () => ({ getDynamicAiEndpoint: mocks.getDynamicAiEndpoint }));

import { POST } from './route';

describe('POST /api/ai stream metadata', () => {
  it('returns the resolved provider and model in headers while keeping plain-text chunks', async () => {
    mocks.getDynamicAiEndpoint.mockResolvedValue({
      endpoint: {
        chatStreamFull: vi.fn(async (
          _system: unknown,
          _messages: unknown,
          _profile: unknown,
          onChunk: (chunk: string) => void,
        ) => {
          onChunk('First ');
          onChunk('part');
        }),
      },
      generationProfiles: getDefaultGenerationProfiles(),
      selectedLlm: { service: 'together', model: 'org/model-v2' },
    });

    const response = await POST(new Request('http://localhost/api/ai', {
      method: 'POST',
      body: JSON.stringify({ feature: 'narration', messages: [{ role: 'user', content: 'Write' }] }),
    }));

    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('X-AI-Service')).toBe('together');
    expect(decodeURIComponent(response.headers.get('X-AI-Model') ?? '')).toBe('org/model-v2');
    expect(await response.text()).toBe('First part');
  });
});
