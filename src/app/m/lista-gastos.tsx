'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CloudOff, Camera, ChevronRight } from 'lucide-react'
import { aoMudar, listar, type ItemFila } from '@/lib/cliente/fila'
import { IconeTipo, NOME_TIPO, STATUS } from '@/components/tipos'
import { dataCurta, lerReais, num, reaisC } from '@/lib/format'

type G = {
  id: number
  tipo: string
  valor: number
  litros: number | null
  data: string
  obs: string | null
  status: string
  motivo: string | null
  foto: string | null
  pagoPor: string
}

export function ListaGastos({ gastos, viagemId }: { gastos: G[]; viagemId: number }) {
  const [fila, setFila] = useState<ItemFila[]>([])
  useEffect(() => {
    const c = async () => setFila((await listar()).filter((i) => i.viagemId === viagemId))
    c()
    return aoMudar(c)
  }, [viagemId])
  if (!gastos.length && !fila.length) return <p className="muted">Nenhum gasto lançado ainda.</p>
  return (
    <div className="list">
      {fila.map((i) => (
        <div key={i.clientId}>
          <span className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
            <IconeTipo tipo={i.tipo} />
            <span>
              <b>{NOME_TIPO[i.tipo] ?? i.tipo}</b>
              {i.litros ? ` · ${i.litros} L` : ''}
              <br />
              <span className="chip run">
                <CloudOff className="ico" style={{ width: 14, height: 14 }} />
                Guardado no celular, envia quando tiver sinal
              </span>
            </span>
          </span>
          <b className="tnum">{reaisC(lerReais(i.valor) ?? 0)}</b>
        </div>
      ))}
      {gastos
        .slice()
        .reverse()
        .map((g) => (
          <Link key={g.id} href={`/m/gasto?id=${g.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="row" style={{ flexWrap: 'nowrap', gap: 12 }}>
              <IconeTipo tipo={g.tipo} />
              <span>
                <b>{NOME_TIPO[g.tipo] ?? g.tipo}</b>
                {g.litros ? ` · ${num(g.litros)} L` : ''}
                <span className="small muted">
                  {' '}
                  · {dataCurta(g.data)}
                  {g.pagoPor === 'motorista' ? ' · do seu bolso' : ''}
                </span>
                {g.foto && (
                  <Camera
                    className="ico"
                    style={{ display: 'inline', width: 15, height: 15, marginLeft: 6, verticalAlign: '-2px', color: 'var(--muted)' }}
                    aria-label="com foto"
                  />
                )}
                <br />
                <span className={`chip ${STATUS[g.status].c}`}>{STATUS[g.status].t}</span>
                {g.motivo && (
                  <span className="small" style={{ color: 'var(--bad)', display: 'block', marginTop: 4 }}>
                    Motivo: {g.motivo}
                  </span>
                )}
              </span>
            </span>
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <b className="tnum">{reaisC(g.valor)}</b>
              <ChevronRight className="ico muted" />
            </span>
          </Link>
        ))}
    </div>
  )
}
