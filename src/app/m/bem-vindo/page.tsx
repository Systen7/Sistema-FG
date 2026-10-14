import Link from 'next/link'
import { Plus, Flag, Play, ReceiptText } from 'lucide-react'
import { exigirMotorista } from '@/lib/auth'
import { primeiroNome } from '@/lib/format'
import { Instalar } from '../conta/conta-cliente'
import { LembrarTelefone } from './lembrar'

export const metadata = { title: 'Bem-vindo' }

// Primeira tela depois do link de acesso: explica o app em quatro passos e oferece a instalação.
export default async function BemVindo() {
  const m = await exigirMotorista()
  const passos = [
    [Play, 'Iniciar viagem', 'Ao pegar a carga: origem, destino, carga e frete.'],
    [Plus, 'Lançar gastos', 'Diesel, pedágio, comida… com foto do comprovante.'],
    [Flag, 'Encerrar viagem', 'Ao descarregar: só o km do painel.'],
    [ReceiptText, 'Ver seu extrato', 'Quanto ganhou de comissão no mês.'],
  ] as const
  return (
    <>
      <LembrarTelefone tel={m.telefone} />
      <div>
        <h1>Bem-vindo, {primeiroNome(m.nome)}</h1>
        <p className="muted" style={{ marginTop: 6 }}>Você já está conectado. Este é o app da empresa para suas viagens.</p>
      </div>
      <section className="panel">
        <ol className="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {passos.map(([I, t, d]) => (
            <li key={t} style={{ justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
              <I className="ico" style={{ width: 28, height: 28, color: 'var(--yt)', flex: 'none' }} />
              <span><b>{t}</b><br /><span className="muted small">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>
      <Instalar forte />
      <p className="small muted">Funciona mesmo sem sinal: o gasto fica guardado no celular e é enviado quando a internet voltar.</p>
      <Link href="/m" className="btn xl pri">Começar</Link>
    </>
  )
}
