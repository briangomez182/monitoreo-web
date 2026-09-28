import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import '@/styles/mobile-shell.css';
import '@/styles/mobile-cards.css';
import '@/styles/mobile-catalog.css';

// Los íconos (favicon.ico, icon.png, apple-icon.png) y el manifest los toma Next
// de los archivos con esos nombres en src/app/.
export const metadata: Metadata = {
  title: 'StatuX',
  applicationName: 'StatuX',
  appleWebApp: { title: 'StatuX', statusBarStyle: 'default' },
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
