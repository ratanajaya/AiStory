import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), update: vi.fn(), origin: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, sameOrigin: mocks.origin, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ TemplateModel: { findOneAndUpdate: mocks.update } }));
import { PATCH } from './route';
const patch = (body: unknown) => PATCH(new Request('http://localhost/api/templates/i1/status', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'i1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ filter: { ownerEmail: 'owner@example.com' } });
  mocks.origin.mockReturnValue(true);
  mocks.update.mockImplementation(async (_filter, update) => ({ templateId: 'i1', ...update.$set }));
});
it.each(['user', 'guest'])('changes only status in the %s ownership scope', async kind => {
  const filter = kind === 'user' ? { ownerEmail: 'owner@example.com' } : { guestId: 'g1' };
  mocks.actor.mockResolvedValue({ kind, filter });
  for (const isActive of [false, true]) {
    const response = await patch({ isActive });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ templateId: 'i1', isActive });
    expect(mocks.update).toHaveBeenLastCalledWith({ templateId: 'i1', ...filter }, { $set: { isActive } }, { new: true, runValidators: true });
  }
});
it.each([null, [], {}, { isActive: 'false' }, { isActive: null }, { isActive: false, ownerEmail: 'forged' }])('rejects invalid status %j', async body => {
  expect((await patch(body)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('rejects malformed JSON', async () => {
  const response = await PATCH(new Request('http://localhost/api/templates/i1/status', { method: 'PATCH', body: '{' }), { params: Promise.resolve({ id: 'i1' }) });
  expect(response.status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('rejects missing actors and cross-origin requests', async () => {
  mocks.actor.mockResolvedValue(null);
  expect((await patch({ isActive: false })).status).toBe(401);
  mocks.actor.mockResolvedValue({ filter: { guestId: 'g1' } });
  mocks.origin.mockReturnValue(false);
  expect((await patch({ isActive: false })).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('returns 404 for unavailable or other-owner items', async () => {
  mocks.update.mockResolvedValue(null);
  expect((await patch({ isActive: false })).status).toBe(404);
});
