'use client';

import dynamic from 'next/dynamic';

// La SPA usa routing por hash, localStorage y EventSource desde el primer
// render: se monta solo en el navegador, igual que antes con Vite.
const App = dynamic(() => import('./App'), { ssr: false });

export default function ClientApp() {
  return <App />;
}
