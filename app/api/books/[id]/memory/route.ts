import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import dbConnect from '@/lib/mongodb';
import { BookModel } from '@/models';
import {
  applyMemoryPatch,
  getAssistantSegmentsThrough,
  normalizeLongTermMemoryState,
  parseMemoryPatchOperations,
  validateLongTermMemoryContent,
} from '@/lib/bookMemory';
import { fingerprintAssistantSegments } from '@/lib/bookMemoryGeneration';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const revisionFilter = (baseRevision: number) => baseRevision === 0
  ? { $or: [{ 'longTermMemory.revision': 0 }, { longTermMemory: { $exists: false } }] }
  : { 'longTermMemory.revision': baseRevision };

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const ownerEmail = session?.user?.email;
    if (!ownerEmail) return errorResponseFromMessage('Unauthorized', 401);

    const body = await request.json();
    const baseRevision = body?.baseRevision;
    const contentResult = validateLongTermMemoryContent(body?.content);
    if (!Number.isInteger(baseRevision) || baseRevision < 0 || !contentResult.ok) {
      return errorResponseFromMessage(contentResult.ok ? 'baseRevision is invalid' : contentResult.message, 400);
    }

    await dbConnect();
    const { id } = await params;
    const current = await BookModel.findOne({ bookId: id, ownerEmail }).select('longTermMemory');
    if (!current) return errorResponseFromMessage('Book not found', 404);
    const currentMemory = normalizeLongTermMemoryState(current.longTermMemory);
    if (currentMemory.revision !== baseRevision) {
      return errorResponseFromMessage('Long-term memory changed. Reload before saving.', 409);
    }

    const nextMemory = {
      content: contentResult.value,
      revision: baseRevision + 1,
      checkpoint: currentMemory.checkpoint,
      updatedAt: new Date().toISOString(),
    };
    const updated = await BookModel.findOneAndUpdate(
      { bookId: id, ownerEmail, ...revisionFilter(baseRevision) },
      { $set: { longTermMemory: nextMemory } },
      { new: true, runValidators: true },
    ).select('longTermMemory');

    if (!updated) return errorResponseFromMessage('Long-term memory changed. Reload before saving.', 409);
    return NextResponse.json(normalizeLongTermMemoryState(updated.longTermMemory));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const ownerEmail = session?.user?.email;
    if (!ownerEmail) return errorResponseFromMessage('Unauthorized', 401);

    const body = await request.json();
    const baseRevision = body?.baseRevision;
    const operationsResult = parseMemoryPatchOperations(body?.operations);
    const source = body?.source;
    const validMode = isRecord(source) && ['incremental', 'full'].includes(String(source.mode));
    if (!Number.isInteger(baseRevision) || baseRevision < 0 || !operationsResult.ok
      || !validMode
      || (source.previousThroughSegmentId !== null && typeof source.previousThroughSegmentId !== 'string')
      || typeof source.throughSegmentId !== 'string'
      || typeof source.fingerprint !== 'string') {
      return errorResponseFromMessage(
        operationsResult.ok ? 'Memory proposal payload is invalid.' : operationsResult.message,
        400,
      );
    }

    await dbConnect();
    const { id } = await params;
    const current = await BookModel.findOne({ bookId: id, ownerEmail });
    if (!current) return errorResponseFromMessage('Book not found', 404);
    const currentMemory = normalizeLongTermMemoryState(current.longTermMemory);
    if (currentMemory.revision !== baseRevision
      || currentMemory.checkpoint.throughSegmentId !== source.previousThroughSegmentId) {
      return errorResponseFromMessage('The memory proposal is stale. Generate it again.', 409);
    }

    const processedSegments = getAssistantSegmentsThrough(current.storySegments, source.throughSegmentId);
    if (!processedSegments || fingerprintAssistantSegments(processedSegments) !== source.fingerprint) {
      return errorResponseFromMessage('The narration analyzed by this proposal changed. Generate it again.', 409);
    }

    const applied = applyMemoryPatch(currentMemory.content, operationsResult.value);
    if (!applied.ok) return errorResponseFromMessage(applied.message, 400);

    const nextMemory = {
      content: applied.value,
      revision: baseRevision + 1,
      checkpoint: {
        throughSegmentId: source.throughSegmentId,
        fingerprint: source.fingerprint,
      },
      updatedAt: new Date().toISOString(),
    };
    const updated = await BookModel.findOneAndUpdate(
      {
        _id: current._id,
        ownerEmail,
        updatedAt: current.updatedAt,
        ...revisionFilter(baseRevision),
      },
      { $set: { longTermMemory: nextMemory } },
      { new: true, runValidators: true },
    ).select('longTermMemory');

    if (!updated) return errorResponseFromMessage('The book changed while accepting the proposal. Generate it again.', 409);
    return NextResponse.json(normalizeLongTermMemoryState(updated.longTermMemory));
  } catch (error) {
    return errorResponse(error);
  }
}
