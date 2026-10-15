import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LogOut } from 'lucide-react'
import { exigirAdmin } from '@/lib/auth'
import { config, pendentes, motoristas, caminhoes, apolices, lembretes, pneus, dispensados, mdfeAbertos } from '@/lib/dados'
import { calcAlertas } from '@/lib/alertas'
import { hoje } from '@/lib/datas'
import { sair } from '@/app/entrar/actions'
import { Toast } from '@/components/toast'
import { Nav } from './nav'
import { AutoSubmit } from './autosubmit'
import { Enviar } from '@/components/enviar'

export const metadata: Metadata = { title: { default: 'Escritório', template: '%s · Escritório FG' } }

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const adm = await exigirAdmin()
  const [cfg, pe, ms, cs, ap, lb, pn, ds, mdfes] = await Promise.all([
    config(),
    pendentes(),
    motoristas(),
    caminhoes(),
    apolices(),
    lembretes(),
    pneus(),
    dispensados(),
    mdfeAbertos(),
  ])
  const urg = calcAlertas(hoje(), { motoristas: ms, caminhoes: cs, apolices: ap, lembretes: lb, pneus: pn, cfg, mdfes }).filter(
    (a) => a.urgente && !ds.has(a.chave),
  ).length
  return (
    <>
      <header className="top">
        <a href="/admin" className="brand">
          <i>FG</i>
          {cfg.nomeEmpresa}
        </a>
        <span className="sp" />
        <span className="small muted">{adm.nome}</span>
        <form action={sair}>
          <Enviar className="btn sm">
            <LogOut className="ico" />
            Sair
          </Enviar>
        </form>
      </header>
      <div className="shell">
        <Nav pendentes={pe.length} urgentes={urg} mdfeAbertos={mdfes.length} />
        <main className="main" id="conteudo">
          {children}
        </main>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
      <AutoSubmit />
    </>
  )
}
