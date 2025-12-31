'use client';

import { ConfigProvider, theme } from 'antd';
import faIR from 'antd/locale/fa_IR';
import { ReactNode } from 'react';

export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={faIR} theme={{ algorithm: theme.defaultAlgorithm }}>
      {children}
    </ConfigProvider>
  );
}
