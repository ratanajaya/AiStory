import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import mongoose from 'mongoose';
import { Storage } from '@google-cloud/storage';

loadEnvConfig(process.cwd());
if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME || !process.env.GCS_BUCKET_NAME) throw new Error('MongoDB and GCS configuration is required');
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
const db = mongoose.connection.db;
const storage = new Storage({ projectId: process.env.GCS_PROJECT_ID, credentials: process.env.GCS_CREDENTIALS ? JSON.parse(process.env.GCS_CREDENTIALS) : undefined });
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
let failed = 0;
try {
  const cursor = db.collection('guestWorkspaces').find({ $or: [{ state: 'active', expiresAt: { $lte: new Date() } }, { state: 'cleaning' }] });
  for await (const guest of cursor) {
    try {
      const locked = await db.collection('guestWorkspaces').updateOne({ _id: guest._id, state: guest.state }, { $set: { state: 'cleaning' } });
      if (!locked.matchedCount) continue;
      await db.collection('books').deleteMany({ guestId: guest.guestId });
      await db.collection('templates').deleteMany({ guestId: guest.guestId });
      const uploads = db.collection('guestUploads').find({ guestId: guest.guestId });
      for await (const upload of uploads) {
        const prefix = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/`;
        if (upload.imageUrl.startsWith(prefix)) {
          await bucket.file(upload.imageUrl.slice(prefix.length)).delete({ ignoreNotFound: true });
        }
        await db.collection('guestUploads').deleteOne({ _id: upload._id });
      }
      await db.collection('guestWorkspaces').deleteOne({ _id: guest._id, state: 'cleaning' });
    } catch { failed++; console.error('Guest cleanup failed for workspace', guest.guestId); }
  }
} finally { await mongoose.disconnect(); }
if (failed) process.exitCode = 1;
