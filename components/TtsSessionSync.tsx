'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { stopAudioPlayback } from '@/lib/ttsIndexedDb';

// Session changes invalidate in-flight audio and any actor-scoped catalog state.
export function TtsSessionSync() {
  const { data, status } = useSession();
  const previousActor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status === 'loading') return;
    const actor = data?.user?.email ?? 'guest';
    const changed = previousActor.current !== undefined && previousActor.current !== actor;
    previousActor.current = actor;
    if (!changed) return;
    stopAudioPlayback();
    window.dispatchEvent(new Event('aistory:actor'));
    window.dispatchEvent(new Event('aistory:settings'));
  }, [data?.user?.email, status]);
  return null;
}
