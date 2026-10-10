import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getActor, sameOrigin } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { resolveTtsConfig } from '@/lib/ttsConfig';
import { BookModel, ReleasedBookModel, ReleaseAttemptModel } from '@/models';
import { errorResponseFromMessage } from '@/lib/apiError';
import { parseReleaseFiles, releaseSnapshot } from '@/lib/releaseValidation';
import { releaseUploadUrl, verifyReleaseAudio } from '@/lib/releaseStorage';
import type { ReleaseFile, ReleasedBook, ReleasedSegment } from '@/lib/releaseTypes';
export class ReleaseError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function releaseOwner(request: Request) {
  const actor = await getActor();
  if (!actor) throw new ReleaseError('Sign in to release and view books', 401);
  if (actor.kind !== 'user' || !actor.ownerEmail) throw new ReleaseError('Sign in and claim your book before releasing it', 403);
  if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request)) throw new ReleaseError('Invalid origin', 403);
  await dbConnect(); return actor.ownerEmail;
}
export function releaseErrorResponse(error: unknown) {
  if (error instanceof ReleaseError) return errorResponseFromMessage(error.message, error.status);
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return errorResponseFromMessage('Another release was published. Please retry.', 409);
  return errorResponseFromMessage('The release request failed. Please retry.', 500);
}
export async function startRelease(ownerEmail: string, bookId: string) {
  const book = await BookModel.findOne({ ownerEmail, bookId }).lean();
  if (!book) throw new ReleaseError('Book not found', 404);
  const snapshot = releaseSnapshot(book);
  if (!snapshot.segments.length) throw new ReleaseError('Save at least one assistant segment before releasing');
  const existing = await ReleasedBookModel.findOne({ ownerEmail, sourceBookId: bookId }).lean();
  const settings = await getActorGenerationSettings();
  const selectedTts = resolveTtsConfig(settings.selectedTts);
  const attemptId = randomUUID();
  await ReleaseAttemptModel.create({ attemptId, ownerEmail, sourceBookId: bookId, releaseId: existing?.releaseId ?? randomUUID(),
    baseRevision: existing?.revision ?? 0, ...snapshot, selectedTts, expiresAt: new Date(Date.now() + 86400000) });
  return { attemptId, title: snapshot.title, segments: snapshot.segments, selectedTts, replacing: Boolean(existing) };
}
async function stagingAttempt(ownerEmail: string, attemptId: string) {
  const attempt = await ReleaseAttemptModel.findOne({ ownerEmail, attemptId }).lean();
  if (!attempt) throw new ReleaseError('Release attempt not found', 404);
  if (attempt.state !== 'staging' || attempt.expiresAt <= new Date()) throw new ReleaseError('Release attempt expired or unavailable. Please retry.', 409);
  return attempt;
}
export async function authorizeReleaseUploads(ownerEmail: string, attemptId: string, body: unknown) {
  const attempt = await stagingAttempt(ownerEmail, attemptId);
  if (attempt.manifestSet) throw new ReleaseError('Upload manifest already submitted. Please start a new attempt.', 409);
  const parsed = parseReleaseFiles(body, attempt.segments);
  if (!parsed) throw new ReleaseError('Invalid audio manifest or release exceeds 100 MiB');
  const files: ReleaseFile[] = parsed.map((file, index) => ({ ...file, objectKey: `releases/${attemptId}/${index}` }));
  const held = await ReleaseAttemptModel.updateOne({ ownerEmail, attemptId, state: 'staging', manifestSet: false, expiresAt: { $gt: new Date() } }, { $set: { files, manifestSet: true } });
  if (!held.modifiedCount) throw new ReleaseError('Release attempt changed. Please retry.', 409);
  try {
    return { uploads: await Promise.all(files.map(async file => ({ ...file, url: await releaseUploadUrl(file) }))) };
  } catch { throw new ReleaseError('Private audio storage is unavailable. Check release bucket configuration and retry.', 503); }
}
export async function commitRelease(ownerEmail: string, attemptId: string) {
  const prior = await ReleaseAttemptModel.findOne({ ownerEmail, attemptId }).lean();
  if (!prior) throw new ReleaseError('Release attempt not found', 404);
  if (prior.committedRevision) return { releaseId: prior.releaseId, revision: prior.committedRevision };
  const staged = await stagingAttempt(ownerEmail, attemptId);
  if (!staged.manifestSet) throw new ReleaseError('Submit the audio manifest before publishing', 409);
  try { for (const file of staged.files as ReleaseFile[]) await verifyReleaseAudio(file); }
  catch { throw new ReleaseError('Audio upload is missing or invalid. Please retry the release.', 409); }
  let result!: { releaseId: string; revision: number };
  await mongoose.connection.transaction(async session => {
    const attempt = await ReleaseAttemptModel.findOne({ ownerEmail, attemptId }).session(session).lean();
    if (attempt?.committedRevision) { result = { releaseId: attempt.releaseId, revision: attempt.committedRevision }; return; }
    if (!attempt || attempt.state !== 'staging' || attempt.expiresAt <= new Date()) throw new ReleaseError('Release attempt unavailable', 409);
    const book = await BookModel.findOne({ ownerEmail, bookId: attempt.sourceBookId }).session(session).lean();
    if (!book || releaseSnapshot(book).fingerprint !== attempt.fingerprint) throw new ReleaseError('The book changed. Please start a new release.', 409);
    // Acquire a source-document write lock without changing saved content or its timestamp.
    const locked = await BookModel.updateOne({ ownerEmail, bookId: attempt.sourceBookId, updatedAt: book.updatedAt }, { $set: { updatedAt: book.updatedAt } }, { session, timestamps: false });
    if (!locked.matchedCount) throw new ReleaseError('The book changed. Please retry.', 409);
    const files = attempt.files as ReleaseFile[];
    const segments: ReleasedSegment[] = attempt.segments.map((segment: ReleasedSegment) => {
      const audio = files.filter(f => f.segmentId === segment.id).sort((a, b) => a.partIndex - b.partIndex);
      return { id: segment.id, content: segment.content, expectedAudioParts: audio.some(f => f.whole) ? 1 : segment.expectedAudioParts,
        audio: audio.map(({ partIndex, objectKey, mimeType, byteSize }) => ({ partIndex, objectKey, mimeType, byteSize })) };
    });
    const revision = attempt.baseRevision + 1;
    const value = { releaseId: attempt.releaseId, sourceBookId: attempt.sourceBookId, ownerEmail, title: attempt.title, releasedAt: new Date().toISOString(), revision, segments };
    if (attempt.baseRevision === 0) await ReleasedBookModel.create([value], { session });
    else {
      const changed = await ReleasedBookModel.updateOne({ ownerEmail, sourceBookId: attempt.sourceBookId, revision: attempt.baseRevision }, { $set: value }, { session });
      if (!changed.modifiedCount) throw new ReleaseError('Another release was published. Please retry.', 409);
    }
    await ReleaseAttemptModel.updateMany({ ownerEmail, releaseId: attempt.releaseId, state: 'published' }, { $set: { state: 'superseded', expiresAt: new Date(Date.now() + 86400000) } }, { session });
    await ReleaseAttemptModel.updateOne({ ownerEmail, attemptId, state: 'staging' }, { $set: { state: 'published', committedRevision: revision } }, { session });
    result = { releaseId: attempt.releaseId, revision };
  });
  return result;
}
export async function ownedRelease(ownerEmail: string, releaseId: string): Promise<ReleasedBook> {
  const book = await ReleasedBookModel.findOne({ ownerEmail, releaseId }).lean();
  if (!book) throw new ReleaseError('Released book not found', 404);
  return book as ReleasedBook;
}
export function releasedBookResponse(book: ReleasedBook) {
  return { releaseId: book.releaseId, title: book.title, releasedAt: book.releasedAt, revision: book.revision,
    segments: book.segments.map(s => ({ id: s.id, content: s.content, expectedAudioParts: s.expectedAudioParts,
      audio: s.audio.map(a => ({ partIndex: a.partIndex, mimeType: a.mimeType,
        url: `/api/released-books/${book.releaseId}/audio/${encodeURIComponent(s.id)}/${a.partIndex}?revision=${book.revision}` })) })) };
}
export { NextResponse };
