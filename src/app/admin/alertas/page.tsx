import Link from 'next/link'
import { Plus } from 'lucide-react'
import { config, motoristas, caminhoes, apolices, lembretes, pneus, dispensados, mdfeAbertos } from '@/lib/dados'
import { calcAlertas } from '@/lib/alertas'
import { hoje } from '@/lib/datas'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Vence } from '../ui'
import { camposLembrete } from '../campos'
import { dispensarAlerta, restaurarAlertas, salvarLembrete, excluirLembrete } from '../actions'
import { Regras } from './regras'

export const metadata = { title: 'Alertas' }

export default async function Alertas(props: PageProps<'/admin/alertas'>) {
  const sp = await props.searchParams
  const H = hoje()
  const [cfg, ms, cs, ap, lb, pn, ds, mdfes] = await Promise.all([config(), motoristas(), caminhoes(), apolices(), lembretes(), pneus(), dispensados(), mdfeAbertos()])
  const todos = calcAlertas(H, { motoristas: ms, caminhoes: cs, apolices: ap, lembretes: lb, pneus: pn, cfg, mdfes })
  const ativos = todos.filter((a) => !ds.has(a.chave))
  const ocultos = todos.length - ativos.length
  const ed = sp.editar ? (sp.editar === 'novo' ? 'novo' : lb.find((l) => l.id === Number(sp.editar))) : null
  return (
    <>
      <Cabecalho titulo="Alertas" texto="Vencimentos de documentos, seguros, revisões e pneus. Corrija a data na hora ou dispense o que já resolveu.">
        <Link href="/admin/alertas?editar=novo" scroll={false} className="btn pri"><Plus className="ico" />Novo lembrete</Link>
      </Cabecalho>
      <div className="cols">
        <section className="panel">
          <header>
            <h2>Ativos ({ativos.length})</h2>
            {ocultos > 0 && <form action={restaurarAlertas.bind(null, '/admin/alertas')}><button className="btn sm">Mostrar {ocultos} dispensado{ocultos > 1 ? 's' : ''}</button></form>}
          </header>
          {ativos.length ? (
            <div className="list">
              {ativos.map((a) => (
                <div key={a.chave}>
                  <span>{a.texto}<br /><span className={'chip ' + (a.urgente ? 'bad' : 'warn')}>{a.detalhe}</span></span>
                  <span className="row">
                    <Link href={a.link} className="btn sm">Resolver</Link>
                    <form action={dispensarAlerta.bind(null, a.chave, '/admin/alertas')}><button className="btn sm ghost">Dispensar</button></form>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="empty">Tudo em dia. Nenhum alerta ativo.</p>}
        </section>
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel">
            <header><h2>Regras de aviso</h2></header>
            <Regras cfg={{ diasAviso: cfg.diasAviso, diasUrgente: cfg.diasUrgente, kmAvisoRevisao: cfg.kmAvisoRevisao, sulcoMinimo: cfg.sulcoMinimo, retornoPct: cfg.retornoPct, nomeEmpresa: cfg.nomeEmpresa, whatsappEscritorio: cfg.whatsappEscritorio }} />
          </section>
          <section className="panel">
            <header><h2>Seus lembretes</h2></header>
            {lb.length ? (
              <div className="list">
                {lb.map((l) => <div key={l.id}><span>{l.texto}</span><span className="row"><Vence d={l.data} hoje={H} aviso={cfg.diasAviso} urgente={cfg.diasUrgente} /><Link href={`/admin/alertas?editar=${l.id}`} scroll={false} className="btn sm">Editar</Link></span></div>)}
              </div>
            ) : <p className="muted">Nenhum lembrete. Use para contratos, renovações, pagamentos…</p>}
          </section>
        </div>
      </div>
      {ed && (
        <FormModal titulo={ed === 'novo' ? 'Novo lembrete' : 'Editar lembrete'} campos={camposLembrete} valores={ed === 'novo' ? {} : ed}
          acao={salvarLembrete.bind(null, ed === 'novo' ? null : ed.id, '/admin/alertas')} fechar="/admin/alertas"
          excluir={ed === 'novo' ? undefined : excluirLembrete.bind(null, ed.id, '/admin/alertas')} />
      )}
    </>
  )
}
