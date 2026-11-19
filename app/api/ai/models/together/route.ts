import { NextResponse } from 'next/server';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getModelCatalogApiKey } from '@/lib/modelCatalogSettings';
import { fetchTogetherChatModels, TogetherModelsError } from '@/lib/togetherModels';

export async function POST(request: Request) {
  try {
    const apiKey = await getModelCatalogApiKey(request, 'together');
    if (typeof apiKey !== 'string') return apiKey;
    if (!apiKey) return errorResponseFromMessage('Together API key is required to load models.', 400);

    return NextResponse.json({ models: await fetchTogetherChatModels(apiKey) });
  } catch (error) {
    if (error instanceof TogetherModelsError) return errorResponseFromMessage(error.message, error.status);
    return errorResponseFromMessage('Could not load Together AI models.', 502);
  }
}
