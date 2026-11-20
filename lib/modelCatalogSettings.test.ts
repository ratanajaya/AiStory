import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getModelCatalogApiKey } from '@/lib/modelCatalogSettings';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), guest: vi.fn(), settings: vi.fn(), defaults: vi.fn() }));
vi.mock('@/auth', () => ({ getUserSettingWithFallback: mocks.settings }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, guestSettings: mocks.guest }));
vi.mock('@/models', () => ({ KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
const request = (body: object) => new Request('http://localhost/api/ai/models/provider', {
  method: 'POST', body: JSON.stringify(body),
});

describe.each(['openAi', 'together', 'refuseless'] as const)('%s catalog credentials', service => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: false });
    mocks.settings.mockResolvedValue({ apiKey: { [service]: 'personal-key' } });
    mocks.defaults.mockResolvedValue({ value: { apiKey: { [service]: ' global-key ' } } });
  });

  it('uses saved effective credentials when a key is omitted', async () => {
    expect(await getModelCatalogApiKey(request({}), service)).toBe('personal-key');
    expect(mocks.defaults).not.toHaveBeenCalled();
  });

  it('uses a candidate key without reading saved credentials', async () => {
    expect(await getModelCatalogApiKey(request({ apiKey: ' entered-key ' }), service)).toBe('entered-key');
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.defaults).not.toHaveBeenCalled();
  });

  it('previews a cleared personal key using the global key', async () => {
    expect(await getModelCatalogApiKey(request({ apiKey: null }), service)).toBe('global-key');
    expect(mocks.settings).not.toHaveBeenCalled();
  });

  it('previews a cleared global key without using saved or personal credentials', async () => {
    mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: true });
    expect(await getModelCatalogApiKey(request({ apiKey: null, scope: 'defaults' }), service)).toBe('');
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.defaults).not.toHaveBeenCalled();
  });

  it('rejects a non-admin default scope even with a submitted key', async () => {
    const response = await getModelCatalogApiKey(request({ apiKey: 'entered-key', scope: 'defaults' }), service);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(403);
  });

  it('does not expose or override guest credentials', async () => {
    mocks.actor.mockResolvedValue({ kind: 'guest', isAdmin: false });
    mocks.guest.mockResolvedValue({ apiKey: { [service]: 'guest-key' } });
    expect(await getModelCatalogApiKey(request({ apiKey: null }), service)).toBe('guest-key');
    expect(mocks.defaults).not.toHaveBeenCalled();
  });
});
