import { beforeEach, expect, it, vi } from 'vitest';
import { releaseSnapshot } from '@/lib/releaseValidation';
const mocks = vi.hoisted(() => ({ actor: vi.fn(), origin: vi.fn(), settings: vi.fn(), book: vi.fn(), bookLock: vi.fn(), existing: vi.fn(), releaseCreate: vi.fn(), releaseUpdate: vi.fn(),
  attempt: vi.fn(), attemptCreate: vi.fn(), attemptUpdate: vi.fn(), attemptMany: vi.fn(), verify: vi.fn(), url: vi.fn(), transaction: vi.fn() }));
vi.mock('mongoose', () => ({ default: { connection: { transaction: mocks.transaction } } }));
vi.mock('@/lib/mongodb', () => ({ default: vi.fn() }));
vi.mock('@/lib/guest', () => ({ getActor: mocks.actor, sameOrigin: mocks.origin }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: mocks.settings }));
vi.mock('@/lib/releaseStorage', () => ({ verifyReleaseAudio: mocks.verify, releaseUploadUrl: mocks.url }));
vi.mock('@/models', () => ({
  BookModel: { findOne: mocks.book, updateOne: mocks.bookLock },
  ReleasedBookModel: { findOne: mocks.existing, create: mocks.releaseCreate, updateOne: mocks.releaseUpdate },
  ReleaseAttemptModel: { findOne: mocks.attempt, create: mocks.attemptCreate, updateOne: mocks.attemptUpdate, updateMany: mocks.attemptMany },
}));
import { startRelease, commitRelease, authorizeReleaseUploads, ownedRelease, releaseOwner, releasedBookResponse } from '@/lib/releases';
const owner = 'owner@example.com';
const savedBook = { name: 'Story', updatedAt: new Date(), storySegments: [{ id: 'a', role: 'assistant', content: 'Narration', day: 1 }, { id: 'u', role: 'user', content: 'Private', day: 1 }], isActive: false };
const chain = (value: unknown) => ({ lean: async () => value, session: () => ({ lean: async () => value }) });
let attempt: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  attempt = { attemptId: 'attempt', ownerEmail: owner, sourceBookId: 'b1', releaseId: 'r1', baseRevision: 0,
    ...releaseSnapshot(savedBook), selectedTts: { service: 'together', model: 'model', voice: 'voice' }, files: [], state: 'staging', manifestSet: true, expiresAt: new Date(Date.now() + 60000) };
  mocks.book.mockImplementation(() => chain(savedBook)); mocks.attempt.mockImplementation(() => chain(attempt));
  mocks.existing.mockImplementation(() => chain(null)); mocks.settings.mockResolvedValue({ selectedTts: attempt.selectedTts });
  mocks.bookLock.mockResolvedValue({ matchedCount: 1 }); mocks.releaseUpdate.mockResolvedValue({ modifiedCount: 1 });
  mocks.attemptUpdate.mockResolvedValue({ modifiedCount: 1 }); mocks.transaction.mockImplementation(async fn => fn({}));
  mocks.url.mockResolvedValue('https://private-upload'); mocks.verify.mockResolvedValue(undefined);
  mocks.actor.mockResolvedValue({ kind: 'user', ownerEmail: owner }); mocks.origin.mockReturnValue(true);
});
it('requires an account and same origin before release access', async () => {
  const request = new Request('http://localhost', { method: 'POST' });
  mocks.actor.mockResolvedValue(null); await expect(releaseOwner(request)).rejects.toMatchObject({ status: 401 });
  mocks.actor.mockResolvedValue({ kind: 'guest', guestId: 'g' }); await expect(releaseOwner(request)).rejects.toMatchObject({ status: 403 });
  mocks.actor.mockResolvedValue({ kind: 'user', ownerEmail: owner }); mocks.origin.mockReturnValue(false); await expect(releaseOwner(request)).rejects.toMatchObject({ status: 403 });
});
it('starts from server-owned saved content, even when the source is inactive', async () => {
  const started = await startRelease(owner, 'b1');
  expect(started.segments).toHaveLength(1); expect(started.selectedTts).toEqual(attempt.selectedTts);
  expect(mocks.book).toHaveBeenCalledWith({ ownerEmail: owner, bookId: 'b1' });
  expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({ ownerEmail: owner, sourceBookId: 'b1', baseRevision: 0 }));
});
it('uses the existing URL and revision for replacement', async () => {
  mocks.existing.mockReturnValue(chain({ releaseId: 'stable', revision: 5 }));
  expect((await startRelease(owner, 'b1')).replacing).toBe(true);
  expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({ releaseId: 'stable', baseRevision: 5 }));
});
it('rejects unavailable books and books without assistant text', async () => {
  mocks.book.mockReturnValue(chain(null)); await expect(startRelease(owner, 'b1')).rejects.toMatchObject({ status: 404 });
  mocks.book.mockReturnValue(chain({ name: '', storySegments: [] })); await expect(startRelease(owner, 'b1')).rejects.toMatchObject({ status: 400 });
  expect(mocks.attemptCreate).not.toHaveBeenCalled();
});
it('commits a simplified text-only entity transactionally without audio storage', async () => {
  expect(await commitRelease(owner, 'attempt')).toEqual({ releaseId: 'r1', revision: 1 });
  const value = mocks.releaseCreate.mock.calls[0][0][0];
  expect(value).toMatchObject({ releaseId: 'r1', ownerEmail: owner, title: 'Story', revision: 1, segments: [{ id: 'a', content: 'Narration', expectedAudioParts: 1, audio: [] }] });
  expect(value).not.toHaveProperty('storySegments'); expect(value).not.toHaveProperty('promptBuilder');
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.bookLock.mock.calls[0][1]).toEqual({ $set: { updatedAt: savedBook.updatedAt } });
});
it('replaces content and audio at the same URL with revision compare-and-set', async () => {
  attempt.baseRevision = 3;
  await commitRelease(owner, 'attempt');
  expect(mocks.releaseUpdate).toHaveBeenCalledWith({ ownerEmail: owner, sourceBookId: 'b1', revision: 3 }, expect.objectContaining({ $set: expect.objectContaining({ releaseId: 'r1', revision: 4 }) }), expect.anything());
  expect(mocks.attemptMany).toHaveBeenCalledWith({ ownerEmail: owner, releaseId: 'r1', state: 'published' }, expect.objectContaining({ $set: expect.objectContaining({ state: 'superseded' }) }), expect.anything());
});
it('rejects concurrent replacement and unchanged uploads cannot overwrite it', async () => {
  attempt.baseRevision = 3; mocks.releaseUpdate.mockResolvedValue({ modifiedCount: 0 });
  await expect(commitRelease(owner, 'attempt')).rejects.toMatchObject({ status: 409 });
  expect(mocks.attemptMany).not.toHaveBeenCalled();
});
it('repeated commits return the previously committed result without reading the source', async () => {
  attempt.committedRevision = 2; attempt.state = 'published';
  expect(await commitRelease(owner, 'attempt')).toEqual({ releaseId: 'r1', revision: 2 });
  expect(mocks.book).not.toHaveBeenCalled(); expect(mocks.verify).not.toHaveBeenCalled();
});
it('keeps the prior release intact when uploads fail', async () => {
  attempt.files = [{ objectKey: 'file' }]; mocks.verify.mockRejectedValue(new Error('Missing object'));
  await expect(commitRelease(owner, 'attempt')).rejects.toMatchObject({ status: 409 });
  expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.releaseUpdate).not.toHaveBeenCalled();
});
it('rejects changed or deleted source snapshots before publication', async () => {
  mocks.book.mockReturnValue(chain({ ...savedBook, name: 'Changed' }));
  await expect(commitRelease(owner, 'attempt')).rejects.toMatchObject({ status: 409 });
  expect(mocks.releaseCreate).not.toHaveBeenCalled();
});
it('authorizes immutable object keys and records the manifest before signing URLs', async () => {
  attempt.manifestSet = false;
  const response = await authorizeReleaseUploads(owner, 'attempt', { files: [{ segmentId: 'a', partIndex: 0, whole: false, mimeType: 'audio/mpeg', byteSize: 10, objectKey: 'forged' }] });
  expect(response.uploads[0].objectKey).toBe('releases/attempt/0');
  expect(mocks.attemptUpdate.mock.invocationCallOrder[0]).toBeLessThan(mocks.url.mock.invocationCallOrder[0]);
});
it('rejects reused, expired, other-owner attempts and incomplete manifests', async () => {
  await expect(authorizeReleaseUploads(owner, 'attempt', { files: [] })).rejects.toMatchObject({ status: 409 });
  attempt.manifestSet = false; await expect(commitRelease(owner, 'attempt')).rejects.toMatchObject({ status: 409 });
  attempt.expiresAt = new Date(0); await expect(authorizeReleaseUploads(owner, 'attempt', { files: [] })).rejects.toMatchObject({ status: 409 });
  mocks.attempt.mockReturnValue(chain(null)); await expect(commitRelease(owner, 'attempt')).rejects.toMatchObject({ status: 404 });
  expect(mocks.attempt).toHaveBeenLastCalledWith({ ownerEmail: owner, attemptId: 'attempt' });
});
it('private reader responses contain no ownership or storage keys and need no source', async () => {
  const released = { releaseId: 'r1', sourceBookId: 'deleted', ownerEmail: owner, title: 'Story', revision: 2, releasedAt: 'date', segments: [{ id: 's', content: 'text', expectedAudioParts: 2, audio: [{ objectKey: 'private', byteSize: 10, mimeType: 'audio/mpeg', partIndex: 1 }] }] };
  mocks.existing.mockReturnValue(chain(released));
  const book = await ownedRelease(owner, 'r1'); const response = releasedBookResponse(book);
  expect(JSON.stringify(response)).not.toContain('private'); expect(response).not.toHaveProperty('ownerEmail');
  expect(response.segments[0].audio[0].url).toContain('/1?revision=2'); expect(mocks.book).not.toHaveBeenCalled();
});
