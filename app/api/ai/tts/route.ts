import { getDynamicTtsEndpoint } from '@/lib/ttsEndpointDynamic';
import { errorResponse, errorResponseFromMessage } from '@/lib/apiError';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = typeof body?.input === 'string' ? body.input.trim() : '';

    if (!input) {
      return errorResponseFromMessage('input is required', 400);
    }

    const ttsEndpoint = await getDynamicTtsEndpoint();
    const { audioBuffer, contentType } = await ttsEndpoint.generateAudio(input);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
