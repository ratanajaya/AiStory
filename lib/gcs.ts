import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: process.env.GCS_CREDENTIALS
    ? JSON.parse(process.env.GCS_CREDENTIALS)
    : undefined,
});

const bucketName = process.env.GCS_BUCKET_NAME!;
const bucket = storage.bucket(bucketName);

export async function uploadImage(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const blob = bucket.file(`template-images/${fileName}`);
  const stream = blob.createWriteStream({
    resumable: false,
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  return new Promise((resolve, reject) => {
    stream.on('error', (err) => reject(err));
    stream.on('finish', async () => {
      try {
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucketName}/template-images/${fileName}`;
        resolve(publicUrl);
      } catch (err) {
        reject(err);
      }
    });
    stream.end(file);
  });
}

export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    await deleteImageOrThrow(imageUrl);
  } catch (error) {
    console.error('Failed to delete image from GCS:', error);
  }
}

export async function deleteImageOrThrow(imageUrl: string): Promise<void> {
  const expected = `https://storage.googleapis.com/${bucketName}/`;
  if (!imageUrl.startsWith(expected)) throw new Error('Image does not belong to the configured bucket');
  await bucket.file(imageUrl.slice(expected.length)).delete({ ignoreNotFound: true });
}
