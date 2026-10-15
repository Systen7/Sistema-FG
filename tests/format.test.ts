import { describe, it, expect } from 'vitest'
import { num, reais, reaisC, dataCurta, dataLonga, lerNumero, lerReais, soDigitos, telefone, primeiroNome, TIPOS_DESPESA, nomeTipo } from '@/lib/format'

describe('num', () => {
  it('formata com separadores brasileiros e casas decimais', () => {
    expect(num(1234567)).toBe('1.234.567')
    expect(num(1234.5, 2)).toBe('1.234,50')
    expect(num(2.456, 1)).toBe('2,5')
    expect(num(0.5)).toBe('1')
    expect(num(-1500)).toBe('-1.500')
  })
  it('trata nulo, indefinido e NaN como zero', () => {
    expect(num(null)).toBe('0')
    expect(num(undefined, 2)).toBe('0,00')
    expect(num(Number.NaN)).toBe('0')
  })
})

describe('reais', () => {
  it('arredonda para reais inteiros', () => {
    expect(reais(0)).toBe('R$ 0')
    expect(reais(125040)).toBe('R$ 1.250')
    expect(reais(125050)).toBe('R$ 1.251')
    expect(reais(49)).toBe('R$ 0')
    expect(reais(-125040)).toBe('−R$ 1.250')
  })
  it('valor negativo que arredonda para zero não mostra sinal', () => {
    expect(reais(-40)).toBe('R$ 0')
  })
  it('reaisC mostra centavos', () => {
    expect(reaisC(125040)).toBe('R$ 1.250,40')
    expect(reaisC(5)).toBe('R$ 0,05')
    expect(reaisC(0)).toBe('R$ 0,00')
    expect(reaisC(-125040)).toBe('−R$ 1.250,40')
    expect(reaisC(100_000_000)).toBe('R$ 1.000.000,00')
  })
})

describe('datas para exibição', () => {
  it('curta e longa, com travessão quando vazio', () => {
    expect(dataCurta('2026-10-05')).toBe('05/10')
    expect(dataLonga('2026-10-05')).toBe('05/10/2026')
    for (const v of [null, undefined, '']) {
      expect(dataCurta(v)).toBe('—')
      expect(dataLonga(v)).toBe('—')
    }
  })
})

describe('lerNumero', () => {
  it('aceita números já prontos, recusando infinitos e NaN', () => {
    expect(lerNumero(12.5)).toBe(12.5)
    expect(lerNumero(0)).toBe(0)
    expect(lerNumero(Number.POSITIVE_INFINITY)).toBeNull()
    expect(lerNumero(Number.NaN)).toBeNull()
  })
  it('recusa o que não é texto nem número', () => {
    expect(lerNumero(null)).toBeNull()
    expect(lerNumero(undefined)).toBeNull()
    expect(lerNumero({})).toBeNull()
    expect(lerNumero(true)).toBeNull()
  })
  it('recusa texto vazio ou sem dígitos', () => {
    expect(lerNumero('')).toBeNull()
    expect(lerNumero('   ')).toBeNull()
    expect(lerNumero('R$')).toBeNull()
    expect(lerNumero('-')).toBeNull()
    expect(lerNumero('1,2,3')).toBeNull()
    expect(lerNumero('10-5')).toBeNull()
  })
  it('formato brasileiro com milhar e vírgula', () => {
    expect(lerNumero('1.250,40')).toBe(1250.4)
    expect(lerNumero('1.234.567,89')).toBe(1234567.89)
    expect(lerNumero('0,5')).toBe(0.5)
    expect(lerNumero(',5')).toBe(0.5)
    expect(lerNumero('-1.250,40')).toBe(-1250.4)
  })
  it('ponto: milhar quando em grupos de 3, senão decimal', () => {
    expect(lerNumero('1.234')).toBe(1234)
    expect(lerNumero('1.234.567')).toBe(1234567)
    expect(lerNumero('12.5')).toBe(12.5)
    expect(lerNumero('1.2345')).toBe(1.2345)
    expect(lerNumero('1234.56')).toBe(1234.56)
  })
  it('ignora símbolos e espaços', () => {
    expect(lerNumero('R$ 1.250,40')).toBe(1250.4)
    expect(lerNumero(' 37 t ')).toBe(37)
  })
})

describe('lerReais', () => {
  it('converte reais digitados em centavos inteiros', () => {
    expect(lerReais('1.250,40')).toBe(125040)
    expect(lerReais('0,01')).toBe(1)
    expect(lerReais('19,99')).toBe(1999)
    expect(lerReais(12.34)).toBe(1234)
    expect(lerReais('abc')).toBeNull()
    expect(lerReais(null)).toBeNull()
  })
  it('é exato para todos os centavos de 0,00 a 999,99', () => {
    for (let c = 0; c < 100_000; c++) expect(lerReais(`${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`)).toBe(c)
  })
})

describe('texto', () => {
  it('soDigitos', () => {
    expect(soDigitos('(65) 99999-1234')).toBe('65999991234')
    expect(soDigitos('abc')).toBe('')
    expect(soDigitos('')).toBe('')
  })
  it('telefone com 11 e 10 dígitos; outros ficam como vieram', () => {
    expect(telefone('65999991234')).toBe('(65) 99999-1234')
    expect(telefone('(65) 3421-1234')).toBe('(65) 3421-1234')
    expect(telefone('6534211234')).toBe('(65) 3421-1234')
    expect(telefone('+55 65 99999-1234')).toBe('+55 65 99999-1234')
    expect(telefone('123')).toBe('123')
    expect(telefone(null)).toBe('')
    expect(telefone(undefined)).toBe('')
  })
  it('primeiroNome ignora espaços extras', () => {
    expect(primeiroNome('  Valdir  da Silva ')).toBe('Valdir')
    expect(primeiroNome('Ana')).toBe('Ana')
    expect(primeiroNome('')).toBe('')
  })
  it('tipos de despesa: Diesel aparece como Combustível', () => {
    expect(TIPOS_DESPESA).toContain('Diesel')
    expect(TIPOS_DESPESA).toHaveLength(8)
    expect(nomeTipo('Diesel')).toBe('Combustível')
    expect(nomeTipo('Pedágio')).toBe('Pedágio')
  })
})
