import dbConnect from '@/lib/mongodb';
import { BookModel, GuestUploadModel, GuestWorkspaceModel, TemplateModel } from '@/models';
import { deleteImageOrThrow } from '@/lib/gcs';

export async function cleanupExpiredGuests() {
  await dbConnect();
  let cleaned = 0;
  let failed = 0;
  const expired = GuestWorkspaceModel.find({ $or: [{ state: 'active', expiresAt: { $lte: new Date() } }, { state: 'cleaning' }] }).cursor();
  for await (const guest of expired) {
    try {
      const locked = await GuestWorkspaceModel.updateOne({ _id: guest._id, state: guest.state }, { $set: { state: 'cleaning' } });
      if (!locked.matchedCount) continue;
      await BookModel.deleteMany({ guestId: guest.guestId });
      await TemplateModel.deleteMany({ guestId: guest.guestId });
      const uploads = await GuestUploadModel.find({ guestId: guest.guestId });
      for (const upload of uploads) {
        await deleteImageOrThrow(upload.imageUrl);
        await GuestUploadModel.deleteOne({ _id: upload._id });
      }
      await GuestWorkspaceModel.deleteOne({ _id: guest._id, state: 'cleaning' });
      cleaned++;
    } catch { failed++; console.error('Guest cleanup failed', guest.guestId); }
  }
  return { cleaned, failed };
}
