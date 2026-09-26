import { REQUEST_LIMITS } from '@/lib/guestLimits';
import { safeProviderError } from '@/lib/providerError';
import { getDynamicTtsEndpoint } from '@/lib/ttsEndpointDynamic';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { getActor } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { reserveTrial } from '@/lib/trial';

export async function POST(request: Request) {
  try {
    if (!await getActor()) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json();
    const input = typeof body?.input === 'string' ? body.input.trim() : '';

    if (!input) {
      return errorResponseFromMessage('input is required', 400);
    }

    if (input.length > REQUEST_LIMITS.audioCharacters) return errorResponseFromMessage('Audio input is too long', 413);
    const ttsEndpoint = await getDynamicTtsEndpoint();
    const settings = await getActorGenerationSettings();
    if (settings.trialAccount && !settings.personal.together) {
      const reservation = await reserveTrial(request, 'audio', input.length);
      if (!reservation.ok) return errorResponseFromMessage(reservation.message, reservation.status);
    }
    const { audioBuffer, contentType } = await ttsEndpoint.generateAudio(input);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(safeProviderError(err));
  }
}
