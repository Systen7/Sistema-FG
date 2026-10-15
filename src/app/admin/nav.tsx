'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckCheck,
  Route,
  Bell,
  Users,
  HandCoins,
  Truck,
  CircleDot,
  ShieldCheck,
  Map as Mapa,
  Settings,
  FileSpreadsheet,
  FileCheck2,
} from 'lucide-react'

const ITENS = [
  ['/admin', 'Painel', LayoutDashboard],
  ['/admin/aprovacoes', 'Aprovações', CheckCheck],
  ['/admin/viagens', 'Viagens', Route],
  ['/admin/documentos', 'CT-e e MDF-e', FileCheck2],
  ['/admin/alertas', 'Alertas', Bell],
  ['/admin/motoristas', 'Motoristas', Users],
  ['/admin/acerto', 'Acerto', HandCoins],
  ['sep'],
  ['/admin/frota', 'Frota e manutenção', Truck],
  ['/admin/pneus', 'Pneus', CircleDot],
  ['/admin/seguros', 'Seguros e custos fixos', ShieldCheck],
  ['/admin/rotas', 'Rotas', Mapa],
  ['/admin/relatorios', 'Relatórios', FileSpreadsheet],
  ['sep'],
  ['/admin/config', 'Configurações', Settings],
] as const

export function Nav({ pendentes, urgentes, mdfeAbertos = 0 }: { pendentes: number; urgentes: number; mdfeAbertos?: number }) {
  const p = usePathname()
  return (
    <nav className="nav" aria-label="Menu">
      {ITENS.map((it, i) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: menu fixo; o separador não tem outra identidade
        if (it[0] === 'sep') return <span key={i} className="sep" />
        const [href, nome, Ico] = it
        const ativo = href === '/admin' ? p === '/admin' : p.startsWith(href)
        const badge =
          href === '/admin/aprovacoes' && pendentes ? (
            <span className="badge">{pendentes}</span>
          ) : href === '/admin/alertas' && urgentes ? (
            <span className="badge r">{urgentes}</span>
          ) : href === '/admin/documentos' && mdfeAbertos ? (
            <span className="badge" title="MDF-e abertos">
              {mdfeAbertos}
            </span>
          ) : null
        return (
          <Link key={href} href={href} aria-current={ativo ? 'page' : undefined}>
            <Ico className="ico" />
            {nome}
            {badge}
          </Link>
        )
      })}
    </nav>
  )
}
