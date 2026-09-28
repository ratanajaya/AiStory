import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import dbConnect from '@/lib/mongodb';
import { BookModel, GuestUploadModel, GuestWorkspaceModel, TemplateModel, UserModel } from '@/models';
import { decryptGuestKey, GUEST_COOKIE, hashGuestToken, sameOrigin } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import _util from '@/utils/_util';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
  const session = await auth();
  if (!session?.user?.email) return errorResponseFromMessage('Unauthorized', 401);
  const accountEmail = session.user.email;
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (!token) return NextResponse.json({ claimed: false });
  try {
    await dbConnect();
    let result: { claimed: boolean; preservedKeys?: string[] } = { claimed: false };
    await mongoose.connection.transaction(async (dbSession) => {
      const guest = await GuestWorkspaceModel.findOne({ tokenHash: hashGuestToken(token) }).session(dbSession);
      if (!guest || guest.state === 'claimed' && guest.claimedBy === accountEmail) {
        result = { claimed: Boolean(guest) };
        return;
      }
      if (guest.state !== 'active' || guest.expiresAt <= new Date()) throw new Error('Guest workspace unavailable');
      const user = await UserModel.findOne({ email: accountEmail }).session(dbSession);
      if (!user) throw new Error('Account not found');
      const acquired = await GuestWorkspaceModel.updateOne({ _id: guest._id, state: 'active', expiresAt: { $gt: new Date() } }, { $set: { state: 'claimed', claimedBy: accountEmail, claimedExpiresAt: new Date(Date.now() + 86_400_000) }, $unset: { encryptedKeys: '' } }, { session: dbSession });
      if (!acquired.matchedCount) throw new Error('Guest workspace unavailable');
      const preservedKeys: string[] = [];
      const updates: Record<string, unknown> = {};
      for (const provider of ['together', 'openAi'] as const) {
        const key = decryptGuestKey(guest.encryptedKeys?.[provider]);
        if (!key) continue;
        if (_util.toInputString(user.apiKey?.[provider])) preservedKeys.push(provider);
        else updates[`apiKey.${provider}`] = key;
      }
      if (!user.selectedTts && guest.selectedTts) updates.selectedTts = guest.selectedTts;
      if (!user.selectedLlm && guest.selectedLlm) updates.selectedLlm = guest.selectedLlm;
      if (user.trialAccount) {
        updates.trialTextUsed = Math.max(user.trialTextUsed || 0, guest.trialTextUsed || 0);
        updates.trialAudioUsed = Math.max(user.trialAudioUsed || 0, guest.trialAudioUsed || 0);
      }
      if (Object.keys(updates).length) await UserModel.updateOne({ _id: user._id }, { $set: updates }, { session: dbSession });
      for (const model of [BookModel, TemplateModel]) {
        await model.updateMany({ guestId: guest.guestId }, { $set: { ownerEmail: accountEmail }, $unset: { guestId: '', expiresAt: '' } }, { session: dbSession });
      }
      await GuestUploadModel.updateMany({ guestId: guest.guestId }, { $set: { ownerEmail: accountEmail }, $unset: { guestId: '', expiresAt: '' } }, { session: dbSession });
      result = { claimed: true, preservedKeys };
    });
    jar.delete(GUEST_COOKIE);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Guest workspace unavailable') return errorResponseFromMessage(error.message, 409);
    return errorResponse(error);
  }
}
