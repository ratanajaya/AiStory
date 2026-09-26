import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, LLMService, Template } from '@/types';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import { getDefaultGenerationProfiles } from '@/lib/generationProfiles';

const mocks = vi.hoisted(() => ({ settings: vi.fn(), generate: vi.fn(), reserve: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: mocks.settings }));
vi.mock('@/lib/guest', () => ({ getActor: async () => ({ kind: 'guest', guestId: 'guest' }) }));
vi.mock('@/lib/trial', () => ({ reserveTrial: mocks.reserve }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: ({ apiKey }: { apiKey: string }) => () => ({ apiKey }) }));
vi.mock('@ai-sdk/togetherai', () => ({ createTogetherAI: ({ apiKey }: { apiKey: string }) => () => ({ apiKey }) }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: ({ apiKey }: { apiKey: string }) => () => ({ apiKey }) }));
vi.mock('ai', async (original) => ({ ...await original<typeof import('ai')>(), generateText: mocks.generate }));

import { generateLongTermMemoryProposal } from '@/lib/bookMemoryGeneration';
import { POST as generateText } from '@/app/api/ai/route';
import { POST as generateAudio } from '@/app/api/ai/tts/route';

function settings(service: LLMService, personal: boolean, trialAccount = true) {
  return {
    selectedLlm: { service, model: 'test-model' },
    apiKey: { together: personal ? 'personal-together' : 'app-together', openAi: personal ? 'personal-openai' : 'app-openai' },
    personal: { together: personal, openAi: personal },
    trialAccount,
    generationProfiles: getDefaultGenerationProfiles(),
  };
}

const memoryBook: Book = {
  bookId: 'book', templateId: 'template', name: null,
  storySegments: Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, day: 0, role: 'assistant', content: 'a'.repeat(20_000) })),
  chapters: [], segmentSummaries: [], longTermMemory: createEmptyLongTermMemoryState(),
};
const memoryOptions = {
  book: memoryBook, template: { storyBackground: 'A city.' } as Template,
  mode: 'full' as const, request: new Request('http://localhost/api/books/book/memory/proposal'),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.reserve.mockResolvedValue({ ok: true });
  mocks.generate.mockResolvedValue({ text: 'OK', output: { operations: [] } });
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe.each(['openAi', 'together'] as const)('%s generation funding', (service) => {
  it.each([false, true])('keeps memory funding stable when a key is added/removed mid-request (personal=%s)', async (personal) => {
    const initial = settings(service, personal);
    mocks.settings.mockResolvedValue(initial);
    mocks.generate.mockImplementation(async () => {
      mocks.settings.mockResolvedValue(settings(service, !personal));
      return { output: { operations: [] } };
    });

    await generateLongTermMemoryProposal(memoryOptions);

    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(mocks.generate.mock.calls.map(([options]) => options.model.apiKey)).toEqual(Array(3).fill(initial.apiKey[service]));
    expect(mocks.reserve).toHaveBeenCalledTimes(personal ? 0 : 3);
    expect(mocks.settings).toHaveBeenCalledTimes(1);
  });

  it('stops memory generation when the next app-funded batch exceeds the allowance', async () => {
    mocks.settings.mockResolvedValue(settings(service, false));
    mocks.reserve.mockResolvedValueOnce({ ok: true }).mockResolvedValue({ ok: false, status: 429, message: 'Trial exhausted' });
    await expect(generateLongTermMemoryProposal(memoryOptions)).rejects.toMatchObject({ status: 429 });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('charges text using the credentials captured for dispatch (personal=%s)', async (personal) => {
    const initial = settings(service, personal);
    mocks.settings.mockResolvedValueOnce(initial).mockResolvedValue(settings(service, !personal));
    const response = await generateText(new Request('http://localhost/api/ai', {
      method: 'POST', body: JSON.stringify({ feature: 'default', stream: false, messages: [{ role: 'user', content: 'Hi' }] }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.generate.mock.calls[0][0].model.apiKey).toBe(initial.apiKey[service]);
    expect(mocks.reserve).toHaveBeenCalledTimes(personal ? 0 : 1);
    expect(mocks.settings).toHaveBeenCalledTimes(1);
  });
});

describe('audio generation funding', () => {
  it.each([
    { together: false, openAi: true, trialAccount: true, charged: true },
    { together: true, openAi: false, trialAccount: true, charged: false },
    { together: false, openAi: false, trialAccount: false, charged: false },
  ])('uses Together funding from the dispatch snapshot (%j)', async ({ together, openAi, trialAccount, charged }) => {
    const initial = { ...settings('openAi', together, trialAccount), personal: { together, openAi } };
    mocks.settings.mockResolvedValueOnce(initial).mockResolvedValue(settings('together', !together));
    const response = await generateAudio(new Request('http://localhost/api/ai/tts', {
      method: 'POST', body: JSON.stringify({ input: 'Hello' }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${initial.apiKey.together}`);
    expect(mocks.reserve).toHaveBeenCalledTimes(charged ? 1 : 0);
    if (charged) expect(mocks.reserve).toHaveBeenCalledWith(expect.any(Request), 'audio', 5);
    expect(mocks.settings).toHaveBeenCalledTimes(1);
  });

  it('rejects an exhausted audio allowance before dispatch', async () => {
    mocks.settings.mockResolvedValue(settings('together', false));
    mocks.reserve.mockResolvedValue({ ok: false, status: 429, message: 'Trial exhausted' });
    const response = await generateAudio(new Request('http://localhost/api/ai/tts', {
      method: 'POST', body: JSON.stringify({ input: 'Hello' }),
    }));
    expect(response.status).toBe(429);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
