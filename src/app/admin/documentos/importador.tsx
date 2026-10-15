'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, CheckCircle2, XCircle } from 'lucide-react'
import { enviarComProgresso } from '@/lib/cliente/envio'

type Res = { arquivo: string; ok: boolean; mensagem: string }[]

// A Vercel aceita até 4,5 MB por envio: os arquivos vão em lotes menores que isso.
const LOTE = 3.8 * 1024 * 1024

/** Área para soltar ou escolher os XML (CT-e, MDF-e, eventos) e PDF (DACTE/DAMDFE). Mostra o progresso real do envio. */
export function Importador({ viagemId = null, compacto = false }: { viagemId?: number | null; compacto?: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [prog, setProg] = useState(0)
  const [fase, setFase] = useState('')
  const [res, setRes] = useState<Res>([])
  const [erro, setErro] = useState('')

  const enviar = async (lista: FileList | File[]) => {
    const arquivos = [...lista].filter((f) => f.size > 0)
    if (!arquivos.length || enviando) return
    setEnviando(true); setErro(''); setRes([]); setProg(0)
    const lotes: File[][] = [[]]
    let tam = 0
    for (const f of arquivos) {
      if (tam + f.size > LOTE && lotes[lotes.length - 1].length) { lotes.push([]); tam = 0 }
      lotes[lotes.length - 1].push(f); tam += f.size
    }
    const total = arquivos.reduce((t, f) => t + f.size, 0) || 1
    let feito = 0
    const todos: Res = []
    try {
      for (const l of lotes) {
        const tamLote = l.reduce((t, f) => t + f.size, 0)
        const fd = new FormData()
        for (const f of l) fd.append('arquivos', f)
        if (viagemId) fd.set('viagemId', String(viagemId))
        setFase(`Enviando ${l.length} ${l.length === 1 ? 'arquivo' : 'arquivos'}`)
        // 85% da barra é o envio; o restante é o servidor lendo os XML.
        const r = await enviarComProgresso('/api/admin/documentos', fd, (p) => {
          setProg(((feito + tamLote * p) / total) * 0.85)
          if (p >= 0.98) setFase('Lendo os arquivos')
        })
        feito += tamLote
        if (r.rede) { setErro('Falha de conexão no envio. Tente de novo.'); break }
        if (r.json.erro) setErro(String(r.json.erro))
        todos.push(...((r.json.resultados as Res) ?? []))
        setRes([...todos])
        setProg((feito / total) * 0.85 + 0.15 * (todos.length / arquivos.length))
      }
      setProg(1)
    } finally {
      setTimeout(() => { setEnviando(false); setProg(0) }, 350)
      if (input.current) input.current.value = ''
      router.refresh()
    }
  }

  // Arquivo escolhido antes da tela terminar de carregar (a seção chega por streaming): envia assim que fica pronta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só na montagem
  useEffect(() => {
    const f = input.current?.files
    if (f?.length) enviar(f)
  }, [])

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div
        role="button" tabIndex={0} aria-busy={enviando} onClick={() => !enviando && input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files) }}
        style={{
          border: `1.5px dashed ${arrastando ? 'var(--yt)' : 'var(--line2)'}`, background: arrastando ? 'var(--y-soft)' : 'transparent', borderRadius: 10,
          padding: compacto ? '14px 16px' : '26px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: enviando ? 'progress' : 'pointer', justifyContent: compacto ? 'flex-start' : 'center',
          transition: 'border-color 150ms var(--ease-out), background-color 150ms var(--ease-out)',
        }}>
        {enviando
          ? <span key="girando" className="troca" style={{ width: 24, height: 24, border: '2px solid var(--yt)', borderRightColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', flex: 'none' }} />
          : <FileUp key="icone" className="ico troca" style={{ width: 28, height: 28, color: 'var(--yt)' }} />}
        <span style={{ flex: compacto ? 1 : undefined, minWidth: 0 }}>
          <b>{enviando ? `${fase}… ${Math.round(prog * 100)}%` : 'Solte aqui os XML e PDF, ou clique para escolher'}</b><br />
          {enviando
            ? <span className="progresso" style={{ display: 'block', marginTop: 8, maxWidth: 420 }} role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ transform: `scaleX(${prog})` }} /></span>
            : <span className="small muted">XML do CT-e, do MDF-e e dos eventos de encerramento/cancelamento. PDF do DACTE/DAMDFE com a chave no nome do arquivo.</span>}
        </span>
        <input ref={input} type="file" multiple accept=".xml,.pdf,application/xml,text/xml,application/pdf" hidden onChange={(e) => e.target.files && enviar(e.target.files)} />
      </div>
      {erro && <p key={erro} className="aviso bad" role="alert">{erro}</p>}
      {res.length > 0 && (
        <div className="list surge" role="status">
          {res.map((r) => (
            <div key={`${r.arquivo}|${r.mensagem}`} style={{ justifyContent: 'flex-start', flexWrap: 'nowrap', gap: 10 }}>
              {r.ok ? <CheckCircle2 className="ico troca" style={{ color: 'var(--good)' }} /> : <XCircle className="ico troca" style={{ color: 'var(--bad)' }} />}
              <span><b className="small">{r.arquivo}</b><br /><span className="small" style={{ color: r.ok ? undefined : 'var(--bad)' }}>{r.mensagem}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
