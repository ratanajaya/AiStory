import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), template: vi.fn(), create: vi.fn(), count: vi.fn(), workspace: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, getOrCreateActor: mocks.actor, sameOrigin: () => true,
  getGuestWorkspace: mocks.workspace, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ TemplateModel: { findOne: mocks.template }, BookModel: { create: mocks.create, countDocuments: mocks.count } }));
import { POST } from './route';
const request = () => new Request('http://localhost/api/books', { method: 'POST', body: JSON.stringify({ templateId: 't1', starterOutline: 'Forged outline', ownerEmail: 'forged' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', filter: { ownerEmail: 'owner@example.com' } });
  mocks.template.mockResolvedValue({ starterOutline: 'Meet Mara.\nA storm arrives.' });
  mocks.create.mockImplementation(async value => value);
  mocks.count.mockResolvedValue(0);
  mocks.workspace.mockResolvedValue({ expiresAt: new Date('2026-10-11') });
});
it.each(['user', 'guest'])('starts a %s book with the server-owned starter segment', async kind => {
  const filter = kind === 'user' ? { ownerEmail: 'owner@example.com' } : { guestId: 'g1' };
  mocks.actor.mockResolvedValue({ kind, guestId: 'g1', filter });
  const response = await POST(request());
  expect(response.status).toBe(201);
  const body = await response.json();
  const saved = mocks.create.mock.calls[0][0];
  expect(saved).toMatchObject({ ...filter, templateId: 't1', storySegments: [{ id: body.starterSegmentId, day: 0, role: 'user', content: 'Meet Mara.\nA storm arrives.' }] });
  expect(mocks.template).toHaveBeenCalledWith({ templateId: 't1', ...filter });
  if (kind === 'guest') expect(saved.expiresAt).toEqual(new Date('2026-10-11'));
});
it.each([undefined, null, '', ' \n '])('keeps a book empty for unset outline %j', async starterOutline => {
  mocks.template.mockResolvedValue({ starterOutline });
  const response = await POST(request());
  expect(mocks.create.mock.calls[0][0].storySegments).toEqual([]);
  expect(await response.json()).not.toHaveProperty('starterSegmentId');
});
it('rejects a template outside the actor ownership scope', async () => {
  mocks.template.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(404);
  expect(mocks.create).not.toHaveBeenCalled();
});
