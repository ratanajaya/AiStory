import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTS_CONFIG } from './ttsConfig';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), settings: vi.fn(), defaults: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: mocks.settings }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/models', () => ({ KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
import { getTtsSettings } from './ttsSettings';

beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: false }); });
describe('TTS credential scopes', () => {
  it('denies visitors and non-admin access to global credentials', async () => {
    await expect(getTtsSettings('defaults')).rejects.toMatchObject({ status: 403 });
    mocks.actor.mockResolvedValue(null);
    await expect(getTtsSettings()).rejects.toMatchObject({ status: 401 });
    expect(mocks.defaults).not.toHaveBeenCalled();
  });
  it('uses actor settings for both accounts and guests', async () => {
    mocks.actor.mockResolvedValue({ kind: 'guest', isAdmin: false });
    mocks.settings.mockResolvedValue({ selectedTts: DEFAULT_TTS_CONFIG });
    expect(await getTtsSettings()).toEqual({ selectedTts: DEFAULT_TTS_CONFIG });
    expect(mocks.settings).toHaveBeenCalledOnce();
  });
  it('uses saved global credentials for admin previews', async () => {
    mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: true });
    mocks.defaults.mockResolvedValue({ value: { apiKey: { openAi: 'global-key' } } });
    const result = await getTtsSettings('defaults');
    expect(result.apiKey.openAi).toBe('global-key'); expect(result.selectedTts).toEqual(DEFAULT_TTS_CONFIG);
    expect(result.trialAccount).toBe(false); expect(mocks.settings).not.toHaveBeenCalled();
  });
});
