'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import QRCode from 'qrcode'
import { X, Link2, Copy, MessageCircle, Check } from 'lucide-react'
import { gerarLinkAcesso, desconectarMotorista } from '../actions'

/** Janela para dar acesso ao motorista: link de entrada direta pelo WhatsApp ou QR code para escanear. */
export function Acesso({ id, nome, telefone, fechar, empresa }: { id: number; nome: string; telefone: string; fechar: string; empresa: string }) {
  const [link, setLink] = useState<string | null>(null)
  const [qr, setQr] = useState('')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [pend, start] = useTransition()
  const gerar = () => start(async () => {
    const r = await gerarLinkAcesso(id)
    if (r.erro || !r.link) return setErro(r.erro ?? 'Não foi possível gerar o link.')
    setLink(r.link)
    setQr(await QRCode.toString(r.link, { type: 'svg', margin: 0, color: { dark: '#04060a', light: '#ffffff' } }))
  })
  const msg = link ? `Olá, ${nome.split(' ')[0]}! Este é o app da ${empresa} para lançar suas viagens e gastos. Toque no link para entrar (vale por 7 dias):\n${link}\n\nDepois de entrar, coloque o app na tela inicial do celular.` : ''
  const zap = `https://wa.me/55${telefone}?text=${encodeURIComponent(msg)}`
  return (
    <div className="ov">
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="ac-t">
        <header><h2 id="ac-t">Acesso de {nome}</h2><Link href={fechar} scroll={false} className="btn sm ghost" aria-label="Fechar"><X className="ico" /></Link></header>
        {!link ? (
          <>
            <p className="muted">O jeito mais fácil: gere um link e envie pelo WhatsApp. O motorista toca e já entra no app, sem digitar nada. O link vale por 7 dias e o anterior deixa de funcionar.</p>
            <p className="muted">Ele também pode entrar a qualquer momento com o celular e o PIN do cadastro.</p>
            {erro && <p className="aviso bad">{erro}</p>}
            <button className="btn lg pri" onClick={gerar} disabled={pend}>{pend ? <span className="spin" /> : <Link2 className="ico" />}Gerar link de acesso</button>
          </>
        ) : (
          <>
            <a className="btn lg pri" href={zap} target="_blank" rel="noreferrer"><MessageCircle className="ico" />Enviar pelo WhatsApp</a>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="inp" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link de acesso" />
              <button className="btn" onClick={async () => { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }}>
                {copiado ? <Check className="ico" /> : <Copy className="ico" />}{copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="small muted" style={{ textAlign: 'center' }}>Ou peça para ele apontar a câmera do celular para o código:</p>
            <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          </>
        )}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%', margin: 0 }} />
        <form action={desconectarMotorista.bind(null, id, fechar)} className="row between">
          <span className="small muted">Celular perdido ou trocado? Desconecte de todos os aparelhos.</span>
          <button className="btn sm del">Desconectar aparelhos</button>
        </form>
      </div>
    </div>
  )
}
