import { NextResponse } from 'next/server';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getModelCatalogApiKey } from '@/lib/modelCatalogSettings';
import { fetchOpenAiTextModels, OpenAiModelsError } from '@/lib/openAiModels';

export async function POST(request: Request) {
  try {
    const apiKey = await getModelCatalogApiKey(request, 'openAi');
    if (typeof apiKey !== 'string') return apiKey;
    if (!apiKey) return errorResponseFromMessage('OpenAI API key is required to load models.', 400);

    return NextResponse.json({ models: await fetchOpenAiTextModels(apiKey) });
  } catch (error) {
    if (error instanceof OpenAiModelsError) return errorResponseFromMessage(error.message, error.status);
    return errorResponseFromMessage('Could not load OpenAI models.', 502);
  }
}
