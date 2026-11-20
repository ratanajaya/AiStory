'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFetcher } from '@/components/FetcherProvider';
import type { AiModelOption, LLMService } from '@/types';
import { supportedLlmServices } from '@/lib/llmSettings';
import _util from '@/utils/_util';

interface CatalogEntry {
  models: AiModelOption[];
  loading: boolean;
  error: string | null;
}

const loadingEntry: CatalogEntry = { models: [], loading: true, error: null };

interface AiModelCatalogContextValue {
  getEntry: (service: LLMService, apiKey?: string | null, scope?: 'defaults') => CatalogEntry;
  loadModels: (service: LLMService, apiKey?: string | null, force?: boolean, scope?: 'defaults') => Promise<void>;
}

const AiModelCatalogContext = createContext<AiModelCatalogContextValue | null>(null);

function cacheKey(service: LLMService, apiKey?: string | null, scope?: 'defaults') {
  return JSON.stringify([service, scope, apiKey === null ? null : _util.toIdentifierString(apiKey)]);
}

export function AiModelCatalogProvider({ children }: { children: React.ReactNode }) {
  const { fetcher } = useFetcher();
  const [entries, setEntries] = useState<Record<string, CatalogEntry>>({});
  const entriesRef = useRef<Record<string, CatalogEntry>>({});
  const pending = useRef(new Map<string, Promise<void>>());

  const setEntry = useCallback((key: string, entry: CatalogEntry) => {
    entriesRef.current = { ...entriesRef.current, [key]: entry };
    setEntries(entriesRef.current);
  }, []);

  const loadModels = useCallback((service: LLMService, apiKey?: string | null, force = false, scope?: 'defaults') => {
    const key = cacheKey(service, apiKey, scope);
    const existing = entriesRef.current[key];
    if (!force && existing && !existing.loading) return Promise.resolve();
    const inFlight = pending.current.get(key);
    if (inFlight) return inFlight;

    setEntry(key, { models: existing?.models ?? [], loading: true, error: null });
    const request = (async () => {
      try {
        const normalizedKey = apiKey === null ? null : _util.toIdentifierString(apiKey) || undefined;
        const data = await fetcher<{ models: AiModelOption[] }>(
          `/api/ai/models/${service.toLowerCase()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: normalizedKey, scope }),
            silent: true,
          }
        );
        setEntry(key, {
          models: data.models,
          loading: false,
          error: data.models.length ? null : 'No text models were returned.',
        });
      } catch (err) {
        setEntry(key, {
          models: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load models.',
        });
      } finally {
        pending.current.delete(key);
      }
    })();
    pending.current.set(key, request);
    return request;
  }, [fetcher, setEntry]);

  useEffect(() => {
    for (const service of supportedLlmServices) void loadModels(service);
  }, [loadModels]);

  const getEntry = useCallback((service: LLMService, apiKey?: string | null, scope?: 'defaults') => {
    return entries[cacheKey(service, apiKey, scope)] ?? loadingEntry;
  }, [entries]);

  return (
    <AiModelCatalogContext.Provider value={{ getEntry, loadModels }}>
      {children}
    </AiModelCatalogContext.Provider>
  );
}

export function useAiModelCatalog() {
  const context = useContext(AiModelCatalogContext);
  if (!context) throw new Error('useAiModelCatalog must be used within AiModelCatalogProvider');
  return context;
}
