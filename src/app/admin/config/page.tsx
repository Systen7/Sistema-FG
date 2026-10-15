import { desc } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { exigirAdmin } from '@/lib/auth'
import { config, motoristas } from '@/lib/dados'
import { telefone } from '@/lib/format'
import { Cabecalho } from '../ui'
import { removerAdmin } from '../actions'
import { FormEmpresa, FormSenha, FormNovoAdmin } from './forms'
import { Enviar } from '@/components/enviar'

export const metadata = { title: 'Configurações' }

export default async function Config() {
  const eu = await exigirAdmin()
  const [cfg, adms, ms, hist] = await Promise.all([
    config(),
    db.select().from(s.administradores),
    motoristas(),
    db.select().from(s.auditoria).orderBy(desc(s.auditoria.em)).limit(60),
  ])
  const autor = (a: string) => {
    const [t, id] = a.split(':')
    return t === 'motorista' ? (ms.find((m) => m.id === Number(id))?.nome ?? 'Motorista') : (adms.find((x) => x.id === Number(id))?.nome ?? 'Escritório')
  }
  const tz = process.env.TZ_EMPRESA || 'America/Sao_Paulo'
  return (
    <>
      <Cabecalho titulo="Configurações" texto="Dados da empresa, acessos do escritório e histórico de alterações." />
      <div className="cols">
        <section className="panel">
          <header>
            <h2>Empresa</h2>
          </header>
          <FormEmpresa cfg={{ ...cfg, whatsappEscritorio: cfg.whatsappEscritorio ? telefone(cfg.whatsappEscritorio) : '' }} />
        </section>
        <section className="panel">
          <header>
            <h2>Sua senha</h2>
          </header>
          <FormSenha />
        </section>
      </div>
      <section className="panel">
        <header>
          <h2>Acessos do escritório</h2>
        </header>
        <div className="list">
          {adms.map((a) => (
            <div key={a.id}>
              <span>
                <b>{a.nome}</b> <span className="muted small">usuário {a.usuario}</span>
                {a.id === eu.id && (
                  <span className="chip run" style={{ marginLeft: 6 }}>
                    você
                  </span>
                )}
              </span>
              {a.id !== eu.id && (
                <form action={removerAdmin.bind(null, a.id)}>
                  <Enviar className="btn sm del ghost">Remover acesso</Enviar>
                </form>
              )}
            </div>
          ))}
        </div>
        <details>
          <summary className="btn sm" style={{ listStyle: 'none', display: 'inline-flex' }}>
            Adicionar pessoa do escritório
          </summary>
          <div style={{ marginTop: 12 }}>
            <FormNovoAdmin />
          </div>
        </details>
      </section>
      <section className="panel">
        <header>
          <h2>Histórico de alterações</h2>
          <span className="small muted">últimas 60 ações</span>
        </header>
        {hist.length ? (
          <div className="scroll">
            <table className="tabela-longa">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>O quê</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.id}>
                    <td className="small">{h.em.toLocaleString('pt-BR', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{autor(h.autor)}</td>
                    <td>
                      {h.acao} {h.entidade}
                      {h.entidadeId ? ` ${h.entidadeId}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhuma alteração registrada ainda.</p>
        )}
      </section>
    </>
  )
}
