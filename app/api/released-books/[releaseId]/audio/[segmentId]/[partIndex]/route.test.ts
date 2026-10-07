vi.mock('@/lib/guest', () => ({ getActor: vi.fn(), sameOrigin: vi.fn() }));
vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: vi.fn() }));
import { Readable } from 'node:stream';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ owner: vi.fn(), book: vi.fn(), stream: vi.fn() }));
vi.mock('@/lib/releases', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/releases')>();
  return { ...original, releaseOwner: mocks.owner, ownedRelease: mocks.book };
});
vi.mock('@/lib/releaseStorage', () => ({ releaseAudioStream: mocks.stream }));
import { GET } from './route';
const get = (range?: string, revision = '2', partIndex = '0') => GET(new Request(`http://localhost/api/released-books/r/audio/s/${partIndex}?revision=${revision}`, { headers: range ? { Range: range } : {} }), { params: Promise.resolve({ releaseId: 'r', segmentId: 's', partIndex }) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.owner.mockResolvedValue('owner');
  mocks.book.mockResolvedValue({ revision: 2, segments: [{ id: 's', audio: [{ partIndex: 0, objectKey: 'private', mimeType: 'audio/mpeg', byteSize: 10 }] }] });
  mocks.stream.mockResolvedValue(Readable.from([Buffer.from('0123456789')]));
});
it('serves private raw bytes after ownership resolution', async () => {
  const response = await get(); expect(response.status).toBe(200); expect(await response.text()).toBe('0123456789');
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('content-type')).toBe('audio/mpeg');
  expect(mocks.book).toHaveBeenCalledWith('owner', 'r');
});
it('supports seeking with correctly bounded ranges', async () => {
  mocks.stream.mockResolvedValue(Readable.from([Buffer.from('56789')])); const response = await get('bytes=5-');
  expect(response.status).toBe(206); expect(response.headers.get('content-range')).toBe('bytes 5-9/10');
  expect(response.headers.get('content-length')).toBe('5'); expect(mocks.stream).toHaveBeenCalledWith('private', { start: 5, end: 9 });
});
it('rejects unsatisfiable or multipart ranges without opening storage', async () => {
  const response = await get('bytes=10-'); expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */10');
  expect(mocks.stream).not.toHaveBeenCalled();
});
it('rejects replaced releases and unreferenced files before storage access', async () => {
  expect((await get(undefined, '1')).status).toBe(409); expect((await get(undefined, '2', '99')).status).toBe(404); expect(mocks.stream).not.toHaveBeenCalled();
});
it('never opens audio storage if ownership fails', async () => {
  const { ReleaseError } = await import('@/lib/releases'); mocks.owner.mockRejectedValue(new ReleaseError('Unauthorized', 401));
  expect((await get()).status).toBe(401); expect(mocks.book).not.toHaveBeenCalled(); expect(mocks.stream).not.toHaveBeenCalled();
});
