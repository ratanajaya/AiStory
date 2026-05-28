import { NextResponse } from 'next/server';

export interface ErrorEnvelope {
  message: string;
  name?: string;
  stack?: string;
}

export function toErrorEnvelope(err: unknown): ErrorEnvelope {
  if (err instanceof Error) {
    return {
      message: err.message || err.name || 'Unknown error',
      name: err.name,
      stack: err.stack,
    };
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
