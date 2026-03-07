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
    const filePath = imageUrl.split(`${bucketName}/`)[1];
    if (filePath) {
      await bucket.file(filePath).delete();
    }
  } catch (error) {
    console.error('Failed to delete image from GCS:', error);
  }
}
