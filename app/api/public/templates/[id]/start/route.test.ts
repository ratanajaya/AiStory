import { beforeEach, expect, it, vi } from 'vitest';
import { defaultNarrationModePrompts } from '@/lib/narrationModes';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), original: vi.fn(), templateCreate: vi.fn(), bookCreate: vi.fn(), alive: vi.fn(), count: vi.fn(), workspace: vi.fn(), findOriginal: vi.fn(), session: {} }));
vi.mock('mongoose', () => ({ default: { connection: { transaction: async (fn: (session: object) => Promise<void>) => fn(mocks.session) } } }));
vi.mock('@/lib/guest', () => ({ getOrCreateActor: mocks.actor, sameOrigin: () => true }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({
  TemplateModel: { findOne: (filter: unknown) => { mocks.findOriginal(filter); return { session: () => ({ lean: mocks.original }) }; }, create: mocks.templateCreate, countDocuments: () => ({ session: mocks.count }) },
  BookModel: { create: mocks.bookCreate, countDocuments: () => ({ session: mocks.count }) },
  KeyValueModel: { findOne: () => ({ session: () => ({ lean: async () => null }) }) },
  GuestWorkspaceModel: { updateOne: mocks.alive, findOne: () => ({ session: mocks.workspace }) },
}));
import { POST } from './route';
const start = () => POST(new Request('http://localhost/api/public/templates/t1/start', { method: 'POST' }), { params: Promise.resolve({ id: 't1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', filter: { ownerEmail: 'owner@example.com' } });
  mocks.original.mockResolvedValue({ name: 'Template', storyBackground: 'Background', writingStyle: 'Style', promptBuilder: {}, starterOutline: 'Meet Mara.' });
  mocks.alive.mockResolvedValue({ matchedCount: 1 });
  mocks.count.mockResolvedValue(0);
  mocks.workspace.mockResolvedValue({ expiresAt: new Date('2026-10-11') });
});
it.each(['user', 'guest'])('copies and starts a public template for a %s inside the transaction', async kind => {
  const filter = kind === 'user' ? { ownerEmail: 'owner@example.com' } : { guestId: 'g1' };
  mocks.actor.mockResolvedValue({ kind, guestId: 'g1', filter });
  const response = await start();
  expect(response.status).toBe(201);
  const result = await response.json();
  const copy = mocks.templateCreate.mock.calls[0][0][0];
  const book = mocks.bookCreate.mock.calls[0][0][0];
  expect(copy).toMatchObject({ ...filter, starterOutline: 'Meet Mara.', isPublic: false });
  expect(copy.promptBuilder).toMatchObject(defaultNarrationModePrompts);
  expect(book).toMatchObject({ ...filter, bookId: result.bookId, templateId: copy.templateId, storySegments: [{ id: result.starterSegmentId, role: 'user', day: 0, content: 'Meet Mara.' }] });
  expect(mocks.bookCreate.mock.calls[0][1]).toEqual({ session: mocks.session });
  if (kind === 'guest') expect(book.expiresAt).toEqual(new Date('2026-10-11'));
});
it('does not hand off generation for a blank public starter', async () => {
  mocks.original.mockResolvedValue({ name: 'Template', storyBackground: 'Background', writingStyle: 'Style', promptBuilder: {}, starterOutline: '   ' });
  const result = await (await start()).json();
  expect(result).not.toHaveProperty('starterSegmentId');
  expect(mocks.bookCreate.mock.calls[0][0][0].storySegments).toEqual([]);
  expect(mocks.templateCreate.mock.calls[0][0][0].starterOutline).toBe('');
});

it('excludes inactive public templates before making any private copies', async () => {
  mocks.original.mockResolvedValue(null);
  const response = await start();
  expect(response.status).toBe(404);
  expect(mocks.findOriginal).toHaveBeenCalledWith({ templateId: 't1', isPublic: true, isActive: { $ne: false }, ownerEmail: { $exists: true } });
  expect(mocks.templateCreate).not.toHaveBeenCalled();
  expect(mocks.bookCreate).not.toHaveBeenCalled();
});
