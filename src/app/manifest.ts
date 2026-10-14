import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FG Motorista',
    short_name: 'FG',
    description: 'Viagens, gastos e extrato do motorista da Empresa FG.',
    start_url: '/m',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#04060a',
    theme_color: '#04060a',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Lançar gasto', url: '/m/gasto', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Meu extrato', url: '/m/extrato', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
