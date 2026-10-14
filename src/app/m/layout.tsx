import type { Metadata } from 'next'
import { Suspense } from 'react'
import { exigirMotorista } from '@/lib/auth'
import { config } from '@/lib/dados'
import { Toast } from '@/components/toast'
import { Abas, Rede, RegistrarSW } from './shell'

export const metadata: Metadata = { title: 'Motorista' }

export default async function LayoutMotorista({ children }: { children: React.ReactNode }) {
  await exigirMotorista()
  const cfg = await config()
  return (
    <div className="m">
      <header className="m-top">
        <span className="brand"><i>FG</i>{cfg.nomeEmpresa}</span>
        <span className="sp" />
        <Rede />
      </header>
      <main className="m-body">{children}</main>
      <Abas />
      <Suspense><Toast /></Suspense>
      <RegistrarSW />
    </div>
  )
}
