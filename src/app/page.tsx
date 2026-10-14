import { redirect } from 'next/navigation'
import { sessaoAtual } from '@/lib/auth'

export default async function Inicio() {
  const s = await sessaoAtual()
  redirect(s?.tipo === 'admin' ? '/admin' : s?.tipo === 'motorista' ? '/m' : '/entrar')
}
