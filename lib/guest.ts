import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { GuestWorkspaceModel, UserModel } from '@/models';
import type { LlmConfig } from '@/types';

import { GUEST_DAYS } from '@/lib/guestLimits';
export { GUEST_DAYS } from '@/lib/guestLimits';
export const GUEST_COOKIE = 'aistory_guest';
mongoose.set('transactionAsyncLocalStorage', true);
export type Actor = { kind: 'user' | 'guest'; ownerEmail?: string; guestId?: string; filter: { ownerEmail: string } | { guestId: string }; isAdmin: boolean };

export function hashGuestToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
function encryptionKey() {
  const raw = process.env.GUEST_KEY_ENCRYPTION_SECRET;
  if (!raw) throw new Error('GUEST_KEY_ENCRYPTION_SECRET is required');
  return createHash('sha256').update(raw).digest();
}
export function encryptGuestKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}
export function decryptGuestKey(value?: string | null) {
  if (!value) return null;
  const [iv, tag, content] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(content), decipher.final()]).toString('utf8');
}

export async function getGuestWorkspace() {
  let token: string | undefined;
  try { token = (await cookies()).get(GUEST_COOKIE)?.value; } catch { return null; }
  if (!token) return null;
  await dbConnect();
  return GuestWorkspaceModel.findOne({ tokenHash: hashGuestToken(token), state: 'active', expiresAt: { $gt: new Date() } });
}

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (session?.user?.email) {
    await dbConnect();
    const user = await UserModel.findOne({ email: session.user.email }).select('isAdmin').lean();
    if (!user) return null;
    return { kind: 'user', ownerEmail: session.user.email, filter: { ownerEmail: session.user.email }, isAdmin: Boolean(user.isAdmin) };
  }
  const guest = await getGuestWorkspace();
  if (!guest) return null;
  return { kind: 'guest', guestId: guest.guestId, filter: { guestId: guest.guestId }, isAdmin: false };
}

export async function getOrCreateActor(): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;
  if ((await auth())?.user?.email) throw new Error('Account unavailable');
  const guest = await ensureGuestWorkspace();
  return { kind: 'guest', guestId: guest.guestId, filter: { guestId: guest.guestId }, isAdmin: false };
}

export async function ensureGuestWorkspace() {
  const existing = await getGuestWorkspace();
  if (existing) return existing;
  encryptionKey();
  if (process.env.NODE_ENV === 'production' && (process.env.GUEST_WRITES_ENABLED !== 'true' || !process.env.TRUSTED_CLIENT_IP_HEADER || !process.env.CRON_SECRET)) throw new Error('Guest workspaces are not enabled on this deployment');
  await dbConnect();
  const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('Guest workspaces require transaction-capable MongoDB');
  await GuestWorkspaceModel.init();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + GUEST_DAYS * 86_400_000);
  const guest = await GuestWorkspaceModel.create({ tokenHash: hashGuestToken(token), guestId: randomBytes(16).toString('hex'), expiresAt, state: 'active' });
  (await cookies()).set(GUEST_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
  return guest;
}

export async function guestSettings() {
  const guest = await getGuestWorkspace();
  if (!guest) return null;
  return { guest, selectedLlm: guest.selectedLlm as LlmConfig | null, apiKey: {
    together: decryptGuestKey(guest.encryptedKeys?.together),
    openAi: decryptGuestKey(guest.encryptedKeys?.openAi),
  } };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export function guardGuestMutation<T extends (...args: never[]) => Promise<Response>>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const actor = await getActor();
    if (!actor || actor.kind === 'user') return handler(...args);
    await dbConnect();
    return mongoose.connection.transaction(async () => {
      const held = await GuestWorkspaceModel.updateOne(
        { guestId: actor.guestId, state: 'active', expiresAt: { $gt: new Date() } },
        { $set: { lastMutationAt: new Date() } },
      );
      if (!held.matchedCount) return new Response(JSON.stringify({ error: { message: 'Guest workspace expired' } }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      return handler(...args);
    });
  }) as T;
}
