// Peças de tela do escritório usadas em várias páginas (componentes de servidor).
import Link from 'next/link'
import { nomeMes } from '@/lib/datas'
import { dataLonga, reais } from '@/lib/format'
import { dias } from '@/lib/datas'
import type { Caminhao } from '@/db/schema'

export function Cabecalho({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{titulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  )
}

export function Periodo({ meses, mes, base, extra = '' }: { meses: string[]; mes: string; base: string; extra?: string }) {
  return (
    <form className="row" action={base}>
      {extra && Array.from(new URLSearchParams(extra).entries()).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <span>Período</span>
        <select name="mes" defaultValue={mes} className="inp" style={{ minHeight: 38, padding: '6px 10px', width: 'auto' }} data-autosubmit>
          {meses.map((m) => (
            <option key={m} value={m}>
              {nomeMes(m)}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="btn sm">
          Ver
        </button>
      </noscript>
    </form>
  )
}

export const Placa = ({ c }: { c?: Pick<Caminhao, 'placa'> | null }) => <span className="plate">{c?.placa ?? '—'}</span>
export const Placas = ({ c }: { c?: Pick<Caminhao, 'placa' | 'placaCarreta'> | null }) =>
  c ? (
    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
      <span className="plate">{c.placa}</span>
      {c.placaCarreta && <span className="plate">{c.placaCarreta}</span>}
    </span>
  ) : (
    <>—</>
  )

export const Valor = ({ v }: { v: number }) => <span className={v < 0 ? 'neg' : 'pos'}>{reais(v)}</span>

export function Vence({ d, hoje, aviso, urgente }: { d: string | null; hoje: string; aviso: number; urgente: number }) {
  if (!d) return <span className="muted">—</span>
  const n = dias(hoje, d)
  return <span className={`chip ${n <= urgente ? 'bad' : n <= aviso ? 'warn' : 'ok'}`}>{dataLonga(d)}</span>
}

export function BotaoLink({ href, children, pri }: { href: string; children: React.ReactNode; pri?: boolean }) {
  return (
    <Link href={href} scroll={false} className={`btn ${pri ? 'pri' : ''}`}>
      {children}
    </Link>
  )
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>
}
