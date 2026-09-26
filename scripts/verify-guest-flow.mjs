// Opt-in local smoke test. Creates two private guest workspaces and removes only
// the records identified by the fresh cookies returned to this process.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import mongoose from 'mongoose';

nextEnv.loadEnvConfig(process.cwd());
const base = 'http://localhost:7002';
const tokens = [];
const connections = [];
async function client() {
  const response = await fetch(`${base}/api/guest/session`, { method: 'POST' });
  assert.equal(response.status, 200, 'guest session creation');
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('aistory_guest='))?.split(';')[0];
  assert.ok(cookie);
  tokens.push(cookie.slice('aistory_guest='.length));
  return async (path, method = 'GET', body) => {
    const result = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: result.status, body: await result.json() };
  };
}

try {
  const visitor = await (await fetch(`${base}/api/viewer`)).json();
  assert.equal(visitor.kind, 'visitor', 'run with AUTH_SESSION_OVERRIDE cleared');
  const first = await client();
  const second = await client();
  const template = await first('/api/templates', 'POST', { name: 'Guest smoke test', storyBackground: 'A quiet garden.', writingStyle: 'Short sentences.', promptBuilder: {}, ownerEmail: 'ignored@example.com' });
  assert.equal(template.status, 201);
  assert.equal(template.body.ownerEmail, undefined);
  assert.equal(template.body.isPublic, undefined);
  assert.equal((await second(`/api/templates/${template.body.templateId}`)).status, 404);
  const publication = await first(`/api/templates/${template.body.templateId}`, 'PUT', { name: 'Guest smoke test', storyBackground: 'Garden', writingStyle: 'Short', isPublic: true });
  assert.equal(publication.status, 403);
  const book = await first('/api/books', 'POST', { templateId: template.body.templateId });
  assert.equal(book.status, 201);
  const bookPath = `/api/books/${book.body.bookId}`;
  const saves = await Promise.all([
    first(`${bookPath}/draft`, 'PATCH', { draftOutline: 'A visitor arrives.', draftIdea: 'A garden mystery.' }),
    first(`${bookPath}/name`, 'PATCH', { name: 'Smoke test book' }),
  ]);
  assert.ok(saves.every((result) => result.status === 200), 'concurrent narrow saves');
  const saved = await first(bookPath);
  assert.equal(saved.body.draftOutline, 'A visitor arrives.');
  assert.equal(saved.body.name, 'Smoke test book');
  assert.equal((await second(bookPath)).status, 404);
  assert.equal((await first('/api/guest/settings', 'PUT', { apiKey: { openAi: 'smoke-test-not-a-real-key' } })).status, 200);
  const settings = await first('/api/guest/settings');
  assert.equal(settings.body.configured.openAi, true);
  assert.ok(!JSON.stringify(settings.body).includes('smoke-test-not-a-real-key'));
  assert.equal((await first('/api/guest/settings', 'PUT', { apiKey: { openAi: null } })).status, 200);
  const viewer = await first('/api/viewer');
  assert.deepEqual(viewer.body.remaining, { text: 20, audio: 10000 });
  console.log('Guest creation, ownership isolation, admin rejection, concurrent saves, key configuration/removal, and allowance smoke checks passed.');
} finally {
  if (tokens.length) {
    const connection = await mongoose.createConnection(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME, ...(process.env.MONGO_TLS_INSECURE === 'true' ? { tls: true, tlsAllowInvalidCertificates: true } : {}) }).asPromise();
    connections.push(connection);
    for (const token of tokens) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const guest = await connection.db.collection('guestWorkspaces').findOne({ tokenHash, state: 'active' });
      if (!guest) continue;
      for (const collection of ['books', 'templates']) await connection.db.collection(collection).deleteMany({ guestId: guest.guestId });
      await connection.db.collection('guestWorkspaces').deleteOne({ _id: guest._id, tokenHash });
    }
  }
  for (const connection of connections) await connection.close();
}
