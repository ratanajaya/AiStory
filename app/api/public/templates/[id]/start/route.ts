import { GUEST_STORAGE_LIMITS } from '@/lib/guestLimits';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import shortid from 'shortid';
import dbConnect from '@/lib/mongodb';
import { BookModel, GuestWorkspaceModel, KeyValueModel, TemplateModel } from '@/models';
import { getOrCreateActor, sameOrigin } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import type { DefaultValue, PromptBuilderConfig } from '@/types';
import _util from '@/utils/_util';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
  try {
    const actor = await getOrCreateActor();
    await dbConnect();
    const { id } = await params;
    let bookId: string | null = null;
    await mongoose.connection.transaction(async (session) => {
      if (actor.kind === 'guest') {
        const alive = await GuestWorkspaceModel.updateOne({ guestId: actor.guestId, state: 'active', expiresAt: { $gt: new Date() } }, { $set: { lastMutationAt: new Date() } }, { session });
        if (!alive.matchedCount) throw new Error('Guest workspace expired');
        const bookCount = await BookModel.countDocuments({ guestId: actor.guestId }).session(session);
        const templateCount = await TemplateModel.countDocuments({ guestId: actor.guestId }).session(session);
        if (bookCount >= GUEST_STORAGE_LIMITS.books || templateCount >= GUEST_STORAGE_LIMITS.templates) throw new Error('Guest storage limit reached');
      }
      const original = await TemplateModel.findOne({ templateId: id, isPublic: true, ownerEmail: { $exists: true } }).session(session).lean();
      if (!original) throw new Error('Public template not found');
      const defaultDoc = await KeyValueModel.findOne({ key: 'defaultValue' }).session(session).lean();
      const defaults = (defaultDoc?.value as DefaultValue | undefined)?.promptBuilder;
      const promptBuilder = Object.fromEntries(Object.entries(_util.normalizePromptBuilderConfig(original.promptBuilder)).map(([key, value]) => [key, defaults ? _util.mergeNormalizedString(value, defaults[key as keyof PromptBuilderConfig]) : value]));
      const templateId = shortid.generate();
      bookId = shortid.generate();
      const expiresAt = actor.kind === 'guest' ? (await GuestWorkspaceModel.findOne({ guestId: actor.guestId }).session(session))?.expiresAt : undefined;
      const ownership = { ...actor.filter, ...(expiresAt ? { expiresAt } : {}) };
      await TemplateModel.create([{ templateId, name: original.name, storyBackground: original.storyBackground, writingStyle: original.writingStyle, imageUrl: original.imageUrl, promptBuilder, isPublic: false, ...ownership }], { session });
      await BookModel.create([{ bookId, templateId, name: null, storySegments: [], segmentSummaries: [], chapters: [], ...ownership }], { session });
    });
    return NextResponse.json({ bookId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Public template not found') return errorResponseFromMessage(error.message, 404);
    if (error instanceof Error && (error.message === 'Guest storage limit reached' || error.message === 'Guest workspace expired')) return errorResponseFromMessage(error.message, 409);
    return errorResponse(error);
  }
}
