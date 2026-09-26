import { safeProviderError } from '@/lib/providerError';
import { NextResponse } from 'next/server';
import { getActor } from '@/lib/guest';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import dbConnect from '@/lib/mongodb';
import { BookModel, TemplateModel } from '@/models';
import { normalizeLongTermMemoryState } from '@/lib/bookMemory';
import { generateLongTermMemoryProposal, MemoryGenerationError } from '@/lib/bookMemoryGeneration';
import type { Book, MemoryProposalMode, Template } from '@/types';

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);
    const ownership = actor.filter;

    const body = await request.json();
    const mode: MemoryProposalMode | null = body?.mode === 'incremental' || body?.mode === 'full'
      ? body.mode
      : null;
    if (!mode || !Number.isInteger(body?.baseRevision) || body.baseRevision < 0) {
      return errorResponseFromMessage('mode and baseRevision are required.', 400);
    }

    await dbConnect();
    const { id } = await params;
    const bookDoc = await BookModel.findOne({ bookId: id, ...ownership }).lean();
    if (!bookDoc) return errorResponseFromMessage('Book not found', 404);
    const memory = normalizeLongTermMemoryState(bookDoc.longTermMemory);
    if (memory.revision !== body.baseRevision) {
      return errorResponseFromMessage('Long-term memory changed. Reload before generating a proposal.', 409);
    }

    const templateDoc = await TemplateModel.findOne({ templateId: bookDoc.templateId, ...ownership }).lean();
    if (!templateDoc) return errorResponseFromMessage('Book template not found', 404);

    const proposal = await generateLongTermMemoryProposal({
      book: { ...bookDoc, longTermMemory: memory } as unknown as Book,
      template: templateDoc as unknown as Template,
      mode,
      request,
    });
    return NextResponse.json(proposal);
  } catch (error) {
    if (error instanceof MemoryGenerationError) {
      return errorResponse(error.status >= 500 ? safeProviderError(error) : new Error(error.message), error.status);
    }
    return errorResponse(safeProviderError(error), 500);
  }
}
