'use client';

import { AlertProvider } from '@/components/AlertBox';
import { FetcherProvider } from '@/components/FetcherProvider';
import { UiStateProvider } from '@/components/UiStateProvider';
import { SessionProvider } from 'next-auth/react';
import { TtsSessionSync } from '@/components/TtsSessionSync';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TtsSessionSync />
      <AlertProvider>
        <FetcherProvider>
          <UiStateProvider>{children}</UiStateProvider>
        </FetcherProvider>
      </AlertProvider>
    </SessionProvider>
  );
}
