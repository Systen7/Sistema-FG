'use client'
import { useActionState } from 'react'
import { salvarConfig } from '../actions'

type C = {
  diasAviso: number
  diasUrgente: number
  kmAvisoRevisao: number
  sulcoMinimo: number
  retornoPct: number
  nomeEmpresa: string
  whatsappEscritorio: string | null
}

export function Regras({ cfg }: { cfg: C }) {
  const [st, enviar, pend] = useActionState(salvarConfig, undefined)
  return (
    <form action={enviar} className="form">
      <input type="hidden" name="voltar" value="/admin/alertas" />
      <input type="hidden" name="nomeEmpresa" value={cfg.nomeEmpresa} />
      <input type="hidden" name="whatsappEscritorio" value={cfg.whatsappEscritorio ?? ''} />
      <label className="campo">
        Avisar com quantos dias de antecedência
        <input name="diasAviso" inputMode="numeric" defaultValue={cfg.diasAviso} />
      </label>
      <label className="campo">
        Marcar urgente com quantos dias
        <input name="diasUrgente" inputMode="numeric" defaultValue={cfg.diasUrgente} />
      </label>
      <label className="campo">
        Avisar revisão faltando quantos km
        <input name="kmAvisoRevisao" inputMode="numeric" defaultValue={cfg.kmAvisoRevisao} />
      </label>
      <label className="campo">
        Sulco mínimo do pneu (mm)
        <input name="sulcoMinimo" inputMode="decimal" defaultValue={String(cfg.sulcoMinimo).replace('.', ',')} />
      </label>
      <label className="campo full">
        Frete de retorno, em % da ida (para o “deixou de ganhar”)
        <input name="retornoPct" inputMode="numeric" defaultValue={cfg.retornoPct} />
      </label>
      {st?.erro && (
        <p key={st.erro} className="err full" role="alert">
          {st.erro}
        </p>
      )}
      <div className="full">
        <button type="submit" className="btn pri" disabled={pend} aria-busy={pend}>
          {pend && <span className="spin" />}Salvar regras
        </button>
      </div>
    </form>
  )
}
