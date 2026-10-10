import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { Storage } from '@google-cloud/storage';
nextEnv.loadEnvConfig(process.cwd());
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
let failed = 0;
try {
  const db = mongoose.connection.db;
  const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials: process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : undefined });
  const attempts = db.collection('releaseAttempts').find({ state: { $in: ['staging', 'superseded', 'cleaning'] }, expiresAt: { $lte: new Date() } });
  for await (const attempt of attempts) {
    try {
      const held = await db.collection('releaseAttempts').updateOne({ attemptId: attempt.attemptId, state: attempt.state, expiresAt: { $lte: new Date() } }, { $set: { state: 'cleaning' } });
      if (!held.matchedCount) continue;
      for (const file of attempt.files) {
        if (await db.collection('releasedBooks').findOne({ 'segments.audio.objectKey': file.objectKey })) throw new Error('Active audio reference');
        if (!process.env.GCS_RELEASE_BUCKET_NAME || !/^releases\/[a-f0-9-]+\/\d+$/.test(file.objectKey)) throw new Error('Invalid audio storage');
        await storage.bucket(process.env.GCS_RELEASE_BUCKET_NAME).file(file.objectKey).delete({ ignoreNotFound: true });
      }
      await db.collection('releaseAttempts').deleteOne({ attemptId: attempt.attemptId, state: 'cleaning' });
    } catch { failed++; console.error('Release cleanup attempt failed'); }
  }
} finally { await mongoose.disconnect(); }
if (failed) process.exitCode = 1;
