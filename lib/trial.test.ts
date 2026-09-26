import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), guestUpdate: vi.fn(), ipUpdate: vi.fn(), userUpdate: vi.fn(), guestFind: vi.fn(), ipFind: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
vi.mock('mongoose', () => ({ default: { connection: { transaction: async (run: (session: object) => Promise<void>) => run({}) } } }));
vi.mock('@/models', () => ({
  GuestWorkspaceModel: { updateOne: mocks.guestUpdate, findOne: () => ({ lean: mocks.guestFind }) },
  GuestIpUsageModel: { init: async () => {}, updateOne: mocks.ipUpdate, findOne: () => ({ lean: mocks.ipFind }) },
  UserModel: { updateOne: mocks.userUpdate },
}));
import { remainingTrial, reserveTrial } from './trial';
const request = new Request('http://localhost/api/ai');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'guest', guestId: 'one' });
  mocks.guestUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.ipUpdate.mockResolvedValue({ matchedCount: 1 });
  mocks.userUpdate.mockResolvedValue({ matchedCount: 1 });
});

describe('trial reservation', () => {
  it('uses conditional atomic counters for workspace and daily IP', async () => {
    expect(await reserveTrial(request, 'text', 1)).toEqual({ ok: true });
    expect(mocks.guestUpdate.mock.calls[0][0]).toMatchObject({ guestId: 'one', state: 'active', trialTextUsed: { $lte: 19 } });
    expect(mocks.ipUpdate.mock.calls[1][0]).toMatchObject({ textUsed: { $lte: 59 } });
    expect(mocks.ipUpdate.mock.calls[1][2].session).toBe(mocks.guestUpdate.mock.calls[0][2].session);
  });
  it('rejects exhaustion without dispatch', async () => {
    mocks.guestUpdate.mockResolvedValue({ matchedCount: 0 });
    expect(await reserveTrial(request, 'text', 1)).toMatchObject({ ok: false, status: 429 });
    expect(mocks.ipUpdate).toHaveBeenCalledTimes(1); // only idempotent counter initialization
  });
  it('returns the lower effective IP allowance independently for each capability', async () => {
    mocks.guestFind.mockResolvedValue({ trialTextUsed: 2, trialAudioUsed: 9000 });
    mocks.ipFind.mockResolvedValue({ textUsed: 57, audioUsed: 5000 });
    expect(await remainingTrial(request)).toEqual({ text: 3, audio: 1000 });
  });
  it('does not reset account allowance on reservations', async () => {
    mocks.actor.mockResolvedValue({ kind: 'user', ownerEmail: 'one@example.com' });
    await reserveTrial(request, 'audio', 2000);
    expect(mocks.userUpdate).toHaveBeenCalledWith({ email: 'one@example.com', trialAccount: true, trialAudioUsed: { $lte: 8000 } }, { $inc: { trialAudioUsed: 2000 } });
    expect(mocks.ipUpdate).not.toHaveBeenCalled();
  });
});
