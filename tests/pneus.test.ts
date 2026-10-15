import { describe, it, expect } from 'vitest'
import { EIXOS, SULCO_NOVO, CUSTO_PNEU_NOVO, gerarPneus } from '@/lib/pneus'

describe('conjunto padrão de pneus', () => {
  it('soma 22 pneus no cavalo 6x4 + carreta de 3 eixos', () => {
    expect(EIXOS.reduce((s, [, porLado]) => s + porLado * 2, 0)).toBe(22)
  })
})

describe('gerarPneus', () => {
  it('novos: 22 pneus com sulco cheio, sem recapagem, km zero e custo de pneu novo', () => {
    const ps = gerarPneus(3, true)
    expect(ps).toHaveLength(22)
    expect(ps.map((p) => p.posicao)).toEqual([...Array(22).keys()])
    for (const p of ps) {
      expect(p).toMatchObject({ caminhaoId: 3, sulco: SULCO_NOVO, recapagens: 0, km: 0, custo: CUSTO_PNEU_NOVO })
    }
  })
  it('posições: direcional simples, demais eixos duplos com externo antes do interno', () => {
    const ps = gerarPneus(1, true)
    expect(ps.slice(0, 2).map((p) => [p.eixo, p.lado, p.local])).toEqual([
      ['Direcional', 'Esquerdo', ''],
      ['Direcional', 'Direito', ''],
    ])
    expect(ps.slice(2, 6).map((p) => [p.eixo, p.lado, p.local])).toEqual([
      ['Tração 1', 'Esquerdo', 'externo'],
      ['Tração 1', 'Esquerdo', 'interno'],
      ['Tração 1', 'Direito', 'externo'],
      ['Tração 1', 'Direito', 'interno'],
    ])
    expect(ps[21]).toMatchObject({ eixo: 'Carreta 3', lado: 'Direito', local: 'interno' })
    expect(new Set(ps.map((p) => `${p.eixo}|${p.lado}|${p.local}`)).size).toBe(22)
  })
  it('usados: sulco entre 2 e 14, direcional nunca recapado, km e custo coerentes', () => {
    for (const id of [1, 2, 7, 13]) {
      const ps = gerarPneus(id, false)
      for (const p of ps) {
        expect(p.sulco).toBeGreaterThanOrEqual(2)
        expect(p.sulco).toBeLessThanOrEqual(14)
        expect(p.sulco).toBe(2 + ((id * 7 + p.posicao * 5) % 13))
        if (p.eixo === 'Direcional') expect(p.recapagens).toBe(0)
        else expect(p.recapagens).toBe((id + p.posicao) % 3)
        expect(p.km).toBe((SULCO_NOVO - p.sulco) * 9500 + p.recapagens * 60000)
        expect(p.custo).toBe(CUSTO_PNEU_NOVO + p.recapagens * 78000)
      }
    }
  })
  it('usados: valores conhecidos do caminhão 1', () => {
    const ps = gerarPneus(1, false)
    expect(ps[0]).toMatchObject({ sulco: 9, recapagens: 0, km: 66500, custo: 290000 })
    expect(ps[2]).toMatchObject({ sulco: 6, recapagens: 0, km: 95000 })
    expect(ps[3]).toMatchObject({ sulco: 11, recapagens: 1, km: 47500 + 60000, custo: 368000 })
  })
  it('é determinístico', () => {
    expect(gerarPneus(5, false)).toEqual(gerarPneus(5, false))
  })
})
