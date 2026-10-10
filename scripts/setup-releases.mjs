import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { Storage } from '@google-cloud/storage';
nextEnv.loadEnvConfig(process.cwd());
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
try {
  const db = mongoose.connection.db;
  await db.collection('releasedBooks').createIndex({ releaseId: 1 }, { unique: true });
  await db.collection('releasedBooks').createIndex({ ownerEmail: 1, sourceBookId: 1 }, { unique: true });
  await db.collection('releasedBooks').createIndex({ ownerEmail: 1, releasedAt: -1 });
  await db.collection('releaseAttempts').createIndex({ attemptId: 1 }, { unique: true });
  await db.collection('releaseAttempts').createIndex({ state: 1, expiresAt: 1 });
  if (process.env.GCS_RELEASE_BUCKET_NAME) {
    if (process.env.GCS_RELEASE_BUCKET_NAME === process.env.GCS_BUCKET_NAME) throw new Error('Use a dedicated private release bucket');
    const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials: process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : undefined });
    const [metadata] = await storage.bucket(process.env.GCS_RELEASE_BUCKET_NAME).getMetadata();
    if (metadata.iamConfiguration?.publicAccessPrevention !== 'enforced' || !metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled) throw new Error('Release bucket requires public access prevention and uniform bucket-level access');
  }
  console.log('Release indexes and private bucket checks completed.');
} finally { await mongoose.disconnect(); }
