'use client'
import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trash2 } from 'lucide-react'

export type Campo = {
  nome: string; rotulo: string
  tipo?: 'text' | 'num' | 'dinheiro' | 'data' | 'select' | 'bool' | 'tel' | 'senha' | 'area'
  opcoes?: [string, string][]; obrig?: boolean; largo?: boolean; dica?: string; placeholder?: string
}
export type Estado = { erro?: string } | undefined
type Acao = (prev: Estado, f: FormData) => Promise<Estado>

/** Janela de cadastro/edição. Aberta pela URL (?editar=… ou ?novo=…) para funcionar com o botão voltar. */
export function FormModal({ titulo, campos, valores, acao, fechar, excluir, extra, rotuloSalvar = 'Salvar' }: {
  titulo: string; campos: Campo[]; valores: Record<string, unknown>; acao: Acao; fechar: string
  excluir?: Acao; extra?: React.ReactNode; rotuloSalvar?: string
}) {
  const router = useRouter()
  const [estado, enviar, pend] = useActionState(acao, undefined)
  const [estadoDel, enviarDel, pendDel] = useActionState(excluir ?? (async () => undefined), undefined)
  const [conf, setConf] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(fechar, { scroll: false }) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [router, fechar])
  const erro = estado?.erro ?? estadoDel?.erro
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) router.push(fechar, { scroll: false }) }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" ref={ref}>
        <header><h2 id="dlg-t">{titulo}</h2><Link href={fechar} scroll={false} className="btn sm ghost" aria-label="Fechar"><X className="ico" /></Link></header>
        {extra}
        <form action={enviar} className="form" noValidate>
          {campos.map((c) => <Entrada key={c.nome} c={c} v={valores[c.nome]} />)}
          {erro && <p className="aviso bad full" role="alert">{erro}</p>}
          <div className="row between full" style={{ marginTop: 4 }}>
            <span className="row">
              <button className="btn pri" disabled={pend}>{pend && <span className="spin" />}{rotuloSalvar}</button>
              <Link href={fechar} scroll={false} className="btn">Cancelar</Link>
            </span>
            {excluir && (conf
              ? <span className="row"><span className="small muted">Tem certeza?</span><button formAction={enviarDel} className="btn del solid" disabled={pendDel}>Excluir de vez</button></span>
              : <button type="button" className="btn del ghost" onClick={() => setConf(true)}><Trash2 className="ico" />Excluir</button>)}
          </div>
        </form>
      </div>
    </div>
  )
}

function Entrada({ c, v }: { c: Campo; v: unknown }) {
  const t = c.tipo ?? 'text'
  const val = v == null ? '' : String(v)
  const rot = <>{c.rotulo}{c.obrig === false && <span className="dica"> (opcional)</span>}</>
  const cls = 'campo' + (c.largo || t === 'area' ? ' full' : '')
  let el: React.ReactNode
  if (t === 'select') el = <select name={c.nome} defaultValue={val}>{c.opcoes!.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
  else if (t === 'bool') el = <select name={c.nome} defaultValue={v ? '1' : '0'}><option value="0">Não</option><option value="1">Sim</option></select>
  else if (t === 'data') el = <input type="date" name={c.nome} defaultValue={val} />
  else if (t === 'area') el = <textarea name={c.nome} defaultValue={val} rows={3} placeholder={c.placeholder} />
  else if (t === 'senha') el = <input type="password" name={c.nome} autoComplete="new-password" placeholder={c.placeholder} inputMode={c.nome.toLowerCase().includes('pin') ? 'numeric' : undefined} />
  else if (t === 'dinheiro') el = <input name={c.nome} inputMode="decimal" defaultValue={v == null || v === '' ? '' : (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} placeholder={c.placeholder ?? '0,00'} />
  else if (t === 'num') el = <input name={c.nome} inputMode="decimal" defaultValue={val === '' ? '' : String(v).replace('.', ',')} placeholder={c.placeholder} />
  else el = <input name={c.nome} type={t === 'tel' ? 'tel' : 'text'} defaultValue={val} placeholder={c.placeholder} autoComplete="off" />
  return <label className={cls}>{rot}{el}{c.dica && <span className="dica">{c.dica}</span>}</label>
}
