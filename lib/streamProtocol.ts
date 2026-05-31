import { ErrorEnvelope, toErrorEnvelope } from './apiError';

export const STREAM_ERROR_SENTINEL = '\n\n__AISTORY_STREAM_ERROR__\n';

export function buildStreamErrorTail(err: unknown): string {
  return STREAM_ERROR_SENTINEL + JSON.stringify(toErrorEnvelope(err));
}

export function splitStreamPayload(full: string): { content: string; error?: ErrorEnvelope } {
  const idx = full.indexOf(STREAM_ERROR_SENTINEL);
  if (idx === -1) return { content: full };
  const content = full.slice(0, idx);
  const errJson = full.slice(idx + STREAM_ERROR_SENTINEL.length);
  try {
    return { content, error: JSON.parse(errJson) as ErrorEnvelope };
  } catch {
    return { content, error: { message: 'Malformed error envelope from server', stack: errJson } };
  }
}
