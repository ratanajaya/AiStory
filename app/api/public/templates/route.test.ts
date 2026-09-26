import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ default: mocks.connect }));
vi.mock('@/models', () => ({ TemplateModel: { find: mocks.find } }));

import { GET } from './route';

describe('public template cards', () => {
  it('queries published account templates and returns only card fields', async () => {
    mocks.find.mockReturnValue({ select: () => ({ sort: () => ({ lean: async () => [{ templateId: 'public-1', name: 'Forest', storyBackground: 'Trees', imageUrl: null, ownerEmail: 'private@example.com', promptBuilder: { narration1: 'secret' } }] }) }) });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({ isPublic: true, ownerEmail: { $exists: true } });
    expect(await response.json()).toEqual([{ templateId: 'public-1', name: 'Forest', storyBackground: 'Trees', imageUrl: null }]);
  });
});
