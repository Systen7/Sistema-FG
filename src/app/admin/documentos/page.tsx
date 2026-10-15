import Link from 'next/link'
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { Cabecalho } from '../ui'
import { Importador } from './importador'
import { TabelaDocumentos } from './tabela'

export const metadata = { title: 'Documentos fiscais' }

const FILTROS = [['', 'Todos'], ['abertos', 'MDF-e abertos'], ['sem-viagem', 'Sem viagem'], ['cte', 'Só CT-e'], ['mdfe', 'Só MDF-e']] as const

export default async function Documentos(props: PageProps<'/admin/documentos'>) {
  const sp = await props.searchParams
  const filtro = String(sp.ver ?? '')
  const cond: SQL | undefined =
    filtro === 'abertos' ? and(eq(s.documentos.tipo, 'mdfe'), eq(s.documentos.situacao, 'autorizado'))
      : filtro === 'sem-viagem' ? isNull(s.documentos.viagemId)
        : filtro === 'cte' || filtro === 'mdfe' ? eq(s.documentos.tipo, filtro) : undefined
  const [docs, todos, viagens] = await Promise.all([
    db.select().from(s.documentos).where(cond).orderBy(desc(s.documentos.emitidoEm), desc(s.documentos.id)).limit(300),
    db.select({ tipo: s.documentos.tipo, situacao: s.documentos.situacao, viagemId: s.documentos.viagemId }).from(s.documentos),
    db.select({ id: s.viagens.id, origem: s.viagens.origem, destino: s.viagens.destino, inicio: s.viagens.inicio }).from(s.viagens).orderBy(desc(s.viagens.inicio)).limit(300),
  ])
  const abertos = todos.filter((d) => d.tipo === 'mdfe' && d.situacao === 'autorizado').length
  const semViagem = todos.filter((d) => !d.viagemId).length
  const aqui = '/admin/documentos' + (filtro ? `?ver=${filtro}` : '')
  return (
    <>
      <Cabecalho titulo="Documentos fiscais" texto="CT-e e MDF-e emitidos no seu emissor. Importe os XML: o sistema lê os dados, liga cada documento à viagem e avisa se algum MDF-e ficar sem encerrar." />
      <section className="panel">
        <header><h2>Importar</h2><span className="small muted">pode mandar vários de uma vez</span></header>
        <Importador />
        <p className="small muted">O MDF-e é ligado sozinho à viagem do caminhão com a mesma placa naquela data, e leva junto os CT-e que ele cita. Para dar baixa num MDF-e, importe o XML do evento de encerramento ou use o botão “Encerrado”.</p>
      </section>
      <nav className="seg" aria-label="Filtro">
        {FILTROS.map(([k, n]) => (
          <Link key={k} href={k ? `/admin/documentos?ver=${k}` : '/admin/documentos'} aria-current={filtro === k ? 'page' : undefined}>
            {n}{k === 'abertos' && abertos ? ` (${abertos})` : k === 'sem-viagem' && semViagem ? ` (${semViagem})` : ''}
          </Link>
        ))}
      </nav>
      <section className="panel"><TabelaDocumentos docs={docs} viagens={viagens} voltar={aqui} /></section>
    </>
  )
}
