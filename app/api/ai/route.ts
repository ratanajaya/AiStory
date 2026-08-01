import { getDynamicAiEndpoint } from '@/lib/aiEndpointDynamic';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';
import { buildStreamErrorTail } from '@/lib/streamProtocol';
import { isAiGenerationFeature } from '@/lib/generationProfiles';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { systemMessage, messages, feature, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponseFromMessage('messages array is required', 400);
    }
    if (!isAiGenerationFeature(feature)) {
      return errorResponseFromMessage('feature is required and must be supported', 400);
    }

    const { endpoint: aiEndpoint, generationProfiles } = await getDynamicAiEndpoint();
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
            console.error('Streaming error:', err);
            controller.enqueue(encoder.encode(buildStreamErrorTail(err)));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
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
    return errorResponse(err);
  }
}
