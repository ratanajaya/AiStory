'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useFetcher } from '@/components/FetcherProvider';
import { BookAudioManager } from '@/lib/bookAudioManager';
import { ensureTtsPart, planTtsParts, readTtsPart } from '@/lib/ttsChunkClient';
import { playTtsPart } from '@/lib/ttsPartPlayback';
import { clearPreloadedAudio, pauseAudioPlayback, preloadAudioBlob, resumeAudioPlayback, stopAudioPlayback, subscribeToAudioPlayback, type AudioPlaybackStatus } from '@/lib/ttsIndexedDb';
import type { TtsConfig } from '@/types';

const Context = createContext<BookAudioManager | null>(null);

export function BookAudioProvider({ bookId, children }: { bookId: string; children: ReactNode }) {
  const { fetcher } = useFetcher();
  const [manager, setManager] = useState<BookAudioManager | null>(null);
  useEffect(() => {
    const create = () => new BookAudioManager({
      settings: async signal => (await fetcher<{ selectedTts: TtsConfig }>('/api/ai/tts', { signal, silent: true })).selectedTts,
      plan: planTtsParts,
      ensure: (part, signal) => ensureTtsPart(part, { feature: 'Book audio', bookId }, signal),
      read: readTtsPart, play: playTtsPart,
      preload: (part, blob) => preloadAudioBlob(part.key, blob), clearPreload: clearPreloadedAudio,
      stop: () => { stopAudioPlayback(); }, pause: () => { pauseAudioPlayback(); },
      resume: async () => { await resumeAudioPlayback(); },
    });
    let current = create(); setManager(current);
    const interrupt = () => current.stop();
    const actor = () => { current.dispose(); current = create(); setManager(current); };
    window.addEventListener('aistory:audio-interrupt', interrupt);
    window.addEventListener('aistory:actor', actor);
    return () => {
      window.removeEventListener('aistory:audio-interrupt', interrupt);
      window.removeEventListener('aistory:actor', actor);
      current.dispose();
    };
  }, [bookId, fetcher]);
  return manager ? <Context.Provider value={manager}>{children}</Context.Provider> : null;
}

export function useBookAudio() {
  const manager = useContext(Context);
  if (!manager) throw new Error('Book audio requires BookAudioProvider');
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  return { manager, ...snapshot };
}

export function useAudioStatus() {
  const [status, setStatus] = useState<AudioPlaybackStatus>({ activeSegmentId: null, state: 'idle', currentTime: 0, duration: 0, errorMessage: null });
  useEffect(() => subscribeToAudioPlayback(setStatus), []);
  return status;
}
