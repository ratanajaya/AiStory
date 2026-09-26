import nextEnv from '@next/env';
import mongoose from 'mongoose';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.MONGO_URI || !process.env.MONGO_DB_NAME) throw new Error('MongoDB configuration is required');
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
try {
  const db = mongoose.connection.db;
  // Additive only: existing templates remain private and existing accounts retain access.
  await db.collection('guestWorkspaces').createIndexes([
    { key: { guestId: 1 }, unique: true },
    { key: { tokenHash: 1 }, unique: true },
    { key: { state: 1, expiresAt: 1 } },
    { key: { claimedExpiresAt: 1 }, expireAfterSeconds: 0 },
  ]);
  await db.collection('guestIpUsage').createIndexes([
    { key: { key: 1 }, unique: true }, { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ]);
  for (const collection of ['books', 'templates', 'guestUploads']) await db.collection(collection).createIndex({ guestId: 1 });
  await db.collection('templates').createIndex({ isPublic: 1, createdAt: -1 });
  console.log('Guest indexes provisioned. Verify cleanup scheduling and deployment secrets before enabling guest writes.');
} finally { await mongoose.disconnect(); }
