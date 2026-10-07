import { Readable } from 'node:stream';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ bucketMetadata: vi.fn(), metadata: vi.fn(), download: vi.fn(), signed: vi.fn(), remove: vi.fn(), stream: vi.fn(), file: vi.fn() }));
vi.mock('@google-cloud/storage', () => ({ Storage: class {
  bucket() { return { getMetadata: mocks.bucketMetadata, file: mocks.file }; }
} }));
import { releaseUploadUrl, verifyReleaseAudio, releaseAudioStream, deleteReleaseAudio } from '@/lib/releaseStorage';
const file = { segmentId: 's', partIndex: 0, whole: false, mimeType: 'audio/mpeg', byteSize: 100, objectKey: 'releases/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/0' };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('GCS_RELEASE_BUCKET_NAME', 'private'); vi.stubEnv('GCS_BUCKET_NAME', 'public'); vi.stubEnv('GCS_CREDENTIALS', '');
  mocks.bucketMetadata.mockResolvedValue([{ iamConfiguration: { publicAccessPrevention: 'enforced', uniformBucketLevelAccess: { enabled: true } } }]);
  mocks.file.mockReturnValue({ getMetadata: mocks.metadata, download: mocks.download, getSignedUrl: mocks.signed, delete: mocks.remove, createReadStream: mocks.stream });
  mocks.metadata.mockResolvedValue([{ size: '100', contentType: 'audio/mpeg' }]); mocks.download.mockResolvedValue([Buffer.from('ID3recording')]); mocks.signed.mockResolvedValue(['signed']);
});
afterEach(() => vi.unstubAllEnvs());
it('signs private create-only uploads with exact byte length and MIME', async () => {
  expect(await releaseUploadUrl(file)).toBe('signed');
  expect(mocks.signed).toHaveBeenCalledWith(expect.objectContaining({ version: 'v4', action: 'write', contentType: 'audio/mpeg', extensionHeaders: { 'content-length': '100' }, queryParams: { ifGenerationMatch: '0' } }));
  expect(mocks.file).toHaveBeenCalledWith(file.objectKey);
});
it('rejects public/shared/unconfigured buckets before issuing an upload URL', async () => {
  vi.stubEnv('GCS_RELEASE_BUCKET_NAME', 'public'); await expect(releaseUploadUrl(file)).rejects.toThrow('dedicated');
  vi.stubEnv('GCS_RELEASE_BUCKET_NAME', 'private'); mocks.bucketMetadata.mockResolvedValue([{ iamConfiguration: {} }]);
  await expect(releaseUploadUrl(file)).rejects.toThrow('private'); expect(mocks.signed).not.toHaveBeenCalled();
});
it('verifies byte size, MIME and recognizable audio contents', async () => {
  await verifyReleaseAudio(file);
  mocks.metadata.mockResolvedValue([{ size: '101', contentType: 'audio/mpeg' }]); await expect(verifyReleaseAudio(file)).rejects.toThrow('manifest');
  mocks.metadata.mockResolvedValue([{ size: '100', contentType: 'audio/mpeg' }]); mocks.download.mockResolvedValue([Buffer.from('<html>fake')]);
  await expect(verifyReleaseAudio(file)).rejects.toThrow('contents');
  mocks.metadata.mockResolvedValue([{ size: '100', contentType: 'audio/wav' }]); mocks.download.mockResolvedValue([Buffer.from('RIFFxxxxWAVE')]);
  await verifyReleaseAudio({ ...file, mimeType: 'audio/wav' });
});
it('streams only the requested range and restricts cleanup keys', async () => {
  mocks.stream.mockReturnValue(Readable.from(['audio'])); await releaseAudioStream(file.objectKey, { start: 5, end: 9 });
  expect(mocks.stream).toHaveBeenCalledWith({ start: 5, end: 9 });
  await expect(deleteReleaseAudio('template-images/file')).rejects.toThrow('Invalid');
  await deleteReleaseAudio(file.objectKey); expect(mocks.remove).toHaveBeenCalledWith({ ignoreNotFound: true });
});
