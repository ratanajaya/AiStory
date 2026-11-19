import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), guest: vi.fn(), settings: vi.fn(), defaults: vi.fn(), fetch: vi.fn<typeof fetch>(),
}));
vi.mock('@/auth', () => ({ getUserSettingWithFallback: mocks.settings }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, guestSettings: mocks.guest }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ KeyValueModel: { findOne: () => ({ lean: mocks.defaults }) } }));
import { POST } from './route';

const list = (body: object = {}) => POST(new Request('http://localhost/api/ai/models/refuseless', {
  method: 'POST', body: JSON.stringify(body),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: false });
  mocks.settings.mockResolvedValue({ apiKey: {} });
  mocks.fetch.mockImplementation(async () => Response.json({ data: [
    { id: 'deepseek-v4.1-flash-fast', context_length: 1_048_576, pricing: { input_per_m: 1 } },
    { id: 'private-model' },
    { id: ' ' },
  ] }));
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it('loads the public lineup for an account without a configured key', async () => {
  const response = await list();
  expect(await response.json()).toEqual({ models: [
    { id: 'deepseek-v4.1-flash-fast', label: 'deepseek-v4.1-flash-fast', contextLength: 1_048_576 },
    { id: 'private-model', label: 'private-model', contextLength: null },
  ] });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.fetch).toHaveBeenCalledWith('https://api.refuseless.com/v1/models', expect.objectContaining({ headers: undefined, signal: expect.any(AbortSignal) }));
});

it('uses the submitted key for an account and the stored key for a guest', async () => {
  expect((await list({ apiKey: ' candidate-key ' })).status).toBe(200);
  expect(mocks.fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer candidate-key' });
  expect(mocks.settings).not.toHaveBeenCalled();

  mocks.actor.mockResolvedValue({ kind: 'guest', isAdmin: false });
  mocks.guest.mockResolvedValue({ apiKey: { refuseless: 'guest-key' } });
  expect((await list({ apiKey: 'ignored' })).status).toBe(200);
  expect(mocks.fetch.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer guest-key' });
});

it('limits the default catalog to admins and dispatches with the default key', async () => {
  expect((await list({ scope: 'defaults' })).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: true });
  mocks.defaults.mockResolvedValue({ value: { apiKey: { refuseless: 'default-key' } } });
  expect((await list({ scope: 'defaults' })).status).toBe(200);
  expect(mocks.fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer default-key' });
});

it('does not dispatch for visitors or expose provider failures', async () => {
  mocks.actor.mockResolvedValueOnce(null);
  expect((await list()).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.fetch.mockResolvedValueOnce(Response.json({ error: 'provider internals' }, { status: 401 }));
  const response = await list();
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('provider internals');
});
