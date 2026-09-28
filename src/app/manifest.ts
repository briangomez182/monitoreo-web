import type { MetadataRoute } from 'next';

/** Nombre e ícono al guardar la app en la pantalla de inicio del celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StatuX',
    short_name: 'StatuX',
    description: 'Monitoreo del estado de sitios web',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#101010',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
