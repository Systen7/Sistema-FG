import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Lista as EsqLista } from '@/components/esqueleto'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { ArrowLeft, Pencil, Plus, CheckCheck, Camera } from 'lucide-react'
import { db, schema as s } from '@/db'
import { config, viagem, motoristas, caminhoes } from '@/lib/dados'
import { calcViagem } from '@/lib/calc'
import { hoje } from '@/lib/datas'
import { dataCurta, dataLonga, num, reais, reaisC } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { IconeTipo, NOME_TIPO, STATUS } from '@/components/tipos'
import { Placas, Valor } from '../../ui'
import { documentosDasViagens } from '@/lib/documentos'
import { TabelaDocumentos } from '../../documentos/tabela'
import { Importador } from '../../documentos/importador'
import { usarFreteDosCte } from '../../documentos/actions'
import { camposViagem, camposDespesa } from '../../campos'
import { salvarViagem, excluirViagem, salvarDespesa, excluirDespesa, aprovarDespesa, aprovarVarias, recusarDespesa } from '../../actions'
import { Enviar } from '@/components/enviar'
import { Foto } from '@/components/foto'

export default async function DetalheViagem(props: PageProps<'/admin/viagens/[id]'>) {
  const { id } = await props.params
  const sp = await props.searchParams
  const v = await viagem(Number(id))
  if (!v) notFound()
  const [cfg, ms, cs] = await Promise.all([config(), motoristas(), caminhoes()])
  const c = calcViagem(v, cfg.retornoPct)
  const m = ms.find((x) => x.id === v.motoristaId), cam = cs.find((x) => x.id === v.caminhaoId)
  const aqui = `/admin/viagens/${v.id}`
  const pend = v.despesas.filter((d) => d.status === 'pendente')
  const editD = sp.despesa ? (sp.despesa === 'nova' ? 'nova' : v.despesas.find((d) => d.id === Number(sp.despesa))) : null
  const meta = cam?.metaConsumo ?? 0

  return (
    <>
      <div className="head">
        <div>
          <Link href="/admin/viagens" className="small row" style={{ gap: 4, textDecoration: 'none' }}><ArrowLeft className="ico" />Viagens</Link>
          <h1 style={{ marginTop: 6 }}>{v.origem} → {v.destino}</h1>
          <p className="row" style={{ gap: 8 }}>
            Viagem {v.id} · {m?.nome} · <Placas c={cam} /> · {v.carga} · {dataLonga(v.inicio)}{v.fim ? ` a ${dataLonga(v.fim)}` : ''}
            {v.status === 'andamento' ? <span className="chip run">Em viagem</span> : <span className="chip">Encerrada</span>}
          </p>
        </div>
        <Link href={`${aqui}?editar=1`} scroll={false} className="btn"><Pencil className="ico" />Editar viagem</Link>
      </div>

      <section className="hero">
        <div className="minis">
          <div><span className="lbl">Frete</span><b>{v.frete ? reais(v.frete) : '—'}</b>{!v.frete && <span className="chip warn">a confirmar</span>}</div>
          <div><span className="lbl">Despesas</span><b>{reais(c.total)}</b><span className="small muted">combustível {reais(c.diesel)} · pedágio {reais(c.pedagio)}</span></div>
          <div><span className="lbl">Comissão ({num(v.comissaoPct, v.comissaoPct % 1 ? 1 : 0)}%)</span><b>{reais(c.comissao)}</b></div>
          <div><span className="lbl">Lucro da viagem</span><b><Valor v={c.lucro} /></b>{v.status === 'andamento' && <span className="small muted">parcial</span>}</div>
        </div>
        <div className="minis">
          <div><span className="lbl">Km rodado</span><b>{c.km != null ? num(c.km) : '—'}</b><span className="small muted">{num(v.kmInicial)}{v.kmFinal ? ` → ${num(v.kmFinal)}` : ''}{v.kmVazio ? ` · ${num(v.kmVazio)} vazio` : ''}</span></div>
          <div><span className="lbl">Consumo</span><b>{c.consumo ? `${num(c.consumo, 2)} km/l` : '—'}</b>{c.consumo && c.consumo < meta ? <span className="chip warn">abaixo da meta {num(meta, 1)}</span> : <span className="small muted">{num(c.litros)} litros</span>}</div>
          <div><span className="lbl">Adiantamento</span><b>{reais(v.adiantamento)}</b></div>
          <div><span className="lbl">Deixou de ganhar</span><b>{reais(c.perdido)}</b><span className="small muted">comissão sobre o km vazio</span></div>
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Despesas ({v.despesas.length})</h2>
          <span className="row">
            {pend.length > 1 && <form action={aprovarVarias.bind(null, pend.map((d) => d.id), aqui)}><Enviar className="btn ok"><CheckCheck className="ico" />Aprovar as {pend.length} pendentes</Enviar></form>}
            <Link href={`${aqui}?despesa=nova`} scroll={false} className="btn pri"><Plus className="ico" />Lançar despesa</Link>
          </span>
        </header>
        {v.despesas.length === 0 ? <p className="muted">Nenhuma despesa lançada.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Comprovante</th><th>Tipo</th><th>Data</th><th>Quem pagou</th><th>Observação</th><th className="r">Valor</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {v.despesas.map((d) => (
                <tr key={d.id}>
                  <td>{d.fotoId ? <a href={`/api/fotos/${d.fotoId}`} target="_blank" rel="noreferrer"><Foto src={`/api/fotos/${d.fotoId}`} alt="Comprovante" className="foto-mini" /></a> : <span className="small muted row" style={{ gap: 4 }}><Camera className="ico" />sem foto</span>}</td>
                  <td><span className="row" style={{ flexWrap: 'nowrap' }}><IconeTipo tipo={d.tipo} />{NOME_TIPO[d.tipo] ?? d.tipo}{d.litros ? <span className="muted"> · {num(d.litros)} L · R$ {num(d.valor / 100 / d.litros, 2)}/L</span> : ''}</span></td>
                  <td>{dataCurta(d.data)}</td>
                  <td>{d.pagoPor === 'motorista' ? 'Motorista' : 'Empresa'}</td>
                  <td className="wrap small">{d.obs}{d.kmAbastecimento ? ` · km ${num(d.kmAbastecimento)}` : ''}{d.motivoRecusa ? <span style={{ color: 'var(--bad)' }}> · recusa: {d.motivoRecusa}</span> : ''}</td>
                  <td className="r"><b>{reaisC(d.valor)}</b></td>
                  <td><span className={`chip ${STATUS[d.status].c}`}>{d.status === 'pendente' ? 'Pendente' : STATUS[d.status].t}</span></td>
                  <td>
                    <span className="row" style={{ flexWrap: 'nowrap' }}>
                      <Link href={`${aqui}?despesa=${d.id}`} scroll={false} className="btn sm">Editar</Link>
                      {d.status === 'pendente' && <>
                        <form action={aprovarDespesa.bind(null, d.id, aqui)}><Enviar className="btn sm ok">Aprovar</Enviar></form>
                        <form action={recusarDespesa.bind(null, d.id, aqui)}><Enviar className="btn sm">Recusar</Enviar></form>
                      </>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={5}>Total (sem recusadas)</td><td className="r">{reaisC(c.total)}</td><td colSpan={2} /></tr></tfoot>
          </table></div>
        )}
      </section>

      {/* Documentos e histórico chegam depois (carregamento sob demanda), com esqueleto no lugar. */}
      <Suspense fallback={<EsqLista itens={2} />}>
        <SecaoDocumentos v={v} placa={cam?.placa ?? null} aqui={aqui} />
      </Suspense>
      <Suspense fallback={<EsqLista itens={3} botoes={0} />}>
        <SecaoHistorico v={v} ms={ms} />
      </Suspense>

      {sp.editar && (
        <FormModal titulo={`Editar viagem ${v.id}`} campos={camposViagem(ms.map((x) => [String(x.id), x.nome]), cs.map((x) => [String(x.id), x.placa]))}
          valores={{ ...v, motoristaId: String(v.motoristaId), caminhaoId: String(v.caminhaoId) }} acao={salvarViagem.bind(null, v.id, aqui)}
          excluir={excluirViagem.bind(null, v.id)} fechar={aqui} />
      )}
      {editD && (
        <FormModal titulo={editD === 'nova' ? 'Lançar despesa' : 'Editar despesa'} campos={camposDespesa}
          valores={editD === 'nova' ? { tipo: 'Diesel', data: hoje(), pagoPor: 'empresa', status: 'aprovada' } : editD}
          acao={salvarDespesa.bind(null, editD === 'nova' ? null : editD.id, v.id, aqui)} fechar={aqui}
          excluir={editD === 'nova' ? undefined : excluirDespesa.bind(null, editD.id, aqui)} />
      )}
    </>
  )
}

type ViagemC = NonNullable<Awaited<ReturnType<typeof viagem>>>

async function SecaoDocumentos({ v, placa, aqui }: { v: ViagemC; placa: string | null; aqui: string }) {
  const docs = await documentosDasViagens([v.id])
  const validos = docs.filter((d) => d.situacao !== 'cancelado')
  const freteCte = validos.filter((d) => d.tipo === 'cte').reduce((t, d) => t + (d.valor ?? 0), 0)
  const avisosFiscais: string[] = []
  for (const d of validos.filter((x) => x.tipo === 'mdfe')) {
    if (d.placa && placa && d.placa !== placa) avisosFiscais.push(`O MDF-e nº ${d.numero} foi emitido para a placa ${d.placa}, mas a viagem está com o ${placa}.`)
    if (d.situacao === 'autorizado' && v.status === 'encerrada') avisosFiscais.push(`O MDF-e nº ${d.numero} continua aberto e a viagem já terminou. Encerre no seu emissor e depois importe o XML do encerramento (ou clique em “Encerrado”).`)
  }
  if (v.status === 'encerrada' && !validos.some((d) => d.tipo === 'cte')) avisosFiscais.push('Nenhum CT-e importado para esta viagem.')
  return (
    <section className="panel entra">
      <header><h2>CT-e e MDF-e</h2><Link href="/admin/documentos" className="btn sm">Todos os documentos</Link></header>
      {avisosFiscais.map((t) => <p key={t} className="aviso warn">{t}</p>)}
      {freteCte > 0 && freteCte !== v.frete && (
        <form action={usarFreteDosCte.bind(null, v.id, freteCte, aqui)} className="aviso warn row between">
          <span>O frete da viagem ({reais(v.frete)}) é diferente do valor dos CT-e ({reais(freteCte)}).</span>
          <Enviar className="btn sm">Usar {reais(freteCte)} como frete</Enviar>
        </form>
      )}
      {docs.length > 0 && <TabelaDocumentos docs={docs} viagens={[v]} voltar={aqui} mostrarViagem={false} />}
      <Importador viagemId={v.id} compacto />
    </section>
  )
}

async function SecaoHistorico({ v, ms }: { v: ViagemC; ms: { id: number; nome: string }[] }) {
  const ids = v.despesas.map((d) => String(d.id))
  const hist = await db.select().from(s.auditoria).where(or(
    and(eq(s.auditoria.entidade, 'viagem'), eq(s.auditoria.entidadeId, String(v.id))),
    ids.length ? and(eq(s.auditoria.entidade, 'despesa'), inArray(s.auditoria.entidadeId, ids)) : undefined,
  )).orderBy(desc(s.auditoria.em)).limit(30)
  if (!hist.length) return null
  const autor = (a: string) => a.startsWith('motorista:') ? ms.find((x) => x.id === Number(a.split(':')[1]))?.nome ?? 'Motorista' : 'Escritório'
  return (
    <section className="panel entra">
      <header><h2>Histórico</h2><span className="small muted">quem fez o quê nesta viagem</span></header>
      <div className="list">
        {hist.map((h) => (
          <div key={h.id}><span><b>{autor(h.autor)}</b> {h.acao} {h.entidade === 'despesa' ? 'despesa' : 'a viagem'}{h.entidade === 'despesa' && h.dados && typeof h.dados === 'object' && 'valor' in h.dados ? ` de ${reaisC(Number((h.dados as { valor: number }).valor))}` : ''}</span>
            <span className="small muted">{h.em.toLocaleString('pt-BR', { timeZone: process.env.TZ_EMPRESA || 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</span></div>
        ))}
      </div>
    </section>
  )
}
