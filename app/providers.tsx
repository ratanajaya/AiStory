'use client';

import { AlertProvider } from '@/components/AlertBox';
import { FetcherProvider } from '@/components/FetcherProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AlertProvider>
      <FetcherProvider>{children}</FetcherProvider>
    </AlertProvider>
  );
}
