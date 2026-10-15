import { Suspense } from 'react'
import Link from 'next/link'
import { eq, and, desc } from 'drizzle-orm'
import { Plus, Flag, Play, Fuel, ChevronRight, IdCard, MessageCircle } from 'lucide-react'
import { db, schema as s } from '@/db'
import { exigirMotorista } from '@/lib/auth'
import { config, viagemAtiva, viagensDoMes } from '@/lib/dados'
import { agregar, calcViagem } from '@/lib/calc'
import { dias, hoje, mesAtual, nomeMes } from '@/lib/datas'
import { dataCurta, dataLonga, num, primeiroNome, reais, reaisC } from '@/lib/format'
import { ListaGastos } from './lista-gastos'
import { DocumentosViagem } from './documentos'
import { documentosDasViagens } from '@/lib/documentos'
import { MLista } from '@/components/esqueleto'

export default async function Viagem() {
  const m = await exigirMotorista()
  const [cfg, v] = await Promise.all([config(), viagemAtiva(m.id)])
  const [cam] = m.caminhaoId ? await db.select().from(s.caminhoes).where(eq(s.caminhoes.id, m.caminhaoId)) : []
  const H = hoje()
  const docs = ([['CNH', m.cnhAte], ['Exame toxicológico', m.toxicologicoAte]] as const)
    .filter(([, d]) => d && dias(H, d) <= 30).map(([n, d]) => ({ n, d: d!, x: dias(H, d!) }))
  const zap = cfg.whatsappEscritorio ? `https://wa.me/55${cfg.whatsappEscritorio}` : null

  return (
    <>
      <div>
        <p className="lbl">{cam ? <><span className="plate">{cam.placa}</span>{cam.placaCarreta && <> <span className="plate">{cam.placaCarreta}</span></>}</> : 'Sem caminhão definido'}</p>
        <h1 style={{ marginTop: 8 }}>Olá, {primeiroNome(m.nome)}</h1>
      </div>

      {docs.map((d) => (
        <div key={d.n} className={'aviso ' + (d.x <= 7 ? 'bad' : 'warn')}>
          <IdCard className="ico" />
          <span>{d.n} {d.x < 0 ? `venceu em ${dataLonga(d.d)}` : d.x === 0 ? 'vence hoje' : `vence em ${d.x} dias (${dataLonga(d.d)})`}. Renove e avise o escritório.</span>
        </div>
      ))}

      {v ? <ViagemAtiva v={v} retorno={cfg.retornoPct} /> : (
        <section className="trip">
          <div>
            <h2>Nenhuma viagem em andamento</h2>
            <p className="muted" style={{ marginTop: 4 }}>Quando pegar a próxima carga, toque abaixo. Leva menos de um minuto.</p>
          </div>
          {cam ? (
            <Link href="/m/iniciar" className="acao pri"><Play className="ico" /><span>Iniciar viagem<small>Origem, destino, carga e frete</small></span></Link>
          ) : (
            <p className="aviso warn">Você está sem caminhão no cadastro. Peça ao escritório para definir antes de iniciar.</p>
          )}
        </section>
      )}

      <Suspense fallback={<MLista itens={1} />}><SecaoMes motoristaId={m.id} retorno={cfg.retornoPct} /></Suspense>

      {zap && <a className="acao" href={zap}><MessageCircle className="ico" /><span>Falar com o escritório<small>Abre o WhatsApp</small></span></a>}
    </>
  )
}

function ViagemAtiva({ v, retorno }: { v: Awaited<ReturnType<typeof viagemAtiva>> & {}; retorno: number }) {
  const c = calcViagem(v, retorno)
  const semFrete = v.frete === 0
  return (
    <>
      <section className="trip" aria-labelledby="rota">
        <div className="row between">
          <span className="chip run">Viagem {v.id} em andamento</span>
          <span className="small muted">desde {dataCurta(v.inicio)}</span>
        </div>
        <p className="rota" id="rota">{v.origem}<br /><span className="seta">→ {v.destino}</span></p>
        <p className="muted">{v.carga} · saiu com {num(v.kmInicial)} km</p>
        <div className="kv">
          <div><span className="lbl">Frete</span><b>{semFrete ? <span className="warnc" style={{ fontSize: 18 }}>a confirmar</span> : reais(v.frete)}</b></div>
          <div><span className="lbl">Sua comissão</span><b className="y">{semFrete ? '—' : reais(c.comissao)}</b></div>
        </div>
        <div className="acoes">
          <Link href="/m/gasto" className="acao pri"><Plus className="ico" /><span>Lançar gasto<small>Diesel, pedágio, comida, borracharia…</small></span></Link>
          <Link href="/m/encerrar" className="acao"><Flag className="ico" /><span>Encerrar viagem<small>Quando descarregar no destino</small></span></Link>
        </div>
      </section>

      {/* sem esqueleto: a maioria das viagens não tem documento, e um bloco cinza que some depois seria pior */}
      <Suspense fallback={null}><SecaoDocumentos viagemId={v.id} /></Suspense>

      <section className="panel">
        <header>
          <h2>Gastos desta viagem</h2>
          <b className="tnum" style={{ fontSize: 20 }}>{reaisC(c.total)}</b>
        </header>
        {c.litros > 0 && <p className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Fuel className="ico" />{num(c.litros)} litros abastecidos</p>}
        <ListaGastos viagemId={v.id} gastos={v.despesas.map((d) => ({ id: d.id, tipo: d.tipo, valor: d.valor, litros: d.litros, data: d.data, obs: d.obs, status: d.status, motivo: d.motivoRecusa, foto: d.fotoId, pagoPor: d.pagoPor }))} />
        <p className="small muted">Toque num gasto para corrigir. Gasto corrigido volta para o escritório aprovar.</p>
      </section>
    </>
  )
}

/** Documentos da viagem: carrega à parte para a tela abrir sem esperar. */
async function SecaoDocumentos({ viagemId }: { viagemId: number }) {
  const docs = await documentosDasViagens([viagemId])
  return <DocumentosViagem docs={docs.map((d) => ({ id: d.id, tipo: d.tipo, numero: d.numero, chave: d.chave, situacao: d.situacao, temPdf: !!d.pdfId }))} />
}

/** Resumo do mês do motorista (carrega sob demanda). */
async function SecaoMes({ motoristaId, retorno }: { motoristaId: number; retorno: number }) {
  const mes = mesAtual()
  const doMes = agregar(await viagensDoMes(mes, { motoristaId }), retorno)
  return (
    <section className="panel">
      <header><h2>{nomeMes(mes)}</h2><Link href="/m/extrato" className="btn sm">Ver extrato<ChevronRight className="ico" /></Link></header>
      <div className="kv">
        <div><span className="lbl">Viagens encerradas</span><b>{doMes.n}</b></div>
        <div><span className="lbl">Sua comissão</span><b className="y">{reais(doMes.comissao)}</b></div>
      </div>
      {doMes.km > 0 && <p className="small muted">{num(doMes.km)} km rodados{doMes.litros ? ` · média de ${num(doMes.km / doMes.litros, 2)} km/l` : ''}</p>}
    </section>
  )
}
