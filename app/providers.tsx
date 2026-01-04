'use client';

import { AlertProvider } from '@/components/AlertBox';

export function Providers({ children }: { children: React.ReactNode }) {
  return <AlertProvider>{children}</AlertProvider>;
}
