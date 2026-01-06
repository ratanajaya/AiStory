import { getDynamicAiEndpoint } from '@/lib/aiEndpointDynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { systemMessage, messages, stream = true } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const aiEndpoint = await getDynamicAiEndpoint();

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            await aiEndpoint.chatStreamFull(
              systemMessage || null,
              messages,
              (content: string) => {
                controller.enqueue(encoder.encode(content));
              }
            );
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(encoder.encode(`Error: ${error}`));
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
    } else {
      // Non-streaming response
      const result = await aiEndpoint.chatCompletionFull(
        systemMessage || null,
        messages
      );

      return new Response(
        JSON.stringify({ content: result }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('AI API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process AI request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
