import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ BookModel: { updateOne: mocks.update } }));
import { PATCH } from './route';
const save = (body: unknown) => PATCH(new Request('http://localhost/api/books/b1/draft', {
  method: 'PATCH', body: JSON.stringify(body),
}), { params: Promise.resolve({ id: 'b1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ filter: { ownerEmail: 'owner@example.com' } });
  mocks.update.mockResolvedValue({ matchedCount: 1 });
});
it.each([{ ownerEmail: 'owner@example.com' }, { guestId: 'g1' }])('saves only direction within ownership %j', async filter => {
  mocks.actor.mockResolvedValue({ filter });
  expect((await save({ draftOutline: 'A visitor arrives.', draftIdea: 'Legacy', ownerEmail: 'forged', storySegments: [] })).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ bookId: 'b1', ...filter }, { $set: { draftOutline: 'A visitor arrives.' } });
});
it.each(['', '  ', 'x'.repeat(65_536)])('accepts empty or maximum-size drafts', async draftOutline => {
  expect((await save({ draftOutline })).status).toBe(200);
  expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { draftOutline: draftOutline.trim() ? draftOutline : '' } });
});
it.each([null, [], {}, { draftOutline: null }, { draftOutline: 1 }, { draftOutline: 'x'.repeat(65_537) }])('rejects invalid drafts before writing', async body => {
  expect((await save(body)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('requires an actor', async () => {
  mocks.actor.mockResolvedValue(null);
  expect((await save({ draftOutline: 'Direction' })).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});
it('returns 404 when no owned book matches', async () => {
  mocks.update.mockResolvedValue({ matchedCount: 0 });
  expect((await save({ draftOutline: 'Direction' })).status).toBe(404);
});
