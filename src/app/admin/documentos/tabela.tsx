import Link from 'next/link'
import { FileText, FileCode2, Plus, Trash2 } from 'lucide-react'
import type { Documento, Viagem } from '@/db/schema'
import { dataDe, dias } from '@/lib/datas'
import { dataCurta, dataLonga, reais } from '@/lib/format'
import { formatarChave, nomeCidade, textoCarga } from '@/lib/fiscal'
import { ligarDoc, marcarEncerrado, reabrirDoc, excluirDoc, anexarPdfDoc } from './actions'

export function Situacao({ d }: { d: Documento }) {
  if (d.situacao === 'cancelado') return <span className="chip bad">Cancelado</span>
  if (d.situacao === 'sem_protocolo') return <span className="chip warn">Sem protocolo</span>
  if (d.tipo === 'mdfe') return d.situacao === 'encerrado'
    ? <span className="chip ok">Encerrado{d.encerradoEm ? ' ' + dataCurta(dataDe(d.encerradoEm)) : ''}</span>
    : <span className="chip run">Aberto</span>
  return <span className="chip ok">Autorizado</span>
}

/** Tabela de CT-e e MDF-e com as ações de cada um. */
export function TabelaDocumentos({ docs, viagens, voltar, mostrarViagem = true }: {
  docs: Documento[]; viagens: Pick<Viagem, 'id' | 'origem' | 'destino' | 'inicio'>[]; voltar: string; mostrarViagem?: boolean
}) {
  if (!docs.length) return <p className="muted">Nenhum documento.</p>
  return (
    <div className="scroll"><table>
      <thead><tr><th>Documento</th><th>Emissão</th><th>Rota e carga</th><th className="r">Valor</th>{mostrarViagem && <th>Viagem</th>}<th /></tr></thead>
      <tbody>
        {docs.map((d) => {
          const emissao = dataDe(d.emitidoEm)
          const proximas = viagens.filter((v) => Math.abs(dias(v.inicio, emissao)) <= 20).slice(0, 25)
          return (
            <tr key={d.id}>
              <td>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <span className={'chip ' + (d.tipo === 'mdfe' ? 'run' : '')}>{d.tipo === 'cte' ? 'CT-e' : 'MDF-e'}</span><b>nº {d.numero}</b><Situacao d={d} />
                </span>
                <span className="small muted tnum" title="Chave de acesso" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, display: 'block', marginTop: 4, whiteSpace: 'normal', maxWidth: 250 }}>{formatarChave(d.chave)}</span>
              </td>
              <td>{dataLonga(emissao)}</td>
              <td className="wrap">
                {nomeCidade(d.origem) || '—'} → {nomeCidade(d.destino) || '—'}
                <br /><span className="small muted">{[textoCarga(d.produto, d.pesoKg), d.placa, d.remetente].filter(Boolean).join(' · ')}</span>
              </td>
              <td className="r">{d.valor != null ? reais(d.valor) : '—'}<br /><span className="small muted">{d.tipo === 'cte' ? 'frete' : 'carga'}</span></td>
              {mostrarViagem && (
                <td>
                  <form action={ligarDoc.bind(null, d.id, voltar)} className="row" style={{ flexWrap: 'nowrap' }}>
                    <select name="viagemId" defaultValue={d.viagemId ?? ''} className="inp" style={{ minHeight: 34, padding: '4px 8px', width: 'auto', maxWidth: 190, fontSize: 13 }} data-autosubmit aria-label="Viagem">
                      <option value="">Sem viagem</option>
                      {d.viagemId && !proximas.some((v) => v.id === d.viagemId) && <option value={d.viagemId}>Viagem {d.viagemId}</option>}
                      {proximas.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.origem.split('/')[0]} → {v.destino.split('/')[0]} · {dataCurta(v.inicio)}</option>)}
                    </select>
                    {d.viagemId ? <Link href={`/admin/viagens/${d.viagemId}`} className="btn sm">Abrir</Link>
                      : <Link href={`/admin/viagens?novo=1&doc=${d.id}`} scroll={false} className="btn sm pri" title="Criar a viagem com os dados deste documento"><Plus className="ico" />Viagem</Link>}
                  </form>
                </td>
              )}
              <td>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  {d.pdfId
                    ? <a className="btn sm" href={`/api/documentos/${d.id}/pdf`} target="_blank" rel="noreferrer"><FileText className="ico" />PDF</a>
                    : (
                      <form action={anexarPdfDoc.bind(null, d.id, voltar)}>
                        <label className="btn sm" title="Anexar o PDF (DACTE/DAMDFE)"><FileText className="ico" />+ PDF
                          <input type="file" name="pdf" accept="application/pdf,.pdf" hidden data-autosubmit />
                        </label>
                      </form>
                    )}
                  <a className="btn sm ghost" href={`/api/documentos/${d.id}/xml`} title="Baixar o XML"><FileCode2 className="ico" /></a>
                  {d.tipo === 'mdfe' && d.situacao === 'autorizado' && <form action={marcarEncerrado.bind(null, d.id, voltar)}><button className="btn sm ok" title="Use depois de encerrar no seu emissor">Encerrado</button></form>}
                  {d.tipo === 'mdfe' && d.situacao === 'encerrado' && <form action={reabrirDoc.bind(null, d.id, voltar)}><button className="btn sm ghost">Desfazer</button></form>}
                  <details style={{ position: 'relative' }}>
                    <summary className="btn sm ghost" style={{ listStyle: 'none' }} aria-label="Excluir"><Trash2 className="ico" /></summary>
                    <form action={excluirDoc.bind(null, d.id, voltar)} className="panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 5, width: 260, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                      <p className="small">Tira o documento do sistema (não cancela na SEFAZ).</p>
                      <button className="btn sm del solid">Excluir do sistema</button>
                    </form>
                  </details>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table></div>
  )
}
