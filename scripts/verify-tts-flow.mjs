// Local smoke test. Creates and removes one isolated guest workspace.
// Set TTS_SMOKE_GENERATE=true to synthesize a single fixed sample with app credentials.
// TTS_SMOKE_PROVIDER=openai exercises OpenAI using a temporary request override.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import mongoose from 'mongoose';

nextEnv.loadEnvConfig(process.cwd());
const base = 'http://localhost:7002';
// Establish cleanup access before creating any records.
const connection = await mongoose.createConnection(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME,
  serverSelectionTimeoutMS: 10000,
  ...(process.env.MONGO_TLS_INSECURE === 'true' ? { tls: true, tlsAllowInvalidCertificates: true } : {}),
}).asPromise();
let cookie;
try {
  assert.equal((await (await fetch(`${base}/api/viewer`)).json()).kind, 'visitor', 'Run with AUTH_SESSION_OVERRIDE cleared');
  assert.equal((await fetch(`${base}/api/ai/tts`)).status, 401);
  assert.equal((await fetch(`${base}/api/ai/tts/models/openai`)).status, 401);
  const session = await fetch(`${base}/api/guest/session`, { method: 'POST' });
  assert.equal(session.status, 200, 'Guest session creation requires the guest environment configuration');
  cookie = session.headers.getSetCookie().find(value => value.startsWith('aistory_guest='))?.split(';')[0];
  assert.ok(cookie);
  const call = (path, method = 'GET', body) => fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(60000), method, headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const before = await (await call('/api/ai/tts')).json();
  assert.ok(before.selectedTts?.model);
  assert.equal((await call('/api/ai/tts?scope=defaults')).status, 403);
  const selectedTts = { service: 'openAi', model: 'tts-1', voice: 'alloy' };
  assert.equal((await call('/api/guest/settings', 'PUT', { selectedTts })).status, 200);
  assert.deepEqual((await (await call('/api/ai/tts')).json()).selectedTts, selectedTts);
  assert.equal((await call('/api/guest/settings', 'PUT', { selectedTts: null })).status, 200);
  assert.deepEqual((await (await call('/api/ai/tts')).json()).selectedTts, before.selectedTts);
  assert.equal((await call('/api/ai/tts', 'POST', { input: 'x'.repeat(5001) })).status, 413);
  for (const provider of ['together', 'openai']) {
    const response = await call(`/api/ai/tts/models/${provider}`);
    const body = await response.json();
    console.log(`${provider} catalog: HTTP ${response.status}, ${body.models?.length ?? 0} models`);
    assert.ok([200, 400, 502].includes(response.status));
    if (response.ok) assert.ok(Array.isArray(body.models));
  }
  if (process.env.TTS_SMOKE_GENERATE === 'true') {
    const remainingBefore = (await (await call('/api/viewer')).json()).remaining.audio;
    const input = 'Welcome to AiStory. Every story begins with a little imagination.';
    const response = await call('/api/ai/tts', 'POST', { input, ...(process.env.TTS_SMOKE_PROVIDER === 'openai' ? { selectedTts } : {}) });
    assert.equal(response.status, 200, 'Live speech generation');
    const audio = await response.arrayBuffer();
    assert.ok(response.headers.get('content-type')?.startsWith('audio/'));
    assert.ok(audio.byteLength > 44);
    if (process.env.TTS_SMOKE_PROVIDER === 'openai') {
      assert.equal(response.headers.get('content-type'), 'audio/wav');
      assert.equal(new TextDecoder().decode(audio.slice(0, 4)), 'RIFF');
      assert.equal(new DataView(audio).getUint32(24, true), 24000);
      assert.deepEqual((await (await call('/api/ai/tts')).json()).selectedTts, before.selectedTts, 'Preview must not persist its override');
    }
    const viewer = await (await call('/api/viewer')).json();
    assert.equal(viewer.remaining.audio, remainingBefore - input.length);
    console.log(`Live sample: ${response.headers.get('content-type')}, ${audio.byteLength} bytes; allowance charged once.`);
  }
  console.log('Guest TTS persistence, fallback, authorization, and catalog smoke checks passed.');
 } finally {
  try {
    if (cookie) {
      const tokenHash = createHash('sha256').update(cookie.slice('aistory_guest='.length)).digest('hex');
      await connection.db.collection('guestWorkspaces').deleteOne({ tokenHash, state: 'active' });
    }
  } finally { await connection.close(); }
}
