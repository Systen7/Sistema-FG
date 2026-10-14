import type { Metadata, Viewport } from 'next'
import { Jost, Bodoni_Moda } from 'next/font/google'
import './globals.css'

const body = Jost({ subsets: ['latin'], variable: '--font-body', weight: ['300', '400', '500', '600', '700'], display: 'swap' })
const display = Bodoni_Moda({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Sistema FG', template: '%s · Sistema FG' },
  description: 'Gestão de viagens, despesas e frota da Empresa FG.',
  applicationName: 'Sistema FG',
  appleWebApp: { capable: true, title: 'FG Motorista', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: '/favicon-32.png', sizes: '32x32' }, { url: '/icon-192.png', sizes: '192x192' }], apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#04060a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  )
}
