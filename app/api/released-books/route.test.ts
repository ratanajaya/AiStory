vi.mock('@/lib/guest', () => ({ getActor: vi.fn(), sameOrigin: vi.fn() }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: vi.fn() }));
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: vi.fn(), find: vi.fn(), sort: vi.fn() }));
vi.mock('@/lib/releases', async original => ({ ...await original<typeof import('@/lib/releases')>(), releaseOwner: mocks.owner }));
vi.mock('@/models', () => ({ ReleasedBookModel: { find: mocks.find } }));
import { GET } from './route';
it('lists only owner releases newest-first and omits stored private fields', async () => {
  mocks.owner.mockResolvedValue('owner'); mocks.sort.mockReturnValue({ lean: async () => [{ releaseId: 'r', title: 'Story', releasedAt: 'date', ownerEmail: 'owner', sourceBookId: 'private', segments: [{ content: 'secret full text', expectedAudioParts: 2, audio: [{ objectKey: 'private' }] }] }] });
  mocks.find.mockReturnValue({ sort: mocks.sort });
  const response = await GET(new Request('http://localhost/api/released-books'));
  expect(mocks.find).toHaveBeenCalledWith({ ownerEmail: 'owner' }); expect(mocks.sort).toHaveBeenCalledWith({ releasedAt: -1 });
  expect(await response.json()).toEqual([{ releaseId: 'r', title: 'Story', releasedAt: 'date', segmentCount: 1, audioParts: 1, expectedAudioParts: 2 }]);
});
