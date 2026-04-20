import { getDynamicTtsEndpoint } from '@/lib/ttsEndpointDynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = typeof body?.input === 'string' ? body.input.trim() : '';

    if (!input) {
      return new Response(
        JSON.stringify({ error: 'input is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
  } catch (error) {
    console.error('TTS API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process TTS request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}