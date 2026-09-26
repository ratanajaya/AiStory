import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG, ttsCacheConfigId } from '@/lib/ttsConfig';
import { TtsError } from '@/lib/ttsCatalog';

const mocks = vi.hoisted(() => ({ settings: vi.fn(), catalog: vi.fn(), endpoint: vi.fn(), generate: vi.fn(), reserve: vi.fn() }));
vi.mock('@/lib/ttsSettings', () => ({ getTtsSettings: mocks.settings }));
vi.mock('@/lib/ttsCatalog', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/ttsCatalog')>(), fetchTtsModels: mocks.catalog }));
vi.mock('@/lib/ttsEndpointDynamic', () => ({ getDynamicTtsEndpoint: mocks.endpoint }));
vi.mock('@/lib/trial', () => ({ reserveTrial: mocks.reserve }));
import { GET, POST } from './route';

const config = { service: 'openAi' as const, model: 'tts-1', voice: 'alloy' };
const settings = () => ({ selectedTts: DEFAULT_TTS_CONFIG, apiKey: { together: 'together-key', openAi: 'openai-key' }, personal: { together: false, openAi: false }, trialAccount: true });
const post = (body: unknown, scope = '') => POST(new Request(`http://localhost/api/ai/tts${scope}`, { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.settings.mockResolvedValue(settings());
  mocks.catalog.mockResolvedValue([{ id: DEFAULT_TTS_CONFIG.model, voices: [{ id: DEFAULT_TTS_CONFIG.voice }] }, { id: 'tts-1', voices: [{ id: 'alloy' }] }]);
  mocks.reserve.mockResolvedValue({ ok: true });
  mocks.endpoint.mockReturnValue({ generateAudio: mocks.generate });
  mocks.generate.mockResolvedValue({ audioBuffer: new Uint8Array([1, 2]).buffer, contentType: 'audio/wav' });
});

describe('TTS route', () => {
  it('returns effective configuration without credentials', async () => {
    const response = await GET(new Request('http://localhost/api/ai/tts'));
    expect(await response.json()).toEqual({ selectedTts: DEFAULT_TTS_CONFIG, configId: ttsCacheConfigId(DEFAULT_TTS_CONFIG) });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('keeps input-only requests compatible and reserves once for the full text', async () => {
    const response = await post({ input: 'x'.repeat(5000) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/wav');
    expect(mocks.settings).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledExactlyOnceWith(expect.any(Request), 'audio', 5000);
    expect(mocks.endpoint).toHaveBeenCalledWith(DEFAULT_TTS_CONFIG, 'together-key', expect.any(AbortSignal));
  });
  it('previews an override without modifying saved settings', async () => {
    const saved = settings(); mocks.settings.mockResolvedValue(saved);
    await post({ input: 'Hello', selectedTts: config });
    expect(mocks.endpoint).toHaveBeenCalledWith(config, 'openai-key', expect.any(AbortSignal));
    expect(saved.selectedTts).toEqual(DEFAULT_TTS_CONFIG);
  });
  it.each([true, false])('uses only the selected provider personal key for trial bypass (%s)', async personal => {
    mocks.settings.mockResolvedValue({ ...settings(), personal: { together: !personal, openAi: personal } });
    await post({ input: 'Hello', selectedTts: config });
    expect(mocks.reserve).toHaveBeenCalledTimes(personal ? 0 : 1);
  });
  it.each([null, [], { input: '' }, { input: 'x'.repeat(5001) }, { input: 'Hi', selectedTts: { ...config, voice: 'unsupported' } }, { input: 'Hi', selectedTts: [] }])('rejects invalid input before charging %j', async body => {
    expect((await post(body)).status).toBeGreaterThanOrEqual(400);
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON and unauthenticated requests', async () => {
    expect((await POST(new Request('http://localhost/api/ai/tts', { method: 'POST', body: '{' }))).status).toBe(400);
    mocks.settings.mockRejectedValue(new TtsError('Unauthorized', 401));
    expect((await post({ input: 'Hi' })).status).toBe(401);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('rejects depleted allowance and never calls synthesis', async () => {
    mocks.reserve.mockResolvedValue({ ok: false, status: 429, message: 'Trial exhausted' });
    expect((await post({ input: 'Hello' })).status).toBe(429);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('sanitizes upstream credentials and forwards admin scope to authorization', async () => {
    mocks.catalog.mockRejectedValue(Object.assign(new Error('secret provider token'), { statusCode: 401 }));
    const response = await post({ input: 'Hello' }, '?scope=defaults');
    expect(mocks.settings).toHaveBeenCalledWith('defaults');
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('secret provider token');
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
