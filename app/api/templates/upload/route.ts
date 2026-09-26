import { GUEST_STORAGE_LIMITS, REQUEST_LIMITS } from '@/lib/guestLimits';
import { NextResponse } from 'next/server';
import shortid from 'shortid';
import mongoose from 'mongoose';
import { getOrCreateActor, sameOrigin } from '@/lib/guest';
import { GuestUploadModel, GuestWorkspaceModel } from '@/models';
import dbConnect from '@/lib/mongodb';
import { uploadImage } from '@/lib/gcs';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = REQUEST_LIMITS.imageBytes;

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);
    const actor = await getOrCreateActor();
    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponseFromMessage('No file provided', 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponseFromMessage(
        'Invalid file type. Allowed: JPEG, PNG, WebP, GIF',
        400,
      );
    }

    if (file.size > MAX_SIZE) {
      return errorResponseFromMessage('File too large. Max size: 5MB', 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${shortid.generate()}.${ext}`;

    // Track the intended object before dispatch, including uploads abandoned mid-request.
    const imageUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/template-images/${fileName}`;
    if (actor.kind === 'guest') {
      await mongoose.connection.transaction(async () => {
        const guest = await GuestWorkspaceModel.findOneAndUpdate(
          { guestId: actor.guestId, state: 'active', expiresAt: { $gt: new Date() }, uploadCount: { $lt: GUEST_STORAGE_LIMITS.uploads } },
          { $inc: { uploadCount: 1 } }, { new: true },
        );
        if (!guest) throw new Error('Guest image limit reached or workspace expired');
        await GuestUploadModel.create({ guestId: actor.guestId, imageUrl, expiresAt: guest.expiresAt });
      });
      // Hold the workspace lock while writing the object so claim/cleanup cannot
      // move or remove the tracking record before the upload finishes.
      await mongoose.connection.transaction(async () => {
        const held = await GuestWorkspaceModel.updateOne(
          { guestId: actor.guestId, state: 'active', expiresAt: { $gt: new Date() } },
          { $set: { lastMutationAt: new Date() } },
        );
        if (!held.matchedCount) throw new Error('Guest workspace expired or claimed');
        await uploadImage(buffer, fileName, file.type);
      });
    } else {
      await uploadImage(buffer, fileName, file.type);
    }

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === 'Guest image limit reached or workspace expired') return errorResponseFromMessage(err.message, 429);
    return errorResponse(err);
  }
}
