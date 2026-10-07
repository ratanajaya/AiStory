import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), template: vi.fn(), create: vi.fn(), count: vi.fn(), workspace: vi.fn(), findBooks: vi.fn(), findTemplates: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, getOrCreateActor: mocks.actor, sameOrigin: () => true,
  getGuestWorkspace: mocks.workspace, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ TemplateModel: { find: mocks.findTemplates, findOne: mocks.template }, BookModel: { find: mocks.findBooks, create: mocks.create, countDocuments: mocks.count } }));
import { GET, POST } from './route';
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

it('rejects new books from inactive templates without consuming storage', async () => {
  mocks.template.mockResolvedValue({ isActive: false });
  expect((await POST(request())).status).toBe(409);
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each(['user', 'guest'])('filters Library books by own status and inactive templates for a %s', async kind => {
  const filter = kind === 'user' ? { ownerEmail: 'owner@example.com' } : { guestId: 'g1' };
  mocks.actor.mockResolvedValue({ kind, filter });
  mocks.findTemplates.mockReturnValue({ select: () => ({ lean: async () => [{ templateId: 'inactive' }] }) });
  const select = vi.fn().mockResolvedValue([{ bookId: 'active' }]);
  mocks.findBooks.mockReturnValue({ select });
  const response = await GET(new Request('http://localhost/api/books?activeOnly=true&select=bookId,name'));
  expect(response.status).toBe(200);
  expect(mocks.findTemplates).toHaveBeenCalledWith({ ...filter, isActive: false });
  expect(mocks.findBooks).toHaveBeenCalledWith({ ...filter, isActive: { $ne: false }, templateId: { $nin: ['inactive'] } });
  expect(select).toHaveBeenCalledWith('bookId name');
});
it('keeps the default book list inclusive for management', async () => {
  mocks.findBooks.mockResolvedValue([{ bookId: 'inactive', isActive: false }]);
  expect(await (await GET(new Request('http://localhost/api/books'))).json()).toEqual([{ bookId: 'inactive', isActive: false }]);
  expect(mocks.findBooks).toHaveBeenCalledWith({ ownerEmail: 'owner@example.com' });
  expect(mocks.findTemplates).not.toHaveBeenCalled();
});
