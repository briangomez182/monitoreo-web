import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '@/styles/mobile-shell.css';
import '@/styles/mobile-cards.css';
import '@/styles/mobile-catalog.css';

export const metadata: Metadata = {
  title: '099 — STATUS DASHBOARD',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
