import { NextResponse } from 'next/server';
import { getActor, sameOrigin } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { createConfiguredAiEndpoint } from '@/lib/aiEndpointDynamic';
import { getAutocompleteKey } from '@/lib/autocompleteSettings';
import {
  autocompleteProfile,
  autocompleteSystemMessage,
  isAutocompleteRequest,
  normalizeAutocompleteSuffix,
  type AutocompleteResponse,
} from '@/lib/autocomplete';
import { errorResponseFromMessage } from '@/lib/apiError';
import { safeProviderError } from '@/lib/providerError';
import { BookModel } from '@/models';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return errorResponseFromMessage('Invalid origin', 403);

  try {
    const actor = await getActor();
    if (!actor) return errorResponseFromMessage('Unauthorized', 401);

    const input: unknown = await request.json().catch(() => null);
    if (!isAutocompleteRequest(input)) return errorResponseFromMessage('Invalid autocomplete request.', 400);

    const settings = await getActorGenerationSettings(actor);
    const model = settings.autocompleteModel;
    if (!model) return errorResponseFromMessage('Autocomplete is off.', 403);
    const apiKey = getAutocompleteKey(actor, settings);
    if (!apiKey) return errorResponseFromMessage('Configure an API key for the autocomplete provider.', 403);

    const book = await BookModel.exists({ bookId: input.bookId, ...actor.filter });
    if (!book) return errorResponseFromMessage('Book not found', 404);

    request.signal.throwIfAborted();
    const endpoint = createConfiguredAiEndpoint(model, apiKey, false, settings.autocompletePayload);
    const text = await endpoint.chatCompletionFull(
      autocompleteSystemMessage,
      [{ role: 'user', content: input.draftTail }],
      autocompleteProfile,
      { abortSignal: request.signal, allowEmpty: true },
    );
    return NextResponse.json<AutocompleteResponse>({ suffix: normalizeAutocompleteSuffix(text, input.draftTail) });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return errorResponseFromMessage(safeProviderError(error).message, 502);
  }
}
