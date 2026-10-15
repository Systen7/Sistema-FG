'use client'
import { useActionState } from 'react'
import { criarPrimeiroAdmin } from './actions'

export function PrimeiroAcesso() {
  const [st, enviar, pend] = useActionState(criarPrimeiroAdmin, undefined)
  return (
    <form action={enviar} className="stack">
      <label className="campo">
        Seu nome
        <input name="nome" autoComplete="name" required />
      </label>
      <label className="campo">
        Nome da empresa (aparece no app)
        <input name="empresa" defaultValue="Empresa FG" />
      </label>
      <label className="campo">
        Usuário para entrar
        <input name="usuario" autoCapitalize="none" autoComplete="username" required />
        <span className="dica">Sem espaços. Ex.: andrey</span>
      </label>
      <label className="campo">
        Senha
        <input name="senha" type="password" autoComplete="new-password" required />
        <span className="dica">Pelo menos 8 caracteres.</span>
      </label>
      <label className="campo">
        Repita a senha
        <input name="confirma" type="password" autoComplete="new-password" required />
      </label>
      {st?.erro && (
        <p className="err" role="alert">
          {st.erro}
        </p>
      )}
      <button type="submit" className="btn lg pri" disabled={pend} aria-busy={pend}>
        {pend && <span className="spin" />}Criar acesso e entrar
      </button>
    </form>
  )
}
