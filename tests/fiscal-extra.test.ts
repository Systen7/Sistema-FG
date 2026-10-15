import { describe, it, expect } from 'vitest'
import { chaveValida, lerXmlFiscal, nomeCidade, textoCarga } from '@/lib/fiscal'
import { chave, CTE, MDFE } from './xml-exemplos'

const cteSimples = (ch: string, corpo: string, prot = '') =>
  `<cteProc><CTe><infCte Id="CTe${ch}"><ide><nCT>5</nCT><dhEmi>2026-10-10T08:00:00-03:00</dhEmi></ide>${corpo}</infCte></CTe>${prot}</cteProc>`
const protCte = (cStat: string, ch = '') => `<protCTe><infProt>${ch && `<chCTe>${ch}</chCTe>`}<nProt>1</nProt><cStat>${cStat}</cStat></infProt></protCTe>`
const evento = (doc: 'CTe' | 'MDFe', ch: string, tp: string, ret = '', dh = '<dhEvento>2026-10-13T17:30:00-03:00</dhEvento>') =>
  `<procEvento${doc}><evento${doc}><infEvento><ch${doc}>${ch}</ch${doc}>${dh}<tpEvento>${tp}</tpEvento></infEvento></evento${doc}>${ret}</procEvento${doc}>`
const ret = (doc: 'CTe' | 'MDFe', cStat: string) => `<retEvento${doc}><infEvento><cStat>${cStat}</cStat></infEvento></retEvento${doc}>`

describe('chave de acesso: dígito verificador 0 quando resto < 2', () => {
  it('aceita chaves de vários números e recusa não dígitos', () => {
    for (let n = 1; n <= 30; n++) expect(chaveValida(chave('57', n))).toBe(true)
    expect(chaveValida('a'.repeat(44))).toBe(false)
    expect(chaveValida(`${chave('57', 1)}0`)).toBe(false)
  })
})

describe('situação do protocolo', () => {
  const c = chave('57', 5)
  it('cancelado (101/151) e autorizado (150)', () => {
    expect(lerXmlFiscal(cteSimples(c, '', protCte('101')))).toMatchObject({ situacao: 'cancelado', protocolo: '1' })
    expect(lerXmlFiscal(cteSimples(c, '', protCte('151')))).toMatchObject({ situacao: 'cancelado' })
    expect(lerXmlFiscal(cteSimples(c, '', protCte('150')))).toMatchObject({ situacao: 'autorizado' })
  })
  it('rejeição ou sem protocolo → sem_protocolo', () => {
    expect(lerXmlFiscal(cteSimples(c, '', protCte('204')))).toMatchObject({ situacao: 'sem_protocolo', protocolo: null })
    expect(lerXmlFiscal(cteSimples(c, ''))).toMatchObject({ situacao: 'sem_protocolo', protocolo: null })
  })
})

describe('CT-e', () => {
  it('só o documento (sem cteProc), sem dados opcionais', () => {
    const c = chave('57', 5)
    const r = lerXmlFiscal(`<CTe><infCte Id="CTe${c}"><ide><nCT>5</nCT></ide></infCte></CTe>`)
    expect(r).toMatchObject({
      tipo: 'cte',
      chave: c,
      numero: 5,
      serie: 0,
      situacao: 'sem_protocolo',
      emitente: null,
      origem: null,
      destino: null,
      produto: null,
      pesoKg: null,
      placa: null,
      chavesCte: [],
    })
    if (r.tipo === 'cte') expect(Number.isNaN(r.emitidoEm.getTime())).toBe(true)
  })
  it('pega a chave do protocolo quando o infCte não tem Id', () => {
    const c = chave('57', 6)
    expect(lerXmlFiscal(`<cteProc><CTe><infCte><ide/></infCte></CTe>${protCte('100', c)}</cteProc>`)).toMatchObject({ tipo: 'cte', chave: c })
  })
  it('cidade sem UF fica só com o nome', () => {
    const c = chave('57', 5)
    expect(lerXmlFiscal(cteSimples(c, '').replace('<nCT>', '<xMunIni>CUIABA</xMunIni><nCT>'))).toMatchObject({ origem: 'CUIABA' })
  })
  it('peso: toneladas, sem medida "PESO" usa a primeira válida, unidade desconhecida ou zero é ignorada', () => {
    const c = chave('57', 5)
    const carga = (qs: string) => cteSimples(c, `<infCTeNorm><infCarga>${qs}</infCarga></infCTeNorm>`)
    const q = (u: string, tp: string, v: string) => `<infQ><cUnid>${u}</cUnid><tpMed>${tp}</tpMed><qCarga>${v}</qCarga></infQ>`
    expect(lerXmlFiscal(carga(q('02', 'PESO BRUTO', '37.5')))).toMatchObject({ pesoKg: 37500 })
    expect(lerXmlFiscal(carga(q('03', 'UNIDADE', '1') + q('01', 'KG', '800')))).toMatchObject({ pesoKg: 800 })
    expect(lerXmlFiscal(carga(q('01', 'PESO BRUTO', '0') + q('01', 'PESO BASE', '900')))).toMatchObject({ pesoKg: 900 })
    expect(lerXmlFiscal(carga(q('03', 'PESO', '10')))).toMatchObject({ pesoKg: null })
    expect(lerXmlFiscal(carga(q('01', 'PESO', 'abc')))).toMatchObject({ pesoKg: null })
  })
  it('lê valor de tag com atributo (#text)', () => {
    const c = chave('57', 5)
    expect(lerXmlFiscal(cteSimples(c, '<vPrest><vTPrest moeda="BRL">10.50</vTPrest></vPrest>'))).toMatchObject({ valor: 1050 })
    expect(lerXmlFiscal(cteSimples(c, '<vPrest><vTPrest>abc</vTPrest></vPrest>'))).toMatchObject({ valor: null })
  })
  it('CT-e do exemplo cancelado continua lendo os dados', () => {
    const c = chave('57', 1234)
    expect(lerXmlFiscal(CTE(c).replace('<cStat>100</cStat>', '<cStat>101</cStat>'))).toMatchObject({ situacao: 'cancelado', numero: 1234 })
  })
})

describe('MDF-e', () => {
  it('só o documento (sem mdfeProc), sem placa nem descargas', () => {
    const c = chave('58', 9)
    expect(lerXmlFiscal(`<MDFe><infMDFe Id="MDFe${c}"><ide><nMDF>9</nMDF><serie>2</serie></ide></infMDFe></MDFe>`)).toMatchObject({
      tipo: 'mdfe',
      chave: c,
      numero: 9,
      serie: 2,
      situacao: 'sem_protocolo',
      placa: null,
      origem: null,
      destino: null,
      pesoKg: null,
      chavesCte: [],
    })
  })
  it('chave do protocolo, chave inválida e várias descargas (destino = última)', () => {
    const c = chave('58', 9)
    const cte1 = chave('57', 1),
      cte2 = chave('57', 2)
    const xml = MDFE(c, cte1).replace(
      '</infDoc>',
      `<infMunDescarga><xMunDescarga>GUARUJA</xMunDescarga><infCTe><chCTe>${cte2}</chCTe></infCTe><infCTe><chCTe></chCTe></infCTe></infMunDescarga></infDoc>`,
    )
    expect(lerXmlFiscal(xml)).toMatchObject({ destino: 'GUARUJA/SP', chavesCte: [cte1, cte2] })
    expect(lerXmlFiscal(MDFE(c, cte1).replace(`Id="MDFe${c}"`, ''))).toMatchObject({ tipo: 'mdfe', chave: c })
    expect(lerXmlFiscal(MDFE('9'.repeat(44), cte1))).toEqual({ tipo: 'erro', erro: 'Chave do MDF-e inválida no XML.' })
  })
  it('placa em minúsculas com espaço é normalizada', () => {
    expect(lerXmlFiscal(MDFE(chave('58', 9), chave('57', 1), '2026-10-10', 'rkt 4e21'))).toMatchObject({ placa: 'RKT4E21' })
  })
})

describe('eventos', () => {
  const m = chave('58', 9),
    c = chave('57', 5)
  it('cancelamento de CT-e (procEventoCTe), aceito com 135/136, recusado com outro código', () => {
    expect(lerXmlFiscal(evento('CTe', c, '110111', ret('CTe', '135')))).toMatchObject({
      tipo: 'evento',
      doc: 'cte',
      chave: c,
      evento: 'cancelamento',
      aceito: true,
    })
    expect(lerXmlFiscal(evento('CTe', c, '110111', ret('CTe', '136')))).toMatchObject({ aceito: true })
    expect(lerXmlFiscal(evento('CTe', c, '110111', ret('CTe', '573')))).toMatchObject({ aceito: false })
  })
  it('evento sem retorno conta como aceito; sem data usa agora', () => {
    const antes = Date.now()
    const r = lerXmlFiscal(evento('MDFe', m, '110112', '', ''))
    expect(r).toMatchObject({ tipo: 'evento', evento: 'encerramento', aceito: true })
    if (r.tipo === 'evento') expect(r.em.getTime()).toBeGreaterThanOrEqual(antes)
  })
  it('evento solto (sem proc) de MDF-e e de CT-e', () => {
    const solto = (doc: 'CTe' | 'MDFe', ch: string) =>
      `<evento${doc}><infEvento><ch${doc}>${ch}</ch${doc}><tpEvento>110112</tpEvento></infEvento></evento${doc}>`
    expect(lerXmlFiscal(solto('MDFe', m))).toMatchObject({ tipo: 'evento', doc: 'mdfe', chave: m })
    expect(lerXmlFiscal(solto('CTe', c))).toMatchObject({ tipo: 'evento', doc: 'cte', chave: c })
  })
  it('outros eventos e chave inválida dão erro', () => {
    expect(lerXmlFiscal(evento('MDFe', m, '110114'))).toEqual({ tipo: 'erro', erro: 'Evento 110114 não é encerramento nem cancelamento; nada a fazer.' })
    expect(lerXmlFiscal('<procEventoMDFe><eventoMDFe><infEvento/></eventoMDFe></procEventoMDFe>')).toMatchObject({
      erro: expect.stringContaining('desconhecido'),
    })
    expect(lerXmlFiscal(evento('MDFe', '1'.repeat(44), '110112'))).toEqual({ tipo: 'erro', erro: 'Chave inválida no evento.' })
  })
})

describe('XML não reconhecido', () => {
  it('NF-e solta e raiz desconhecida', () => {
    expect(lerXmlFiscal('<NFe><infNFe/></NFe>')).toMatchObject({ erro: expect.stringContaining('NF-e') })
    expect(lerXmlFiscal('<nota><x/></nota>')).toEqual({ tipo: 'erro', erro: 'XML não reconhecido como CT-e, MDF-e ou evento.' })
    expect(lerXmlFiscal('')).toMatchObject({ tipo: 'erro' })
  })
  it('XML truncado não lança erro', () => {
    expect(lerXmlFiscal('<CTe')).toEqual({ tipo: 'erro', erro: 'Arquivo não é um XML válido.' })
    expect(lerXmlFiscal('<CTe><!-- </CTe>')).toEqual({ tipo: 'erro', erro: 'Arquivo não é um XML válido.' })
  })
})

describe('nomeCidade e textoCarga', () => {
  it('nomeCidade: vazio, sem UF, hífen, preposições e UF minúscula', () => {
    expect(nomeCidade(null)).toBe('')
    expect(nomeCidade('')).toBe('')
    expect(nomeCidade('CUIABA')).toBe('Cuiaba')
    expect(nomeCidade('ESTRELA D OESTE/sp')).toBe('Estrela D Oeste/SP')
    expect(nomeCidade('EMBU-GUACU/SP')).toBe('Embu-Guacu/SP')
    expect(nomeCidade('SANTA RITA DAS FLORES E DOS CAMPOS/MG')).toBe('Santa Rita das Flores e dos Campos/MG')
    expect(nomeCidade('sao paulo/sp', ['São Paulo/SP', 'Santos/SP'])).toBe('São Paulo/SP')
    expect(nomeCidade('SANTOS/SP', ['São Paulo/SP'])).toBe('Santos/SP')
  })
  it('textoCarga: sem peso, menos e mais de 10 t', () => {
    expect(textoCarga('milho', null)).toBe('Milho')
    expect(textoCarga('milho', 0)).toBe('Milho')
    expect(textoCarga(null, null)).toBe('Carga')
    expect(textoCarga('', 9_940)).toBe('Carga 9,9 t')
    expect(textoCarga('MILHO', 37_600)).toBe('Milho 38 t')
    expect(textoCarga('MILHO', 1_234_000)).toBe('Milho 1.234 t')
  })
})
