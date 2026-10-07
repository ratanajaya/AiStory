import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), exists: vi.fn(), deleteAudio: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/models', () => ({ ReleaseAttemptModel: { find: mocks.find, updateOne: mocks.update, deleteOne: mocks.remove }, ReleasedBookModel: { exists: mocks.exists } }));
vi.mock('@/lib/releaseStorage', () => ({ deleteReleaseAudio: mocks.deleteAudio }));
import { cleanupReleaseUploads } from '@/lib/releaseCleanup';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockReturnValue({ cursor: async function* () { yield { attemptId: 'a', state: 'staging', files: [{ objectKey: 'obj' }] }; } });
  mocks.update.mockResolvedValue({ matchedCount: 1 }); mocks.exists.mockResolvedValue(null);
});
it('deletes expired abandoned/superseded files and preserves published attempts', async () => {
  expect(await cleanupReleaseUploads()).toEqual({ cleaned: 1, failed: 0 });
  expect(mocks.find.mock.calls[0][0].state.$in).not.toContain('published');
  expect(mocks.deleteAudio).toHaveBeenCalledWith('obj'); expect(mocks.remove).toHaveBeenCalled();
});
it('retains tracking records for retry after deletion failures', async () => {
  mocks.deleteAudio.mockRejectedValueOnce(new Error('Unavailable'));
  expect(await cleanupReleaseUploads()).toEqual({ cleaned: 0, failed: 1 }); expect(mocks.remove).not.toHaveBeenCalled();
  expect(await cleanupReleaseUploads()).toEqual({ cleaned: 1, failed: 0 });
});
it('never deletes referenced audio even if a tracking record is wrong', async () => {
  mocks.exists.mockResolvedValue({ _id: 'active' });
  expect(await cleanupReleaseUploads()).toEqual({ cleaned: 0, failed: 1 }); expect(mocks.deleteAudio).not.toHaveBeenCalled();
});
