// Leitura dos XML de CT-e (modelo 57) e MDF-e (modelo 58) gerados pelo emissor, e dos eventos de
// encerramento/cancelamento. Funções puras, sem banco: recebem o texto do XML e devolvem os dados.
import { XMLParser } from 'fast-xml-parser'

export type DocLido = {
  tipo: 'cte' | 'mdfe'
  chave: string
  numero: number
  serie: number
  emitidoEm: Date
  situacao: 'autorizado' | 'cancelado' | 'sem_protocolo'
  protocolo: string | null
  emitente: string | null
  remetente: string | null
  destinatario: string | null
  origem: string | null // "Cidade/UF", como veio no XML (maiúsculas, sem acento quase sempre)
  destino: string | null
  produto: string | null
  pesoKg: number | null
  valor: number | null // centavos
  placa: string | null
  chavesCte: string[]
}
export type EventoLido = { tipo: 'evento'; doc: 'cte' | 'mdfe'; chave: string; evento: 'encerramento' | 'cancelamento'; em: Date; aceito: boolean }
export type Leitura = ({ tipo: 'cte' | 'mdfe' } & DocLido) | EventoLido | { tipo: 'erro'; erro: string }

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  parseTagValue: false, // mantém zeros à esquerda (chaves, CNPJ, placas)
  trimValues: true,
  isArray: (nome) => ['infQ', 'infMunCarrega', 'infMunDescarga', 'infCTe', 'veicReboque', 'condutor'].includes(nome),
})

type No = Record<string, unknown>
const no = (x: unknown): No => (x && typeof x === 'object' ? (x as No) : {})
const txt = (x: unknown): string | null => {
  if (x == null) return null
  if (typeof x === 'object') return txt((x as No)['#text'])
  const s = String(x).trim()
  return s || null
}
const lista = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : x == null ? [] : [x as T])
const centavos = (x: unknown) => { const v = Number(txt(x)); return Number.isFinite(v) ? Math.round(v * 100) : null }

/** Confere o dígito verificador (módulo 11) de uma chave de acesso de 44 dígitos. */
export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false
  let soma = 0, peso = 2
  for (let i = 42; i >= 0; i--) { soma += Number(chave[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
  const resto = soma % 11
  const dv = resto < 2 ? 0 : 11 - resto
  return dv === Number(chave[43])
}
export const formatarChave = (c: string) => c.replace(/(\d{4})(?=\d)/g, '$1 ')
export const modeloDaChave = (c: string) => c.slice(20, 22) // 57 = CT-e, 58 = MDF-e

function cidade(mun: unknown, uf: unknown): string | null {
  const m = txt(mun), u = txt(uf)
  return m ? (u ? `${m}/${u}` : m) : null
}

function peso(unidade: unknown, qtd: unknown): number | null {
  const q = Number(txt(qtd))
  if (!Number.isFinite(q) || q <= 0) return null
  const u = txt(unidade)
  return u === '02' ? q * 1000 : u === '01' ? q : null // 01 = kg, 02 = tonelada
}

function situacaoProt(prot: No): { situacao: DocLido['situacao']; protocolo: string | null } {
  const inf = no(prot.infProt)
  const cStat = txt(inf.cStat)
  if (!cStat) return { situacao: 'sem_protocolo', protocolo: null }
  if (cStat === '100' || cStat === '150') return { situacao: 'autorizado', protocolo: txt(inf.nProt) }
  if (cStat === '101' || cStat === '151') return { situacao: 'cancelado', protocolo: txt(inf.nProt) }
  return { situacao: 'sem_protocolo', protocolo: null }
}

function lerCte(raiz: No, prot: No): Leitura {
  const inf = no(no(raiz.CTe).infCte ?? raiz.infCte)
  const chave = (txt(inf['@Id']) ?? '').replace(/^CTe/, '') || txt(no(prot.infProt).chCTe) || ''
  const ide = no(inf.ide)
  if (!chaveValida(chave)) return { tipo: 'erro', erro: 'Chave do CT-e inválida no XML.' }
  const norm = no(inf.infCTeNorm), carga = no(norm.infCarga)
  const qs = lista<No>(carga.infQ)
  const q = qs.find((x) => /PESO/i.test(txt(x.tpMed) ?? '') && peso(x.cUnid, x.qCarga)) ?? qs.find((x) => peso(x.cUnid, x.qCarga))
  return {
    tipo: 'cte', chave,
    numero: Number(txt(ide.nCT)), serie: Number(txt(ide.serie) ?? 0), emitidoEm: new Date(txt(ide.dhEmi) ?? ''),
    ...situacaoProt(prot),
    emitente: txt(no(inf.emit).xNome), remetente: txt(no(inf.rem).xNome), destinatario: txt(no(inf.dest).xNome),
    origem: cidade(ide.xMunIni, ide.UFIni), destino: cidade(ide.xMunFim, ide.UFFim),
    produto: txt(carga.proPred), pesoKg: q ? peso(q.cUnid, q.qCarga) : null,
    valor: centavos(no(inf.vPrest).vTPrest), placa: null, chavesCte: [],
  }
}

function lerMdfe(raiz: No, prot: No): Leitura {
  const inf = no(no(raiz.MDFe).infMDFe ?? raiz.infMDFe)
  const chave = (txt(inf['@Id']) ?? '').replace(/^MDFe/, '') || txt(no(prot.infProt).chMDFe) || ''
  if (!chaveValida(chave)) return { tipo: 'erro', erro: 'Chave do MDF-e inválida no XML.' }
  const ide = no(inf.ide)
  const rodo = no(no(inf.infModal).rodo)
  const descargas = lista<No>(no(inf.infDoc).infMunDescarga)
  const carrega = lista<No>(ide.infMunCarrega)[0]
  const tot = no(inf.tot)
  return {
    tipo: 'mdfe', chave,
    numero: Number(txt(ide.nMDF)), serie: Number(txt(ide.serie) ?? 0), emitidoEm: new Date(txt(ide.dhEmi) ?? ''),
    ...situacaoProt(prot),
    emitente: txt(no(inf.emit).xNome), remetente: null, destinatario: null,
    origem: cidade(carrega?.xMunCarrega, ide.UFIni), destino: cidade(descargas[descargas.length - 1]?.xMunDescarga, ide.UFFim),
    produto: txt(no(inf.prodPred).xProd), pesoKg: peso(tot.cUnid, tot.qCarga), valor: centavos(tot.vCarga),
    placa: (txt(no(rodo.veicTracao).placa) ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null,
    chavesCte: descargas.flatMap((d) => lista<No>(d.infCTe).map((c) => txt(c.chCTe)).filter((x): x is string => !!x)),
  }
}

function lerEvento(raiz: No, doc: 'cte' | 'mdfe'): Leitura {
  const ev = no(no(raiz[doc === 'cte' ? 'eventoCTe' : 'eventoMDFe']).infEvento)
  const ret = no(no(raiz[doc === 'cte' ? 'retEventoCTe' : 'retEventoMDFe']).infEvento)
  const chave = txt(ev[doc === 'cte' ? 'chCTe' : 'chMDFe']) ?? ''
  const tp = txt(ev.tpEvento)
  const evento = tp === '110112' ? 'encerramento' : tp === '110111' ? 'cancelamento' : null
  if (!evento) return { tipo: 'erro', erro: `Evento ${tp ?? 'desconhecido'} não é encerramento nem cancelamento; nada a fazer.` }
  if (!chaveValida(chave)) return { tipo: 'erro', erro: 'Chave inválida no evento.' }
  const cStat = txt(ret.cStat)
  return { tipo: 'evento', doc, chave, evento, em: new Date(txt(ev.dhEvento) ?? Date.now()), aceito: !cStat || cStat === '135' || cStat === '136' }
}

/** Lê o XML de um CT-e, MDF-e ou evento. Aceita o arquivo "proc" (com protocolo) ou só o documento. */
export function lerXmlFiscal(xml: string): Leitura {
  let r: No
  try { r = parser.parse(xml) } catch { return { tipo: 'erro', erro: 'Arquivo não é um XML válido.' } }
  if (r.cteProc) return lerCte(no(r.cteProc), no(no(r.cteProc).protCTe))
  if (r.CTe) return lerCte(r, {})
  if (r.mdfeProc) return lerMdfe(no(r.mdfeProc), no(no(r.mdfeProc).protMDFe))
  if (r.MDFe) return lerMdfe(r, {})
  if (r.procEventoMDFe) return lerEvento(no(r.procEventoMDFe), 'mdfe')
  if (r.procEventoCTe) return lerEvento(no(r.procEventoCTe), 'cte')
  if (r.eventoMDFe) return lerEvento(r, 'mdfe')
  if (r.eventoCTe) return lerEvento(r, 'cte')
  if (r.nfeProc || r.NFe) return { tipo: 'erro', erro: 'Este XML é de NF-e (nota fiscal de produto), não de CT-e ou MDF-e.' }
  return { tipo: 'erro', erro: 'XML não reconhecido como CT-e, MDF-e ou evento.' }
}

/** "RONDONOPOLIS/MT" -> "Rondonopolis/MT"; se já existir a cidade escrita com acento no sistema, usa ela. */
export function nomeCidade(xmlCidade: string | null, conhecidas: string[] = []): string {
  if (!xmlCidade) return ''
  const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const achada = conhecidas.find((c) => sem(c) === sem(xmlCidade))
  if (achada) return achada
  const [m, uf] = xmlCidade.split('/')
  const t = m.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (x) => x.toLowerCase())
  return uf ? `${t}/${uf.toUpperCase()}` : t
}

/** Texto da carga para a viagem: "Soja 37 t". */
export function textoCarga(produto: string | null, pesoKg: number | null): string {
  const p = produto ? produto.charAt(0).toUpperCase() + produto.slice(1).toLowerCase() : 'Carga'
  if (!pesoKg) return p
  const t = pesoKg / 1000
  return `${p} ${t.toLocaleString('pt-BR', { maximumFractionDigits: t < 10 ? 1 : 0 })} t`
}
