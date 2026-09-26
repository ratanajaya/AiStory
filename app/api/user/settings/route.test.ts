import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), find: vi.fn() }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/models', () => ({ UserModel: { updateOne: mocks.update, findOne: () => ({ lean: mocks.find }) } }));
import { GET, PUT } from './route';
const config = { service: 'openAi', model: 'tts-1', voice: 'alloy' };
const put = (body: unknown) => PUT(new Request('http://localhost/api/user/settings', { method: 'PUT', body: JSON.stringify(body) }));
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { email: 'owner@example.com' } }); mocks.update.mockResolvedValue({ matchedCount: 1 }); mocks.find.mockResolvedValue({ selectedTts: config }); });
describe('account TTS preferences', () => {
  it('loads and narrowly updates only the authenticated account', async () => {
    expect((await (await GET()).json()).selectedTts).toEqual(config);
    expect((await put({ selectedTts: config, ownerEmail: 'other', isAdmin: true })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ email: 'owner@example.com' }, { $set: { selectedTts: config } });
  });
  it('clears preferences for fallback and rejects incomplete configurations', async () => {
    await put({ selectedTts: null });
    expect(mocks.update).toHaveBeenCalledWith(expect.any(Object), { $set: { selectedTts: null } });
    expect((await put({ selectedTts: { ...config, voice: ' ' } })).status).toBe(400);
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it('requires authentication', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await put({ selectedTts: config })).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
