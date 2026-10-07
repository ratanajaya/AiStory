import { Storage } from '@google-cloud/storage';
import type { ReleaseFile } from '@/lib/releaseTypes';
function bucket() {
  const name = process.env.GCS_RELEASE_BUCKET_NAME;
  if (!name) throw new Error('Private release audio storage is not configured');
  const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials: process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : undefined });
  return storage.bucket(name);
}
async function privateBucket() {
  if (process.env.GCS_RELEASE_BUCKET_NAME === process.env.GCS_BUCKET_NAME) throw new Error('Use a dedicated private release bucket');
  const target = bucket(); const [metadata] = await target.getMetadata();
  if (metadata.iamConfiguration?.publicAccessPrevention !== 'enforced' || !metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled) throw new Error('Release bucket must enforce private access');
  return target;
}
export async function releaseUploadUrl(file: ReleaseFile) {
  const [url] = await (await privateBucket()).file(file.objectKey).getSignedUrl({ version: 'v4', action: 'write',
    expires: Date.now() + 15 * 60 * 1000, contentType: file.mimeType,
    extensionHeaders: { 'content-length': String(file.byteSize) }, queryParams: { ifGenerationMatch: '0' } });
  return url;
}
export async function verifyReleaseAudio(file: ReleaseFile) {
  const object = (await privateBucket()).file(file.objectKey);
  const [metadata] = await object.getMetadata();
  if (Number(metadata.size) !== file.byteSize || metadata.contentType !== file.mimeType) throw new Error('Uploaded audio does not match its manifest');
  const [header] = await object.download({ start: 0, end: 11 });
  const wav = header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE';
  const mp3 = header.toString('ascii', 0, 3) === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  if (!(file.mimeType === 'audio/wav' ? wav : mp3)) throw new Error('Unsupported audio file contents');
}
export async function releaseAudioStream(key: string, range?: { start: number; end: number }) {
  return (await privateBucket()).file(key).createReadStream(range ?? {});
}
export async function deleteReleaseAudio(key: string) {
  if (!/^releases\/[a-f0-9-]+\/\d+$/.test(key)) throw new Error('Invalid release audio object');
  await bucket().file(key).delete({ ignoreNotFound: true });
}
