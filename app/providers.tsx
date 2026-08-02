'use client';

import { AlertProvider } from '@/components/AlertBox';
import { FetcherProvider } from '@/components/FetcherProvider';
import { UiStateProvider } from '@/components/UiStateProvider';
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AlertProvider>
        <FetcherProvider>
          <UiStateProvider>{children}</UiStateProvider>
        </FetcherProvider>
      </AlertProvider>
    </SessionProvider>
  );
}
