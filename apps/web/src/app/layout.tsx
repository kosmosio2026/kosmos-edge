import './globals.css';
import type { Metadata } from 'next';
import { AppProviders } from '@/components/providers/app-providers';

export const metadata: Metadata = {
  title: 'KOSMOS 스마트 주차관제 플랫폼',
  description: 'Edge-first smart parking platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}