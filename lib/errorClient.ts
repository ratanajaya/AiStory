import type { ErrorEnvelope } from './apiError';

export type { ErrorEnvelope };

export function formatErrorDetail(envelope: ErrorEnvelope | null | undefined): string | undefined {
  if (!envelope) return undefined;
  const parts: string[] = [];
  if (envelope.name && envelope.name !== 'Error') parts.push(envelope.name);
  if (envelope.message) parts.push(envelope.message);
  if (envelope.stack) parts.push(envelope.stack);
  const detail = parts.join('\n\n').trim();
  return detail || undefined;
}

export function getErrorEnvelope(err: unknown): ErrorEnvelope | undefined {
  if (err && typeof err === 'object' && 'envelope' in err) {
    const env = (err as { envelope?: unknown }).envelope;
    if (env && typeof env === 'object') return env as ErrorEnvelope;
  }
  return undefined;
}
