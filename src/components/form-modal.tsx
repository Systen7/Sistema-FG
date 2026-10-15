'use client'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSaida } from './saida'
import { X, Trash2 } from 'lucide-react'

export type Campo = {
  nome: string; rotulo: string
  tipo?: 'text' | 'num' | 'dinheiro' | 'data' | 'select' | 'bool' | 'tel' | 'senha' | 'area'
  opcoes?: [string, string][]; obrig?: boolean; largo?: boolean; dica?: string; placeholder?: string
}
export type Estado = { erro?: string } | undefined
type Acao = (prev: Estado, f: FormData) => Promise<Estado>

/** Janela de cadastro/edição. Aberta pela URL (?editar=… ou ?novo=…) para funcionar com o botão voltar. */
export function FormModal({ titulo, campos, valores, acao, fechar, excluir, extra, rotuloSalvar = 'Salvar', ocultos }: {
  titulo: string; campos: Campo[]; valores: Record<string, unknown>; acao: Acao; fechar: string
  excluir?: Acao; extra?: React.ReactNode; rotuloSalvar?: string; ocultos?: Record<string, string>
}) {
  const router = useRouter()
  const [estado, enviar, pend] = useActionState(acao, undefined)
  const [estadoDel, enviarDel, pendDel] = useActionState(excluir ?? (async () => undefined), undefined)
  const [conf, setConf] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { saindo, sair } = useSaida()
  // Fecha com animação de saída; a troca de endereço só acontece depois que a janela some.
  const fecharJanela = () => sair(() => router.push(fechar, { scroll: false }))
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus()
    // Esc é atalho de teclado: fecha na hora, sem animação (Emil: ação de teclado não anima).
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(fechar, { scroll: false }) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [router, fechar])
  const erro = estado?.erro ?? estadoDel?.erro
  return (
    <div className={'ov' + (saindo ? ' saindo' : '')} onMouseDown={(e) => { if (e.target === e.currentTarget) fecharJanela() }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" ref={ref} aria-busy={pend || pendDel}>
        <header><h2 id="dlg-t">{titulo}</h2><button type="button" onClick={fecharJanela} className="btn sm ghost" aria-label="Fechar"><X className="ico" /></button></header>
        {extra}
        <form action={enviar} className="form" noValidate>
          {ocultos && Object.entries(ocultos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {campos.map((c) => <Entrada key={c.nome} c={c} v={valores[c.nome]} />)}
          {erro && <p key={erro} className="aviso bad full" role="alert">{erro}</p>}
          <div className="row between full" style={{ marginTop: 4 }}>
            <span className="row">
              <button className="btn pri" disabled={pend} aria-busy={pend}>{pend && <span className="spin" />}{rotuloSalvar}</button>
              <button type="button" onClick={fecharJanela} className="btn">Cancelar</button>
            </span>
            {excluir && (conf
              ? <span className="row"><span className="small muted">Tem certeza?</span><button formAction={enviarDel} className="btn del solid" disabled={pendDel} aria-busy={pendDel}>{pendDel && <span className="spin" />}Excluir de vez</button></span>
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
  // PIN do motorista: campo de texto mascarado, para o navegador não oferecer salvar nem alertar como "senha vazada".
  else if (t === 'senha' && c.nome.toLowerCase().includes('pin')) el = <input type="text" name={c.nome} autoComplete="off" inputMode="numeric" maxLength={4} placeholder={c.placeholder} data-1p-ignore data-lpignore="true" style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties} />
  else if (t === 'senha') el = <input type="password" name={c.nome} autoComplete="new-password" placeholder={c.placeholder} />
  else if (t === 'dinheiro') el = <input name={c.nome} inputMode="decimal" defaultValue={v == null || v === '' ? '' : (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} placeholder={c.placeholder ?? '0,00'} />
  else if (t === 'num') el = <input name={c.nome} inputMode="decimal" defaultValue={val === '' ? '' : String(v).replace('.', ',')} placeholder={c.placeholder} />
  else el = <input name={c.nome} type={t === 'tel' ? 'tel' : 'text'} defaultValue={val} placeholder={c.placeholder} autoComplete="off" />
  return <label className={cls}>{rot}{el}{c.dica && <span className="dica">{c.dica}</span>}</label>
}
