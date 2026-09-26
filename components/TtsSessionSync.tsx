'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { stopAudioPlayback } from '@/lib/ttsIndexedDb';

// Session changes invalidate in-flight audio and any actor-scoped catalog state.
export function TtsSessionSync() {
  const { data, status } = useSession();
  useEffect(() => {
    stopAudioPlayback();
    window.dispatchEvent(new Event('aistory:actor'));
    window.dispatchEvent(new Event('aistory:settings'));
  }, [data?.user?.email, status]);
  return null;
}
