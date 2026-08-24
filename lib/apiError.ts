import { NextResponse } from 'next/server';

export interface ErrorEnvelope {
  message: string;
  name?: string;
  stack?: string;
  details?: unknown;
  cause?: ErrorEnvelope;
}

const toJsonSafeDetail = (value: unknown): unknown => {
  const seen = new WeakSet<object>();
  try {
    return JSON.parse(JSON.stringify(value, (_key, candidate: unknown) => {
      if (typeof candidate === 'bigint') return candidate.toString();
      if (candidate instanceof Error) {
        return {
          name: candidate.name,
          message: candidate.message,
          stack: candidate.stack,
        };
      }
      if (candidate !== null && typeof candidate === 'object') {
        if (seen.has(candidate)) return '[Circular]';
        seen.add(candidate);
      }
      return candidate;
    }));
  } catch {
    return String(value);
  }
};

export function toErrorEnvelope(err: unknown, depth = 0): ErrorEnvelope {
  if (err instanceof Error) {
    const extended = err as Error & { cause?: unknown; details?: unknown };
    const envelope: ErrorEnvelope = {
      message: err.message || err.name || 'Unknown error',
      name: err.name,
      stack: err.stack,
    };
    if (extended.details !== undefined) envelope.details = toJsonSafeDetail(extended.details);
    if (extended.cause !== undefined && depth < 4) envelope.cause = toErrorEnvelope(extended.cause, depth + 1);
    return envelope;
  }
  if (typeof err === 'string') {
    return { message: err };
  }
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

export function errorResponse(err: unknown, status = 500) {
  console.error(err);
  return NextResponse.json({ error: toErrorEnvelope(err) }, { status });
}

export function errorResponseFromMessage(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}
