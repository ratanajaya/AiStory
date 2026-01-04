'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useAlert } from '@/components/AlertBox';

interface FetcherOptions extends RequestInit {
  // If true, errors will not trigger showAlert (for manual handling)
  silent?: boolean;
  // Custom error message to show instead of the default
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

export function FetcherProvider({ children }: FetcherProviderProps) {
  const { showAlert } = useAlert();

  const fetcher = useCallback(
    async <T = unknown>(url: string, options: FetcherOptions = {}): Promise<T> => {
      const { silent = false, errorMessage, ...fetchOptions } = options;

      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const errorText = errorMessage || `Request failed: ${response.status} ${response.statusText}`;
          
          throw new Error(errorText);
        }

        // Handle empty responses (e.g., 204 No Content)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return undefined as T;
        }

        const data = await response.json();
        return data as T;
      } catch (err) {
        const message = errorMessage || (err instanceof Error ? err.message : 'An error occurred');
        if (!silent) {
          showAlert(message);
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
