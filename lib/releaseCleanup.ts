import dbConnect from '@/lib/mongodb';
import { ReleaseAttemptModel, ReleasedBookModel } from '@/models';
import { deleteReleaseAudio } from '@/lib/releaseStorage';
import type { ReleaseFile } from '@/lib/releaseTypes';
export async function cleanupReleaseUploads() {
  await dbConnect(); let cleaned = 0; let failed = 0;
  const attempts = ReleaseAttemptModel.find({ state: { $in: ['staging', 'superseded', 'cleaning'] }, expiresAt: { $lte: new Date() } }).cursor();
  for await (const attempt of attempts) {
    try {
      const held = await ReleaseAttemptModel.updateOne({ attemptId: attempt.attemptId, state: attempt.state, expiresAt: { $lte: new Date() } }, { $set: { state: 'cleaning' } });
      if (!held.matchedCount) continue;
      for (const file of attempt.files as ReleaseFile[]) {
        const active = await ReleasedBookModel.exists({ 'segments.audio.objectKey': file.objectKey });
        if (active) throw new Error('Release audio is still referenced');
        await deleteReleaseAudio(file.objectKey);
      }
      await ReleaseAttemptModel.deleteOne({ attemptId: attempt.attemptId, state: 'cleaning' }); cleaned++;
    } catch { failed++; }
  }
  return { cleaned, failed };
}
