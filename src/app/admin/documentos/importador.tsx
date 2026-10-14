'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, CheckCircle2, XCircle } from 'lucide-react'
import type { EstadoImport } from './actions'

type Acao = (prev: EstadoImport, f: FormData) => Promise<EstadoImport>
type Res = NonNullable<NonNullable<EstadoImport>['resultados']>

// A Vercel aceita até 4,5 MB por envio: os arquivos vão em lotes menores que isso.
const LOTE = 3.8 * 1024 * 1024

/** Área para soltar ou escolher os XML (CT-e, MDF-e, eventos) e PDF (DACTE/DAMDFE) gerados pelo emissor. */
export function Importador({ acao, compacto = false }: { acao: Acao; compacto?: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [res, setRes] = useState<Res>([])
  const [erro, setErro] = useState('')

  const enviar = async (lista: FileList | File[]) => {
    const arquivos = [...lista].filter((f) => f.size > 0)
    if (!arquivos.length) return
    setEnviando(true); setErro(''); setRes([])
    const lotes: File[][] = [[]]
    let tam = 0
    for (const f of arquivos) {
      if (tam + f.size > LOTE && lotes[lotes.length - 1].length) { lotes.push([]); tam = 0 }
      lotes[lotes.length - 1].push(f); tam += f.size
    }
    const todos: Res = []
    try {
      for (const l of lotes) {
        const fd = new FormData()
        l.forEach((f) => fd.append('arquivos', f))
        const r = await acao(undefined, fd)
        if (r?.erro) setErro(r.erro)
        todos.push(...(r?.resultados ?? []))
        setRes([...todos])
      }
    } catch {
      setErro('Falha de conexão no envio. Tente de novo.')
    } finally {
      setEnviando(false)
      if (input.current) input.current.value = ''
      router.refresh()
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div
        role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files) }}
        style={{
          border: `1.5px dashed ${arrastando ? 'var(--yt)' : 'var(--line2)'}`, background: arrastando ? 'var(--y-soft)' : 'transparent', borderRadius: 10,
          padding: compacto ? '14px 16px' : '26px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', justifyContent: compacto ? 'flex-start' : 'center',
        }}>
        {enviando ? <span className="spin" style={{ width: 24, height: 24, border: '2px solid var(--yt)', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> : <FileUp className="ico" style={{ width: 28, height: 28, color: 'var(--yt)' }} />}
        <span>
          <b>{enviando ? 'Lendo os arquivos…' : 'Solte aqui os XML e PDF, ou clique para escolher'}</b><br />
          <span className="small muted">XML do CT-e, do MDF-e e dos eventos de encerramento/cancelamento. PDF do DACTE/DAMDFE com a chave no nome do arquivo.</span>
        </span>
        <input ref={input} type="file" multiple accept=".xml,.pdf,application/xml,text/xml,application/pdf" hidden onChange={(e) => e.target.files && enviar(e.target.files)} />
      </div>
      {erro && <p className="aviso bad" role="alert">{erro}</p>}
      {res.length > 0 && (
        <div className="list" role="status">
          {res.map((r, i) => (
            <div key={i} style={{ justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
              {r.ok ? <CheckCircle2 className="ico" style={{ color: 'var(--good)' }} /> : <XCircle className="ico" style={{ color: 'var(--bad)' }} />}
              <span><b className="small">{r.arquivo}</b><br /><span className="small" style={{ color: r.ok ? undefined : 'var(--bad)' }}>{r.mensagem}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
