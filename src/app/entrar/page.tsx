import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { sessaoAtual } from '@/lib/auth'
import { config } from '@/lib/dados'
import { Login } from './login'

export const metadata: Metadata = { title: 'Entrar' }

export default async function Entrar(props: PageProps<'/entrar'>) {
  const sp = await props.searchParams
  const s = await sessaoAtual()
  if (s && !sp.saiu) redirect(s.tipo === 'admin' ? '/admin' : '/m')
  const cfg = await config()
  const zap = cfg.whatsappEscritorio ? `https://wa.me/55${cfg.whatsappEscritorio}?text=${encodeURIComponent('Olá, preciso de ajuda para entrar no app da empresa.')}` : null
  return <Login empresa={cfg.nomeEmpresa} ajuda={zap} demo={process.env.DEMO === '1'} motivo={sp.saiu ? 'saiu' : sp.link ? 'link' : null} />
}
