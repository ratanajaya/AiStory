'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useAlert } from '@/components/AlertBox';
import { formatErrorDetail, type ErrorEnvelope } from '@/lib/errorClient';

interface FetcherOptions extends RequestInit {
  // If true, errors will not trigger showAlert (for manual handling)
  silent?: boolean;
  // Custom headline shown to the user. The structured detail from the server
  // (if any) is still attached as the expandable detail panel.
  errorMessage?: string;
}

interface FetcherContextType {
  fetcher: <T = unknown>(url: string, options?: FetcherOptions) => Promise<T>;
}

const FetcherContext = createContext<FetcherContextType | null>(null);

export function useFetcher() {
  const context = useContext(FetcherContext);
  if (!context) {
    throw new Error('useFetcher must be used within a FetcherProvider');
  }
  return context;
}

interface FetcherProviderProps {
  children: ReactNode;
}

async function extractErrorEnvelope(response: Response): Promise<ErrorEnvelope | undefined> {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const body = await response.json();
      if (body && typeof body === 'object') {
        const errPayload = (body as { error?: unknown }).error;
        if (errPayload && typeof errPayload === 'object') {
          return errPayload as ErrorEnvelope;
        }
        if (typeof errPayload === 'string') {
          return { message: errPayload };
        }
        // Unrecognized JSON shape — surface it as a detail blob.
        return { message: JSON.stringify(body) };
      }
    } catch {
      // Fall through to text fallback below
    }
  }
  try {
    const text = await response.text();
    if (text) return { message: text };
  } catch {
    // ignore
  }
  return undefined;
}

export function FetcherProvider({ children }: FetcherProviderProps) {
  const { showAlert } = useAlert();

  const fetcher = useCallback(
    async <T = unknown>(url: string, options: FetcherOptions = {}): Promise<T> => {
      const { silent = false, errorMessage, ...fetchOptions } = options;

      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const envelope = await extractErrorEnvelope(response);
          const fallback = envelope?.message || `Request failed: ${response.status} ${response.statusText}`;
          const error = new Error(fallback) as Error & { envelope?: ErrorEnvelope; statusCode?: number };
          error.envelope = envelope;
          error.statusCode = response.status;
          throw error;
        }

        // Handle empty responses (e.g., 204 No Content)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return undefined as T;
        }

        const data = await response.json();
        return data as T;
      } catch (err) {
        const envelope = (err as { envelope?: ErrorEnvelope })?.envelope;
        const primary = errorMessage || envelope?.message || (err instanceof Error ? err.message : 'An error occurred');
        let detail: string | undefined;
        if (envelope) {
          detail = formatErrorDetail(envelope);
        } else if (err instanceof Error && err.stack) {
          detail = err.stack;
        }
        if (!silent) {
          showAlert(primary, { type: 'error', detail });
        }
        throw err;
      }
    },
    [showAlert]
  );

  return (
    <FetcherContext.Provider value={{ fetcher }}>
      {children}
    </FetcherContext.Provider>
  );
}
