import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, sameOrigin: () => true, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ BookModel: { findOneAndUpdate: mocks.update } }));
import { POST } from './route';
import { PATCH } from './[segmentId]/route';
const source = { id: 's1', day: 0, role: 'user', content: 'Events to include', narrationMode: 'events' };
const create = (segment: unknown) => POST(new Request('http://localhost/api/books/b1/segments', { method: 'POST', body: JSON.stringify({ segment }) }),
  { params: Promise.resolve({ id: 'b1' }) });
const edit = (segment: unknown) => PATCH(new Request('http://localhost/api/books/b1/segments/s1', { method: 'PATCH', body: JSON.stringify(segment) }),
  { params: Promise.resolve({ id: 'b1', segmentId: 's1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ filter: { ownerEmail: 'owner@example.com' } });
  mocks.update.mockResolvedValue({ bookId: 'b1' });
});

it('saves source mode using an atomic owner-scoped segment append', async () => {
  const response = await create(source);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(source);
  expect(mocks.update.mock.calls[0][0]).toMatchObject({ bookId: 'b1', ownerEmail: 'owner@example.com' });
  expect(mocks.update.mock.calls[0][1]).toEqual({ $push: { storySegments: source } });
});

it('preserves mode when editing a guest source without updating unrelated arrays', async () => {
  mocks.actor.mockResolvedValue({ filter: { guestId: 'g1' } });
  const updated = { ...source, content: 'Edited events' };
  const response = await edit(updated);
  expect(await response.json()).toEqual(updated);
  expect(mocks.update.mock.calls[0][0]).toEqual({ bookId: 'b1', guestId: 'g1', 'storySegments.id': 's1' });
  expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { 'storySegments.$': updated } });
});

it('rejects invalid modes on both append and edit before touching the book', async () => {
  expect((await create({ ...source, narrationMode: 'unknown' })).status).toBe(400);
  expect((await edit({ ...source, narrationMode: {} })).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
