import _util from '@/utils/_util';
import { STREAM_ERROR_SENTINEL, splitStreamPayload } from './streamProtocol';
import { formatErrorDetail, type ErrorEnvelope } from './errorClient';
import { appendAiApiLog, createLogError } from './aiApiLog';
import type { AiApiLogContext, AiGenerationFeature } from '@/types';

export interface AiStreamRequest {
  feature: AiGenerationFeature;
  systemMessage?: string | null;
  messages: { role: string; content: string }[];
  logContext?: AiApiLogContext;
}

export interface AiStreamHandlers {
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

export class AiStreamError extends Error {
  envelope?: ErrorEnvelope;
  statusCode?: number;
  constructor(message: string, envelope?: ErrorEnvelope, statusCode?: number) {
    super(message);
    this.name = 'AiStreamError';
    this.envelope = envelope;
    this.statusCode = statusCode;
  }
}

/**
 * POST to /api/ai with stream: true and forward content chunks to onChunk.
 *
 * The server may append a sentinel + JSON error envelope at the end of the
 * stream when the upstream LLM fails. This helper detects that (even when the
 * sentinel arrives split across reads) and throws an AiStreamError with the
 * envelope attached.
 *
 * Returns the cleaned final content on success.
 */
export async function streamAiRequest(
  req: AiStreamRequest,
  handlers: AiStreamHandlers,
): Promise<string> {
  const startedAt = Date.now();
  let httpStatus: number | undefined;

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature: req.feature,
        systemMessage: req.systemMessage ?? null,
        messages: req.messages,
        stream: true,
      }),
      signal: handlers.signal,
    });
    httpStatus = response.status;

    if (!response.ok) {
    // Non-OK response is JSON-shaped via errorResponse on the server side.
    let envelope: ErrorEnvelope | undefined;
    try {
      const body = await response.json();
      const errPayload = (body as { error?: unknown })?.error;
      if (errPayload && typeof errPayload === 'object') envelope = errPayload as ErrorEnvelope;
      else if (typeof errPayload === 'string') envelope = { message: errPayload };
    } catch {
      try {
        const text = await response.text();
        if (text) envelope = { message: text };
      } catch {
        // ignore
      }
    }
      throw new AiStreamError(
        envelope?.message || `Request failed: ${response.status} ${response.statusText}`,
        envelope,
        response.status,
      );
    }
    if (!response.body) {
      throw new AiStreamError('Server returned no response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let accumulated = '';
    let forwardedLength = 0;
    let sentinelSeen = false;
    const sentinelLen = STREAM_ERROR_SENTINEL.length;

  // Forward chunks live, but hold back the last (sentinelLen - 1) chars of the
  // unforwarded tail so a sentinel split across reads can still be detected.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });

      if (!sentinelSeen) {
        const idx = accumulated.indexOf(STREAM_ERROR_SENTINEL, forwardedLength);
        if (idx !== -1) {
          sentinelSeen = true;
          if (idx > forwardedLength) {
            handlers.onChunk(accumulated.slice(forwardedLength, idx));
          }
          forwardedLength = idx;
        } else {
          const safeEnd = Math.max(forwardedLength, accumulated.length - (sentinelLen - 1));
          if (safeEnd > forwardedLength) {
            handlers.onChunk(accumulated.slice(forwardedLength, safeEnd));
            forwardedLength = safeEnd;
          }
        }
      }
    }
    accumulated += decoder.decode();

    const { content, error } = splitStreamPayload(accumulated);

  // Flush any held-back content if no sentinel ever appeared.
    if (!sentinelSeen && content.length > forwardedLength) {
      handlers.onChunk(content.slice(forwardedLength));
    }

    if (error) {
      throw new AiStreamError(error.message || 'AI request failed', error);
    }

    const cleaned = _util.cleanupLlmResponse(content);
    if (!cleaned) {
      throw new AiStreamError('Server returned no content');
    }

    if (req.logContext) {
      appendAiApiLog({
        kind: 'llm',
        status: 'success',
        ...req.logContext,
        payload: { systemMessage: req.systemMessage ?? null, messages: req.messages, stream: true },
        response: { content: cleaned },
        httpStatus,
        durationMs: Date.now() - startedAt,
      });
    }

    return cleaned;
  } catch (error) {
    if (req.logContext) {
      appendAiApiLog({
        kind: 'llm',
        status: 'error',
        ...req.logContext,
        payload: { systemMessage: req.systemMessage ?? null, messages: req.messages, stream: true },
        error: createLogError(error),
        httpStatus: error instanceof AiStreamError ? error.statusCode ?? httpStatus : httpStatus,
        durationMs: Date.now() - startedAt,
      });
    }
    throw error;
  }
}

export { formatErrorDetail };
