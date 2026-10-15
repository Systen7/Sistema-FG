import { describe, it, expect } from 'vitest'
import { chaveValida, formatarChave, lerXmlFiscal, nomeCidade, textoCarga } from '@/lib/fiscal'
import { chave, CTE, MDFE, ENCERRAMENTO } from './xml-exemplos'

describe('chave de acesso', () => {
  it('confere o dígito verificador', () => {
    const c = chave('57', 1234)
    expect(chaveValida(c)).toBe(true)
    expect(chaveValida(c.slice(0, 43) + ((Number(c[43]) + 1) % 10))).toBe(false)
    expect(chaveValida('123')).toBe(false)
    expect(formatarChave('12345678')).toBe('1234 5678')
  })
})

describe('leitura do XML', () => {
  it('lê CT-e autorizado com rota, carga em kg, valor e protocolo', () => {
    const c = chave('57', 1234)
    const r = lerXmlFiscal(CTE(c))
    expect(r.tipo).toBe('cte')
    if (r.tipo !== 'cte') return
    expect(r).toMatchObject({
      chave: c,
      numero: 1234,
      serie: 1,
      situacao: 'autorizado',
      protocolo: '151260000012345',
      origem: 'RONDONOPOLIS/MT',
      destino: 'SANTOS/SP',
      remetente: 'AGRO SOJA SA',
      destinatario: 'TERMINAL PORTUARIO SANTOS',
      produto: 'SOJA EM GRAOS',
      pesoKg: 37000,
      valor: 1_380_000,
    })
    expect(r.emitidoEm.toISOString()).toBe('2026-10-10T12:15:00.000Z')
  })
  it('lê MDF-e com placa sem traço, peso em toneladas e CT-e vinculados', () => {
    const c = chave('58', 77),
      cte = chave('57', 1234)
    const r = lerXmlFiscal(MDFE(c, cte))
    expect(r.tipo).toBe('mdfe')
    if (r.tipo !== 'mdfe') return
    expect(r).toMatchObject({
      numero: 77,
      placa: 'RKT4E21',
      pesoKg: 37000,
      valor: 9_800_000,
      chavesCte: [cte],
      origem: 'RONDONOPOLIS/MT',
      destino: 'SANTOS/SP',
      situacao: 'autorizado',
    })
  })
  it('reconhece o evento de encerramento do MDF-e', () => {
    const c = chave('58', 77)
    expect(lerXmlFiscal(ENCERRAMENTO(c))).toMatchObject({ tipo: 'evento', doc: 'mdfe', chave: c, evento: 'encerramento', aceito: true })
  })
  it('dá mensagem clara para NF-e, XML quebrado e chave errada', () => {
    expect(lerXmlFiscal('<nfeProc><NFe/></nfeProc>')).toMatchObject({ tipo: 'erro', erro: expect.stringContaining('NF-e') })
    expect(lerXmlFiscal('isto não é xml')).toMatchObject({ tipo: 'erro' })
    expect(lerXmlFiscal(CTE('1'.repeat(44)))).toMatchObject({ tipo: 'erro', erro: expect.stringContaining('inválida') })
  })
})

describe('texto para a viagem', () => {
  it('usa a grafia com acento já cadastrada, ou capitaliza', () => {
    expect(nomeCidade('RONDONOPOLIS/MT', ['Rondonópolis/MT'])).toBe('Rondonópolis/MT')
    expect(nomeCidade('SAO JOSE DO RIO PRETO/SP')).toBe('Sao Jose do Rio Preto/SP')
    expect(textoCarga('SOJA EM GRAOS', 37000)).toBe('Soja em graos 37 t')
    expect(textoCarga(null, 8500)).toBe('Carga 8,5 t')
  })
})
