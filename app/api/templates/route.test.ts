import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), create: vi.fn(), countDocuments: vi.fn(), connect: vi.fn(), workspace: vi.fn() }));
vi.mock('@/lib/guest', () => ({
  getActor: mocks.actor,
  getOrCreateActor: mocks.actor,
  getGuestWorkspace: mocks.workspace,
  sameOrigin: () => true,
  guardGuestMutation: (handler: unknown) => handler,
}));
vi.mock('@/lib/mongodb', () => ({ default: mocks.connect }));
vi.mock('@/models', () => ({ TemplateModel: { create: mocks.create, countDocuments: mocks.countDocuments } }));

import { POST } from './route';

const body = { name: 'A story', storyBackground: 'A quiet city', writingStyle: 'Plain', promptBuilder: {} };
const request = (value: object) => new Request('http://localhost/api/templates', { method: 'POST', body: JSON.stringify(value) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: false, filter: { ownerEmail: 'member@example.com' } });
  mocks.create.mockImplementation(async (value) => ({ toObject: () => value }));
});

describe('template publishing', () => {
  it('rejects a non-admin publication attempt before writing', async () => {
    const response = await POST(request({ ...body, isPublic: true }));
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('allows an admin to publish only a template owned by that admin', async () => {
    mocks.actor.mockResolvedValue({ kind: 'user', isAdmin: true, filter: { ownerEmail: 'admin@example.com' } });
    const response = await POST(request({ ...body, ownerEmail: 'other@example.com', guestId: 'forged', isPublic: true }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ownerEmail: 'admin@example.com', isPublic: true }));
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('guestId');
  });
});
