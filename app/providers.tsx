'use client';

import { AlertProvider } from '@/components/AlertBox';
import { FetcherProvider } from '@/components/FetcherProvider';

import { ConfigProvider, theme } from 'antd'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
