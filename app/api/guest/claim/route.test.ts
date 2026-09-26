import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ guest: vi.fn(), user: vi.fn(), guestUpdate: vi.fn(), userUpdate: vi.fn(), books: vi.fn(), templates: vi.fn(), uploads: vi.fn(), clearCookie: vi.fn() }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { email: 'account@example.com' } }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'cookie-token' }), delete: mocks.clearCookie }) }));
vi.mock('mongoose', () => ({ default: { connection: { transaction: async (run: (session: object) => Promise<void>) => run({}) } } }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('@/lib/guest', () => ({ sameOrigin: () => true, hashGuestToken: () => 'hashed-token', decryptGuestKey: (key: string) => key, GUEST_COOKIE: 'guest' }));
vi.mock('@/models', () => ({
  GuestWorkspaceModel: { findOne: () => ({ session: mocks.guest }), updateOne: mocks.guestUpdate },
  UserModel: { findOne: () => ({ session: mocks.user }), updateOne: mocks.userUpdate },
  BookModel: { updateMany: mocks.books }, TemplateModel: { updateMany: mocks.templates }, GuestUploadModel: { updateMany: mocks.uploads },
}));
import { POST } from './route';
const claim = () => POST(new Request('http://localhost/api/guest/claim', { method: 'POST' }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guest.mockResolvedValue({ _id: 'workspace', guestId: 'one', state: 'active', expiresAt: new Date(Date.now() + 60_000), trialTextUsed: 17, trialAudioUsed: 7000, encryptedKeys: { together: 'guest-together', openAi: 'guest-openai' }, selectedLlm: { service: 'together', model: 'guest-model' } });
  mocks.user.mockResolvedValue({ _id: 'account', trialAccount: true, trialTextUsed: 4, trialAudioUsed: 9000, apiKey: { together: 'account-key' }, selectedLlm: null });
  mocks.guestUpdate.mockResolvedValue({ matchedCount: 1 });
});

describe('claim workspace', () => {
  it('retains IDs, transfers all ownership, and preserves account keys and lower remaining allowance', async () => {
    const response = await claim();
    expect(await response.json()).toEqual({ claimed: true, preservedKeys: ['together'] });
    expect(mocks.userUpdate.mock.calls[0][1]).toEqual({ $set: { 'apiKey.openAi': 'guest-openai', selectedLlm: { service: 'together', model: 'guest-model' }, trialTextUsed: 17, trialAudioUsed: 9000 } });
    for (const update of [mocks.books, mocks.templates, mocks.uploads]) {
      expect(update.mock.calls[0][0]).toEqual({ guestId: 'one' });
      expect(update.mock.calls[0][1]).toEqual({ $set: { ownerEmail: 'account@example.com' }, $unset: { guestId: '', expiresAt: '' } });
      expect(update.mock.calls[0][2].session).toBe(mocks.guestUpdate.mock.calls[0][2].session);
    }
    expect(mocks.clearCookie).toHaveBeenCalled();
  });
  it('makes repeated claims by the same account idempotent', async () => {
    mocks.guest.mockResolvedValue({ state: 'claimed', claimedBy: 'account@example.com' });
    expect(await (await claim()).json()).toEqual({ claimed: true });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.books).not.toHaveBeenCalled();
  });
  it('rejects another account claiming the same workspace', async () => {
    mocks.guest.mockResolvedValue({ state: 'claimed', claimedBy: 'other@example.com' });
    expect((await claim()).status).toBe(409);
    expect(mocks.books).not.toHaveBeenCalled();
    expect(mocks.clearCookie).not.toHaveBeenCalled();
  });
  it('denies expired workspaces before moving records', async () => {
    mocks.guest.mockResolvedValue({ state: 'active', expiresAt: new Date(0) });
    expect((await claim()).status).toBe(409);
    expect(mocks.books).not.toHaveBeenCalled();
  });
});
