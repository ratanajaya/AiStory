import { createHash, randomUUID } from 'node:crypto';
import nextEnv from '@next/env';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const actor = vi.hoisted(() => ({ guestId: '' }));
vi.mock('@/lib/guest', () => ({ getActor: async () => ({ kind: 'guest', guestId: actor.guestId }) }));
vi.mock('@/lib/mongodb', () => ({ default: async () => {} }));
import { GuestIpUsageModel, GuestWorkspaceModel } from '@/models';
import { remainingTrial, reserveTrial } from './trial';

// Opt-in: uses only randomized test identifiers and removes its own records.
describe.runIf(process.env.RUN_GUEST_DB_TESTS === 'true')('MongoDB concurrent trial reservations', () => {
  const ip = `integration-${randomUUID()}`;
  const guestIds = [randomUUID(), randomUUID()];
  let ipKey = '';
  const request = new Request('http://localhost/api/ai', { headers: { 'x-test-guest-ip': ip } });
  beforeAll(async () => {
    nextEnv.loadEnvConfig(process.cwd());
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-test-guest-ip');
    await mongoose.connect(process.env.MONGO_URI!, { dbName: process.env.MONGO_DB_NAME, ...(process.env.MONGO_TLS_INSECURE === 'true' ? { tls: true, tlsAllowInvalidCertificates: true } : {}) });
    await GuestWorkspaceModel.init();
    await GuestIpUsageModel.init();
    ipKey = createHash('sha256').update(`${new Date().toISOString().slice(0, 10)}:${ip}`).digest('hex');
    for (const guestId of guestIds) await GuestWorkspaceModel.create({ guestId, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60000), state: 'active' });
  });
  afterAll(async () => {
    await GuestWorkspaceModel.deleteMany({ guestId: { $in: guestIds } });
    if (ipKey) await GuestIpUsageModel.deleteOne({ key: ipKey });
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });
  it('permits exactly 20 simultaneous text calls without overshooting', async () => {
    actor.guestId = guestIds[0];
    const results = await Promise.all(Array.from({ length: 30 }, () => reserveTrial(request, 'text', 1)));
    expect(results.filter((result) => result.ok)).toHaveLength(20);
    expect((await GuestWorkspaceModel.findOne({ guestId: actor.guestId }))!.trialTextUsed).toBe(20);
    expect((await GuestIpUsageModel.findOne({ key: ipKey }))!.textUsed).toBe(20);
    expect((await remainingTrial(request))!.text).toBe(0);
  }, 30000);
  it('rolls back workspace consumption when the IP has no allowance', async () => {
    actor.guestId = guestIds[1];
    await GuestIpUsageModel.updateOne({ key: ipKey }, { $set: { textUsed: 60 } });
    expect(await reserveTrial(request, 'text', 1)).toMatchObject({ ok: false, status: 429 });
    expect((await GuestWorkspaceModel.findOne({ guestId: actor.guestId }))!.trialTextUsed).toBe(0);
  });
});
