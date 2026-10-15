'use client'
import { useActionState } from 'react'
import { salvarConfig, trocarSenha, novoAdmin } from '../actions'
import type { Configuracao } from '@/db/schema'

export function FormEmpresa({ cfg }: { cfg: Configuracao }) {
  const [st, enviar, pend] = useActionState(salvarConfig, undefined)
  return (
    <form action={enviar} className="form">
      {(['diasAviso', 'diasUrgente', 'kmAvisoRevisao', 'retornoPct'] as const).map((k) => (
        <input key={k} type="hidden" name={k} value={cfg[k]} />
      ))}
      <input type="hidden" name="sulcoMinimo" value={String(cfg.sulcoMinimo)} />
      <label className="campo full">
        Nome que aparece no app
        <input name="nomeEmpresa" defaultValue={cfg.nomeEmpresa} />
      </label>
      <label className="campo full">
        WhatsApp do escritório
        <input name="whatsappEscritorio" type="tel" defaultValue={cfg.whatsappEscritorio ?? ''} placeholder="(66) 99999-0000" />
        <span className="dica">Aparece para o motorista como “Falar com o escritório” e “Pedir ajuda” na tela de entrada.</span>
      </label>
      {st?.erro && (
        <p key={st.erro} className="err full" role="alert">
          {st.erro}
        </p>
      )}
      <div className="full">
        <button type="submit" className="btn pri" disabled={pend} aria-busy={pend}>
          {pend && <span className="spin" />}Salvar
        </button>
      </div>
    </form>
  )
}

export function FormSenha() {
  const [st, enviar, pend] = useActionState(trocarSenha, undefined)
  return (
    <form action={enviar} className="form">
      <label className="campo full">
        Senha atual
        <input name="atual" type="password" autoComplete="current-password" />
      </label>
      <label className="campo">
        Nova senha
        <input name="nova" type="password" autoComplete="new-password" />
        <span className="dica">Pelo menos 8 caracteres.</span>
      </label>
      <label className="campo">
        Repita a nova senha
        <input name="confirma" type="password" autoComplete="new-password" />
      </label>
      {st?.erro && (
        <p key={st.erro} className="err full" role="alert">
          {st.erro}
        </p>
      )}
      <div className="full">
        <button type="submit" className="btn pri" disabled={pend} aria-busy={pend}>
          {pend && <span className="spin" />}Trocar senha
        </button>
      </div>
    </form>
  )
}

export function FormNovoAdmin() {
  const [st, enviar, pend] = useActionState(novoAdmin, undefined)
  return (
    <form action={enviar} className="form">
      <label className="campo">
        Nome
        <input name="nome" />
      </label>
      <label className="campo">
        Usuário
        <input name="usuario" autoCapitalize="none" />
      </label>
      <label className="campo">
        Senha inicial
        <input name="senha" type="password" autoComplete="new-password" />
      </label>
      {st?.erro && (
        <p key={st.erro} className="err full" role="alert">
          {st.erro}
        </p>
      )}
      <div className="full">
        <button type="submit" className="btn pri" disabled={pend} aria-busy={pend}>
          {pend && <span className="spin" />}Criar acesso
        </button>
      </div>
    </form>
  )
}
