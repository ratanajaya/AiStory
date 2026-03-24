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
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#585e68',
            colorBgBase: '#101318',
            colorTextBase: '#ededed',
            colorBorder: '#2e3238',
            colorBgContainer: '#16191e',
            colorBgElevated: '#1c2026',
          },
        }}
      >
        <AlertProvider>
          <FetcherProvider>{children}</FetcherProvider>
        </AlertProvider>
      </ConfigProvider>
    </SessionProvider>
  );
}
