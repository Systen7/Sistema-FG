import { afterEach, describe, it, expect, vi } from 'vitest'
import { hoje, mesAtual, dias, somaDias, somaMeses, diasNoMes, nomeMes, mesValido, dataDe } from '@/lib/datas'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('hoje e mês atual no fuso de São Paulo', () => {
  it('23:30 em São Paulo ainda é o mesmo dia, mesmo com UTC já no dia seguinte', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T02:30:00Z'))
    expect(hoje()).toBe('2026-10-15')
    expect(mesAtual()).toBe('2026-10')
  })
  it('vira o dia à meia-noite de São Paulo (03:00 UTC)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T03:00:00Z'))
    expect(hoje()).toBe('2026-10-16')
  })
  it('virada de mês e de ano', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T02:59:59Z'))
    expect(hoje()).toBe('2026-12-31')
    expect(mesAtual()).toBe('2026-12')
  })
  it('respeita TZ_EMPRESA quando definido', async () => {
    vi.stubEnv('TZ_EMPRESA', 'UTC')
    vi.resetModules()
    const m = await import('@/lib/datas')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T02:30:00Z'))
    expect(m.hoje()).toBe('2026-10-16')
  })
})

describe('dataDe', () => {
  it('usa o fuso da empresa para um registro feito à noite', () => {
    expect(dataDe(new Date('2026-10-16T02:30:00Z'))).toBe('2026-10-15')
    expect(dataDe(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-16')
  })
})

describe('contas com datas', () => {
  it('dias entre datas, inclusive negativos e atravessando meses/anos', () => {
    expect(dias('2026-10-01', '2026-10-11')).toBe(10)
    expect(dias('2026-10-11', '2026-10-01')).toBe(-10)
    expect(dias('2026-10-01', '2026-10-01')).toBe(0)
    expect(dias('2026-12-31', '2027-01-01')).toBe(1)
    expect(dias('2028-02-28', '2028-03-01')).toBe(2)
  })
  it('somaDias atravessa mês, ano e fevereiro bissexto', () => {
    expect(somaDias('2026-10-15', 1)).toBe('2026-10-16')
    expect(somaDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somaDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somaDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(somaDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somaDias('2027-02-28', 1)).toBe('2027-03-01')
    expect(somaDias('2026-10-15', 0)).toBe('2026-10-15')
  })
  it('somaMeses atravessa o ano nos dois sentidos', () => {
    expect(somaMeses('2026-10', 1)).toBe('2026-11')
    expect(somaMeses('2026-12', 1)).toBe('2027-01')
    expect(somaMeses('2026-01', -1)).toBe('2025-12')
    expect(somaMeses('2026-10', -22)).toBe('2024-12')
    expect(somaMeses('2026-10', 0)).toBe('2026-10')
  })
  it('diasNoMes, incluindo fevereiro bissexto', () => {
    expect(diasNoMes('2026-01')).toBe(31)
    expect(diasNoMes('2026-04')).toBe(30)
    expect(diasNoMes('2026-02')).toBe(28)
    expect(diasNoMes('2028-02')).toBe(29)
    expect(diasNoMes('2100-02')).toBe(28)
    expect(diasNoMes('2000-02')).toBe(29)
    expect(diasNoMes('2026-12')).toBe(31)
  })
})

describe('nomes de mês', () => {
  it('longo e curto', () => {
    expect(nomeMes('2026-10')).toBe('Outubro de 2026')
    expect(nomeMes('2026-03')).toBe('Março de 2026')
    expect(nomeMes('2026-10', true)).toBe('out/26')
    expect(nomeMes('2027-01', true)).toBe('jan/27')
    expect(nomeMes('2026-12', true)).toBe('dez/26')
  })
  it('mesValido aceita só AAAA-MM com mês de 01 a 12', () => {
    expect(mesValido('2026-10')).toBe(true)
    expect(mesValido('2026-01')).toBe(true)
    expect(mesValido('2026-12')).toBe(true)
    expect(mesValido('2026-00')).toBe(false)
    expect(mesValido('2026-13')).toBe(false)
    expect(mesValido('2026-1')).toBe(false)
    expect(mesValido('2026-10-01')).toBe(false)
    expect(mesValido(' 2026-10')).toBe(false)
    expect(mesValido(202610)).toBe(false)
    expect(mesValido(null)).toBe(false)
    expect(mesValido(undefined)).toBe(false)
  })
})
