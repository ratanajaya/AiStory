'use client';

import { AlertProvider } from '@/components/AlertBox';
import { FetcherProvider } from '@/components/FetcherProvider';
import { SessionProvider } from 'next-auth/react';

import { ConfigProvider, theme } from 'antd'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfigProvider
        theme={{
          // 1. Use dark algorithm
          algorithm: theme.darkAlgorithm,

          // 2. Combine dark algorithm and compact algorithm
          // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
        }}
      >
        <AlertProvider>
          <FetcherProvider>{children}</FetcherProvider>
        </AlertProvider>
      </ConfigProvider>
    </SessionProvider>
  );
}
