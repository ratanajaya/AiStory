import { NextResponse } from 'next/server';
import { REQUEST_LIMITS } from '@/lib/guestLimits';
import { safeProviderError } from '@/lib/providerError';
import { getDynamicTtsEndpoint } from '@/lib/ttsEndpointDynamic';
import { errorResponseFromMessage } from '@/lib/apiError';
import { getTtsSettings } from '@/lib/ttsSettings';
import { fetchTtsModels, TtsError } from '@/lib/ttsCatalog';
import { ttsCacheConfigId, validateTtsConfig } from '@/lib/ttsConfig';
import { reserveTrial } from '@/lib/trial';

const failure = (error: unknown) => errorResponseFromMessage(error instanceof TtsError ? error.message : safeProviderError(error).message, error instanceof TtsError ? error.status : 502);

export async function GET(request: Request) {
  try {
    const settings = await getTtsSettings(new URL(request.url).searchParams.get('scope') ?? 'actor');
    return NextResponse.json({ selectedTts: settings.selectedTts, configId: ttsCacheConfigId(settings.selectedTts) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    // Authenticate before parsing the request; defaults scope is restricted separately.
    const settings = await getTtsSettings(new URL(request.url).searchParams.get('scope') ?? 'actor');
    const body = await request.json().catch(() => { throw new TtsError('Invalid JSON body.'); });
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TtsError('Invalid TTS request.');
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    if (!input) throw new TtsError('input is required');
    if (input.length > REQUEST_LIMITS.audioCharacters) throw new TtsError('Audio input is too long', 413);
    const result = validateTtsConfig(body.selectedTts);
    if (!result.ok) throw new TtsError(result.message);
    const config = result.value ?? settings.selectedTts;
    const apiKey = settings.apiKey[config.service];
    const models = await fetchTtsModels(config.service, apiKey, request.signal);
    const model = models.find(model => model.id === config.model);
    if (!model || !model.voices.some(voice => voice.id === config.voice)) throw new TtsError('The selected TTS model or voice is unavailable. Choose another in settings.');
    if (settings.trialAccount && !settings.personal[config.service]) {
      const reservation = await reserveTrial(request, 'audio', input.length);
      if (!reservation.ok) return errorResponseFromMessage(reservation.message, reservation.status);
    }
    const { audioBuffer, contentType } = await getDynamicTtsEndpoint(config, apiKey!, request.signal).generateAudio(input);
    return new Response(audioBuffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-TTS-Config-Id': ttsCacheConfigId(config) } });
  } catch (error) { return failure(error); }
}
