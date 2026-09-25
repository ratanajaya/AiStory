'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFetcher } from '@/components/FetcherProvider';
import type { AiModelOption, LLMService } from '@/types';
import _util from '@/utils/_util';

interface CatalogEntry {
  models: AiModelOption[];
  loading: boolean;
  error: string | null;
}

const loadingEntry: CatalogEntry = { models: [], loading: true, error: null };

interface AiModelCatalogContextValue {
  getEntry: (service: LLMService, apiKey?: string | null) => CatalogEntry;
  loadModels: (service: LLMService, apiKey?: string | null, force?: boolean) => Promise<void>;
}

const AiModelCatalogContext = createContext<AiModelCatalogContextValue | null>(null);

function cacheKey(service: LLMService, apiKey?: string | null) {
  return `${service}\0${_util.toInputString(apiKey)}`;
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

  const loadModels = useCallback((service: LLMService, apiKey?: string | null, force = false) => {
    const key = cacheKey(service, apiKey);
    const existing = entriesRef.current[key];
    if (!force && existing && !existing.loading) return Promise.resolve();
    const inFlight = pending.current.get(key);
    if (inFlight) return inFlight;

    setEntry(key, { models: existing?.models ?? [], loading: true, error: null });
    const request = (async () => {
      try {
        const normalizedKey = _util.toInputString(apiKey);
        const data = await fetcher<{ models: AiModelOption[] }>(
          `/api/ai/models/${service === 'openAi' ? 'openai' : 'together'}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(normalizedKey ? { apiKey: normalizedKey } : {}),
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
    void loadModels('together');
    void loadModels('openAi');
  }, [loadModels]);

  const getEntry = useCallback((service: LLMService, apiKey?: string | null) => {
    return entries[cacheKey(service, apiKey)] ?? loadingEntry;
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
