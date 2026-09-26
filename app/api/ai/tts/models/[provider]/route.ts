import { NextResponse } from 'next/server';
import { getTtsSettings } from '@/lib/ttsSettings';
import { fetchTtsModels, TtsError } from '@/lib/ttsCatalog';
import { errorResponseFromMessage } from '@/lib/apiError';
import { safeProviderError } from '@/lib/providerError';

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const settings = await getTtsSettings(new URL(request.url).searchParams.get('scope') ?? 'actor');
    const { provider } = await params;
    if (provider !== 'openai' && provider !== 'together') throw new TtsError('Unsupported TTS provider.');
    const service = provider === 'openai' ? 'openAi' : 'together';
    return NextResponse.json({ models: await fetchTtsModels(service, settings.apiKey[service], request.signal) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponseFromMessage(error instanceof TtsError ? error.message : safeProviderError(error).message, error instanceof TtsError ? error.status : 502);
  }
}
