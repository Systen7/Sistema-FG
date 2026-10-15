import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config, viagensFiltradas, motoristas, caminhoes, mesesDisponiveis, sugestoes } from '@/lib/dados'
import { documentosDasViagens } from '@/lib/documentos'
import { nomeCidade, textoCarga } from '@/lib/fiscal'
import { calcViagem } from '@/lib/calc'
import { dataDe, hoje, mesAtual, mesValido, nomeMes } from '@/lib/datas'
import { dataCurta, num, reais } from '@/lib/format'
import { FormModal } from '@/components/form-modal'
import { Cabecalho, Placa, Valor, Vazio } from '../ui'
import { camposViagem } from '../campos'
import { salvarViagem } from '../actions'

export const metadata = { title: 'Viagens' }

export default async function Viagens(props: PageProps<'/admin/viagens'>) {
  const sp = await props.searchParams
  const status = sp.status === 'andamento' || sp.status === 'encerrada' ? sp.status : undefined
  const motoristaId = Number(sp.motorista) || undefined
  const mes = mesValido(sp.mes) ? sp.mes : undefined
  const [cfg, ms, cs, meses] = await Promise.all([config(), motoristas(), caminhoes(), mesesDisponiveis(mesAtual())])
  const vs = await viagensFiltradas({ status, motoristaId, mes })
  const q = new URLSearchParams(
    Object.entries({ status, motorista: motoristaId, mes })
      .filter(([, v]) => v)
      .map(([k, v]) => [k, String(v)]),
  )
  const aqui = `/admin/viagens${q.size ? `?${q}` : ''}`
  const tot = vs.reduce(
    (a, v) => {
      const c = calcViagem(v, cfg.retornoPct)
      a.frete += v.frete
      a.desp += c.total
      a.com += c.comissao
      if (v.status === 'encerrada') a.lucro += c.lucro
      return a
    },
    { frete: 0, desp: 0, com: 0, lucro: 0 },
  )
  const optM: [string, string][] = ms.map((m) => [String(m.id), m.nome]),
    optC: [string, string][] = cs.map((c) => [String(c.id), c.placa])
  const docs = await documentosDasViagens(vs.map((v) => v.id))

  // Nova viagem: valores padrão, ou lidos de um CT-e/MDF-e (?doc=ID)
  const [doc] =
    sp.novo && Number(sp.doc)
      ? await db
          .select()
          .from(schema.documentos)
          .where(eq(schema.documentos.id, Number(sp.doc)))
      : []
  const motPadrao = ms.find((m) => m.ativo) ?? ms[0]
  let novo: Record<string, unknown> = {
    motoristaId: motPadrao?.id,
    caminhaoId: motPadrao?.caminhaoId ?? cs[0]?.id,
    inicio: hoje(),
    status: 'andamento',
    kmInicial: cs.find((c) => c.id === motPadrao?.caminhaoId)?.km,
    kmVazio: 0,
  }
  if (doc) {
    const cam = doc.placa ? cs.find((c) => c.placa === doc.placa) : undefined
    const mot = cam ? ms.find((m) => m.caminhaoId === cam.id && m.ativo) : undefined
    const ctes =
      doc.tipo === 'mdfe' && doc.chavesCte?.length ? await db.select().from(schema.documentos).where(inArray(schema.documentos.chave, doc.chavesCte)) : []
    const frete = doc.tipo === 'cte' ? (doc.valor ?? 0) : ctes.filter((c) => c.situacao !== 'cancelado').reduce((t, c) => t + (c.valor ?? 0), 0)
    const { cidades } = await sugestoes()
    novo = {
      ...novo,
      ...(mot ? { motoristaId: mot.id } : {}),
      ...(cam ? { caminhaoId: cam.id, kmInicial: cam.km } : {}),
      origem: nomeCidade(doc.origem, cidades),
      destino: nomeCidade(doc.destino, cidades),
      carga: textoCarga(doc.produto, doc.pesoKg),
      frete: frete || '',
      inicio: dataDe(doc.emitidoEm),
    }
  }

  return (
    <>
      <Cabecalho titulo="Viagens" texto="Todas as viagens de todos os motoristas. Clique numa viagem para ver as despesas, as fotos e corrigir o que precisar.">
        <a className="btn" href={`/api/admin/exportar?tipo=viagens${mes ? `&mes=${mes}` : ''}`}>
          <Download className="ico" />
          Planilha
        </a>
        <Link href={`${aqui}${q.size ? '&' : '?'}novo=1`} scroll={false} className="btn pri">
          <Plus className="ico" />
          Nova viagem
        </Link>
      </Cabecalho>

      <form className="row" action="/admin/viagens">
        <select
          name="status"
          defaultValue={status ?? ''}
          className="inp"
          style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }}
          data-autosubmit
          aria-label="Situação"
        >
          <option value="">Todas as situações</option>
          <option value="andamento">Em viagem</option>
          <option value="encerrada">Encerradas</option>
        </select>
        <select
          name="motorista"
          defaultValue={motoristaId ?? ''}
          className="inp"
          style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }}
          data-autosubmit
          aria-label="Motorista"
        >
          <option value="">Todos os motoristas</option>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
        <select
          name="mes"
          defaultValue={mes ?? ''}
          className="inp"
          style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }}
          data-autosubmit
          aria-label="Mês de início"
        >
          <option value="">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>
              {nomeMes(m)}
            </option>
          ))}
        </select>
        {q.size > 0 && (
          <Link href="/admin/viagens" className="btn sm ghost">
            Limpar filtros
          </Link>
        )}
      </form>

      <section className="panel">
        {vs.length === 0 ? (
          <Vazio>Nenhuma viagem com estes filtros.</Vazio>
        ) : (
          <div className="scroll">
            <table className="tabela-longa">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Motorista</th>
                  <th>Caminhão</th>
                  <th>Rota e carga</th>
                  <th>Início</th>
                  <th className="r">Km</th>
                  <th className="r">Frete</th>
                  <th className="r">Despesas</th>
                  <th className="r">Comissão</th>
                  <th className="r">Lucro</th>
                  <th>Situação</th>
                  <th>CT-e / MDF-e</th>
                </tr>
              </thead>
              <tbody>
                {vs.map((v) => {
                  const c = calcViagem(v, cfg.retornoPct)
                  const href = `/admin/viagens/${v.id}`
                  return (
                    <tr key={v.id} className="click" data-href={href}>
                      <td>
                        <Link href={href}>{v.id}</Link>
                      </td>
                      <td>{ms.find((m) => m.id === v.motoristaId)?.nome}</td>
                      <td>
                        <Placa c={cs.find((x) => x.id === v.caminhaoId)} />
                      </td>
                      <td className="wrap">
                        <Link href={href} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {v.origem} → {v.destino}
                          <br />
                          <span className="small muted">{v.carga}</span>
                        </Link>
                      </td>
                      <td>
                        {dataCurta(v.inicio)}
                        {v.fim ? <span className="muted"> a {dataCurta(v.fim)}</span> : ''}
                      </td>
                      <td className="r">{c.km != null ? num(c.km) : '—'}</td>
                      <td className="r">{v.frete ? reais(v.frete) : <span className="chip warn">a confirmar</span>}</td>
                      <td className="r">
                        {reais(c.total)}
                        {c.pendentes ? (
                          <>
                            <br />
                            <span className="chip warn">
                              {c.pendentes} pendente{c.pendentes > 1 ? 's' : ''}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td className="r">{reais(c.comissao)}</td>
                      <td className="r">{v.status === 'encerrada' ? <Valor v={c.lucro} /> : <span className="muted">em aberto</span>}</td>
                      <td>{v.status === 'andamento' ? <span className="chip run">Em viagem</span> : <span className="chip">Encerrada</span>}</td>
                      <td>
                        <Fiscais docs={docs.filter((d) => d.viagemId === v.id)} encerrada={v.status === 'encerrada'} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>
                    {vs.length} {vs.length === 1 ? 'viagem' : 'viagens'}
                  </td>
                  <td className="r">{reais(tot.frete)}</td>
                  <td className="r">{reais(tot.desp)}</td>
                  <td className="r">{reais(tot.com)}</td>
                  <td className="r">
                    <Valor v={tot.lucro} />
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {sp.novo && (
        <FormModal
          titulo={doc ? `Nova viagem pelo ${doc.tipo === 'cte' ? 'CT-e' : 'MDF-e'} nº ${doc.numero}` : 'Nova viagem'}
          campos={camposViagem(optM, optC)}
          acao={salvarViagem.bind(null, null, '#nova')}
          fechar={doc ? '/admin/documentos' : aqui}
          valores={novo}
          ocultos={doc ? { docId: String(doc.id) } : undefined}
          extra={
            doc ? (
              <p className="aviso info">Dados preenchidos pelo XML. Confira motorista, caminhão e km antes de salvar; o documento fica ligado à viagem.</p>
            ) : undefined
          }
        />
      )}
    </>
  )
}

/** Resumo dos documentos fiscais da viagem numa célula: números de CT-e e MDF-e, com alerta de MDF-e aberto. */
function Fiscais({ docs, encerrada }: { docs: { tipo: string; numero: number; situacao: string }[]; encerrada: boolean }) {
  const ctes = docs.filter((d) => d.tipo === 'cte' && d.situacao !== 'cancelado')
  const mdfes = docs.filter((d) => d.tipo === 'mdfe' && d.situacao !== 'cancelado')
  const aberto = mdfes.some((d) => d.situacao === 'autorizado')
  if (!docs.length)
    return encerrada ? (
      <span className="chip warn" title="Nenhum CT-e importado para esta viagem">
        sem CT-e
      </span>
    ) : (
      <span className="muted small">—</span>
    )
  return (
    <span className="small">
      {ctes.length ? `CT-e ${ctes.map((d) => d.numero).join(', ')}` : <span className="chip warn">sem CT-e</span>}
      {mdfes.length > 0 && (
        <>
          <br />
          MDF-e {mdfes.map((d) => d.numero).join(', ')}{' '}
          {aberto && <span className={`chip ${encerrada ? 'bad' : 'run'}`}>{encerrada ? 'aberto!' : 'aberto'}</span>}
        </>
      )}
    </span>
  )
}
