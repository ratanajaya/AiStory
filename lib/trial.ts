import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { GuestIpUsageModel, GuestWorkspaceModel, UserModel } from '@/models';
import { getActor } from '@/lib/guest';

import { TRIAL_LIMITS, IP_LIMITS } from '@/lib/guestLimits';
export { TRIAL_LIMITS, IP_LIMITS } from '@/lib/guestLimits';
type UsageKind = keyof typeof TRIAL_LIMITS;

function ipKey(request: Request) {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  const ip = header ? request.headers.get(header) : process.env.NODE_ENV === 'production' ? null : 'local';
  if (!ip) throw new Error('Trusted client IP configuration is required for guest trial use');
  const date = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${date}:${ip}`).digest('hex');
}
export async function remainingTrial(request: Request) {
  const actor = await getActor();
  if (!actor) return null;
  await dbConnect();
  if (actor.kind === 'user') {
    const user = await UserModel.findOne({ email: actor.ownerEmail }).select('trialAccount trialTextUsed trialAudioUsed').lean();
    if (!user?.trialAccount) return null;
    return { text: Math.max(0, TRIAL_LIMITS.text - (user.trialTextUsed || 0)), audio: Math.max(0, TRIAL_LIMITS.audio - (user.trialAudioUsed || 0)) };
  }
  const guest = await GuestWorkspaceModel.findOne({ guestId: actor.guestId, state: 'active', expiresAt: { $gt: new Date() } }).lean();
  if (!guest) return null;
  const usage = await GuestIpUsageModel.findOne({ key: ipKey(request) }).lean();
  return { text: Math.max(0, Math.min(TRIAL_LIMITS.text - guest.trialTextUsed, IP_LIMITS.text - (usage?.textUsed || 0))), audio: Math.max(0, Math.min(TRIAL_LIMITS.audio - guest.trialAudioUsed, IP_LIMITS.audio - (usage?.audioUsed || 0))) };
}

export async function reserveTrial(request: Request, kind: UsageKind, amount: number) {
  const actor = await getActor();
  if (!actor) return { ok: false as const, status: 401, message: 'Unauthorized' };
  const limit = TRIAL_LIMITS[kind];
  if (!Number.isInteger(amount) || amount < 1 || amount > limit) return { ok: false as const, status: 400, message: 'Invalid usage amount' };
  await dbConnect();
  const field = kind === 'text' ? 'trialTextUsed' : 'trialAudioUsed';
  if (actor.kind === 'user') {
    const result = await UserModel.updateOne({ email: actor.ownerEmail, trialAccount: true, [field]: { $lte: limit - amount } }, { $inc: { [field]: amount } });
    return result.matchedCount ? { ok: true as const } : { ok: false as const, status: 429, message: 'Free trial exhausted. Add your own API key to continue.' };
  }
  const key = ipKey(request);
  await GuestIpUsageModel.init();
  const now = new Date();
  const midnight = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const expiresAt = new Date(midnight.getTime() + 86_400_000);
  try {
    try { await GuestIpUsageModel.updateOne({ key }, { $setOnInsert: { expiresAt } }, { upsert: true }); } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error; }
    await mongoose.connection.transaction(async (session) => {
      const guest = await GuestWorkspaceModel.updateOne({ guestId: actor.guestId, state: 'active', expiresAt: { $gt: now }, [field]: { $lte: limit - amount } }, { $inc: { [field]: amount } }, { session });
      if (!guest.matchedCount) throw new Error('quota');
      const ipField = kind === 'text' ? 'textUsed' : 'audioUsed';
      const ip = await GuestIpUsageModel.updateOne({ key, [ipField]: { $lte: IP_LIMITS[kind] - amount } }, { $inc: { [ipField]: amount } }, { session });
      if (!ip.matchedCount) throw new Error('quota');
    });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof Error && error.message === 'quota') return { ok: false as const, status: 429, message: 'Free trial exhausted. Add your own API key to continue.' };
    throw error;
  }
}
