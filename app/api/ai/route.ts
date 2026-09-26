import { REQUEST_LIMITS } from '@/lib/guestLimits';
import { safeProviderError } from '@/lib/providerError';
import { getDynamicAiEndpoint } from '@/lib/aiEndpointDynamic';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { buildStreamErrorTail } from '@/lib/streamProtocol';
import { isAiGenerationFeature } from '@/lib/generationProfiles';
import { NextResponse } from 'next/server';
import { getActor } from '@/lib/guest';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { reserveTrial } from '@/lib/trial';

export async function POST(request: Request) {
  try {
    if (!await getActor()) return errorResponseFromMessage('Unauthorized', 401);
    const body = await request.json();
    const { systemMessage, messages, feature, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponseFromMessage('messages array is required', 400);
    }
    if (!isAiGenerationFeature(feature)) {
      return errorResponseFromMessage('feature is required and must be supported', 400);
    }

    if (Buffer.byteLength(JSON.stringify({ systemMessage, messages }), 'utf8') > REQUEST_LIMITS.textBytes) return errorResponseFromMessage('Text input is too large', 413);
    if (systemMessage != null && typeof systemMessage !== 'string' || messages.some((message) => !message || !['user', 'assistant', 'system'].includes(message.role) || typeof message.content !== 'string')) return errorResponseFromMessage('Invalid text messages', 400);
    const { endpoint: aiEndpoint, generationProfiles, selectedLlm } = await getDynamicAiEndpoint();
    const settings = await getActorGenerationSettings();
    if (settings.trialAccount && !settings.personal[settings.selectedLlm.service]) {
      const reservation = await reserveTrial(request, 'text', 1);
      if (!reservation.ok) return errorResponseFromMessage(reservation.message, reservation.status);
    }
    const generationProfile = generationProfiles[feature];

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            await aiEndpoint.chatStreamFull(
              systemMessage || null,
              messages,
              generationProfile,
              (content: string) => {
                controller.enqueue(encoder.encode(content));
              }
            );
          } catch (err) {
            controller.enqueue(encoder.encode(buildStreamErrorTail(safeProviderError(err))));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-AI-Service': selectedLlm.service,
          'X-AI-Model': encodeURIComponent(selectedLlm.model),
        },
      });
    }

    const result = await aiEndpoint.chatCompletionFull(
      systemMessage || null,
      messages,
      generationProfile
    );

    return NextResponse.json({ content: result });
  } catch (err) {
    return errorResponse(safeProviderError(err));
  }
}
