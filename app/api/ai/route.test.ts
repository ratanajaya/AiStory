import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultGenerationProfiles } from '@/lib/generationProfiles';

const mocks = vi.hoisted(() => ({ getDynamicAiEndpoint: vi.fn(), settings: vi.fn(), reserve: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: async () => ({ kind: 'user', ownerEmail: 'test@example.com' }) }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: mocks.settings }));
vi.mock('@/lib/trial', () => ({ reserveTrial: mocks.reserve }));
vi.mock('@/lib/aiEndpointDynamic', () => ({ getDynamicAiEndpoint: mocks.getDynamicAiEndpoint }));

import { POST } from './route';

describe('POST /api/ai stream metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.mockResolvedValue({ selectedLlm: { service: 'together', model: 'org/model-v2' }, personal: { together: true, openAi: true }, trialAccount: true });
    mocks.reserve.mockResolvedValue({ ok: true });
    mocks.getDynamicAiEndpoint.mockResolvedValue({ endpoint: { chatCompletionFull: vi.fn(async () => 'OK') }, generationProfiles: getDefaultGenerationProfiles(), selectedLlm: { service: 'together', model: 'org/model-v2' } });
  });
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

  it('does not charge the trial when a personal key funds the selected provider', async () => {
    mocks.getDynamicAiEndpoint.mockResolvedValue({ endpoint: { chatCompletionFull: async () => 'OK' }, generationProfiles: getDefaultGenerationProfiles(), selectedLlm: { service: 'together', model: 'org/model-v2' } });
    const response = await POST(new Request('http://localhost/api/ai', { method: 'POST', body: JSON.stringify({ feature: 'default', stream: false, messages: [{ role: 'user', content: 'Hi' }] }) }));
    expect(response.status).toBe(200);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it('rejects an exhausted trial before invoking the provider', async () => {
    mocks.settings.mockResolvedValue({ selectedLlm: { service: 'together', model: 'org/model-v2' }, personal: { together: false, openAi: false }, trialAccount: true });
    mocks.reserve.mockResolvedValue({ ok: false, status: 429, message: 'Free trial exhausted. Add your own API key to continue.' });
    const response = await POST(new Request('http://localhost/api/ai', { method: 'POST', body: JSON.stringify({ feature: 'default', stream: false, messages: [{ role: 'user', content: 'Hi' }] }) }));
    expect(response.status).toBe(429);
    expect((await mocks.getDynamicAiEndpoint.mock.results[0].value).endpoint.chatCompletionFull).not.toHaveBeenCalled();
  });
});
