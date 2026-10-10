import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, sameOrigin: () => true, guardGuestMutation: (handler: unknown) => handler }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ TemplateModel: { findOneAndUpdate: mocks.update } }));
import { PUT } from './route';
const update = (starterOutline: unknown) => PUT(new Request('http://localhost/api/templates/t1', { method: 'PUT',
  body: JSON.stringify({ name: 'Template', storyBackground: 'Background', writingStyle: 'Style', starterOutline, ownerEmail: 'forged' }) }),
  { params: Promise.resolve({ id: 't1' }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', filter: { ownerEmail: 'owner@example.com' }, isAdmin: false });
  mocks.update.mockImplementation(async (_filter, value) => ({ toObject: () => value }));
});
it('persists an updated starter outline within the actor ownership scope', async () => {
  const response = await update('Meet Mara.\nA storm arrives.');
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveProperty('starterOutline', 'Meet Mara.\nA storm arrives.');
  expect(mocks.update.mock.calls[0][0]).toEqual({ templateId: 't1', ownerEmail: 'owner@example.com' });
  expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('ownerEmail');
});
it('allows clearing the starter outline', async () => {
  const response = await update('  \n ');
  expect(await response.json()).toHaveProperty('starterOutline', '');
});
it('rejects invalid outlines before updating', async () => {
  expect((await update({})).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

it('rejects malformed creative prompts before updating the template', async () => {
  const response = await PUT(new Request('http://localhost/api/templates/t1', { method: 'PUT', body: JSON.stringify({
    name: 'Template', storyBackground: 'Background', writingStyle: 'Style', promptBuilder: { narrationStartEndRequest: false },
  }) }), { params: Promise.resolve({ id: 't1' }) });
  expect(response.status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
