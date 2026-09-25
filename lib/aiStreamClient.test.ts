import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STREAM_ERROR_SENTINEL } from './streamProtocol';

const mocks = vi.hoisted(() => ({
  appendAiApiLog: vi.fn(),
}));

vi.mock('./aiApiLog', async (importOriginal) => ({
  ...await importOriginal<typeof import('./aiApiLog')>(),
  appendAiApiLog: mocks.appendAiApiLog,
}));

import { AiStreamError, streamAiRequest } from './aiStreamClient';

const request = {
  feature: 'narration' as const,
  systemMessage: 'Tell a story',
  messages: [{ role: 'user', content: 'Begin' }],
};

const streamedResponse = (chunks: Uint8Array[]) => new Response(new ReadableStream<Uint8Array>({
  start(controller) {
    chunks.forEach((chunk) => controller.enqueue(chunk));
    controller.close();
  },
}));

describe('streamAiRequest', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('forwards streamed Unicode text and returns cleaned final content', async () => {
    const bytes = new TextEncoder().encode('  café story  ');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamedResponse([
      bytes.slice(0, 6), bytes.slice(6, 7), bytes.slice(7),
    ])));
    const onChunk = vi.fn();
    const controller = new AbortController();

    const result = await streamAiRequest({ ...request, logContext: { feature: 'Narration' } }, {
      onChunk,
      signal: controller.signal,
    });

    expect(result).toBe('café story');
    expect(onChunk.mock.calls.map(([text]) => text).join('')).toBe('  café story  ');
    expect(fetch).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ ...request, stream: true }),
    }));
    expect(mocks.appendAiApiLog).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'llm', status: 'success', httpStatus: 200, response: { content: result },
    }));
  });

  it('reports the resolved provider and model from streaming headers', async () => {
    const onModel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Generated text', {
      headers: {
        'X-AI-Service': 'together',
        'X-AI-Model': encodeURIComponent('org/model-v2'),
      },
    })));

    await streamAiRequest(request, { onChunk: vi.fn(), onModel });

    expect(onModel).toHaveBeenCalledWith({ service: 'together', model: 'org/model-v2' });
  });

  it('reports unavailable provenance when streaming headers are missing or invalid', async () => {
    const onModel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Generated text', {
      headers: { 'X-AI-Service': 'other', 'X-AI-Model': 'bad-model' },
    })));

    await streamAiRequest(request, { onChunk: vi.fn(), onModel });

    expect(onModel).toHaveBeenCalledWith(null);
  });

  it('keeps a split error sentinel out of visible chunks and preserves its envelope', async () => {
    const payload = `Partial story${STREAM_ERROR_SENTINEL}${JSON.stringify({ message: 'Provider failed', name: 'UpstreamError' })}`;
    const split = payload.indexOf(STREAM_ERROR_SENTINEL) + 4;
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamedResponse([
      encoder.encode(payload.slice(0, split)), encoder.encode(payload.slice(split)),
    ])));
    const onChunk = vi.fn();

    const error = await streamAiRequest(request, { onChunk }).catch((caught: unknown) => caught);

    expect(onChunk.mock.calls.map(([text]) => text).join('')).toBe('Partial story');
    expect(error).toBeInstanceOf(AiStreamError);
    expect(error).toMatchObject({ message: 'Provider failed', envelope: { name: 'UpstreamError' } });
  });

  it('preserves an HTTP error envelope and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      error: { message: 'Invalid request', details: { field: 'messages' } },
    }, { status: 400 })));
    const onChunk = vi.fn();

    const error = await streamAiRequest({ ...request, logContext: { feature: 'Narration' } }, { onChunk })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      name: 'AiStreamError', message: 'Invalid request', statusCode: 400,
      envelope: { details: { field: 'messages' } },
    });
    expect(onChunk).not.toHaveBeenCalled();
    expect(mocks.appendAiApiLog).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error', httpStatus: 400,
    }));
  });

  it('rejects a successful response without generated content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamedResponse([new TextEncoder().encode('  ')])));

    await expect(streamAiRequest(request, { onChunk: vi.fn() }))
      .rejects.toThrow('Server returned no content');
  });
});
