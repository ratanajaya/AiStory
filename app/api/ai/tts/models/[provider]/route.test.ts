import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TtsError } from '@/lib/ttsCatalog';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), catalog: vi.fn() }));
vi.mock('@/lib/ttsSettings', () => ({ getTtsSettings: mocks.settings }));
vi.mock('@/lib/ttsCatalog', async original => ({ ...await original<typeof import('@/lib/ttsCatalog')>(), fetchTtsModels: mocks.catalog }));
import { GET } from './route';
const get = (provider = 'openai', scope = '') => GET(new Request(`http://localhost/api/ai/tts/models/${provider}${scope}`), { params: Promise.resolve({ provider }) });
beforeEach(() => { vi.clearAllMocks(); mocks.settings.mockResolvedValue({ apiKey: { openAi: 'secret', together: 'other-secret' } }); mocks.catalog.mockResolvedValue([{ id: 'tts-1', voices: [{ id: 'alloy', label: 'Alloy' }], defaultVoice: 'alloy' }]); });
describe('TTS model routes', () => {
  it('returns only the catalog and disables response caching', async () => {
    const result = await get();
    expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.text()).not.toContain('secret');
    expect(mocks.catalog).toHaveBeenCalledWith('openAi', 'secret', expect.any(AbortSignal));
  });
  it('passes defaults scope through authorization and rejects invalid providers', async () => {
    await get('together', '?scope=defaults'); expect(mocks.settings).toHaveBeenCalledWith('defaults');
    expect((await get('unknown')).status).toBe(400);
    mocks.settings.mockRejectedValue(new TtsError('Forbidden', 403));
    expect((await get('openai', '?scope=defaults')).status).toBe(403);
  });
});
