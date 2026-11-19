import { NextResponse } from 'next/server';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getModelCatalogApiKey } from '@/lib/modelCatalogSettings';
import { fetchRefuselessModels } from '@/lib/refuseless';

export async function POST(request: Request) {
  try {
    const apiKey = await getModelCatalogApiKey(request, 'refuseless');
    if (typeof apiKey !== 'string') return apiKey;

    const models = await fetchRefuselessModels(apiKey, request.signal);
    return NextResponse.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return errorResponseFromMessage('Could not load Refuseless models. Check your API key and try again.', 502);
  }
}
