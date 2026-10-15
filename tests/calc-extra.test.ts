import { describe, it, expect } from 'vitest'
import type { Despesa } from '@/db/schema'
import { agregar, calcViagem, fracaoMes, resultadoGeral, type ViagemCompleta } from '@/lib/calc'

const v = (o: Partial<ViagemCompleta> = {}): ViagemCompleta => ({
  id: 1,
  motoristaId: 1,
  caminhaoId: 1,
  origem: 'A',
  destino: 'B',
  carga: 'Soja',
  frete: 1_000_000,
  comissaoPct: 10,
  adiantamento: 0,
  inicio: '2026-09-01',
  fim: null,
  kmInicial: 1000,
  kmFinal: 2000,
  kmVazio: 0,
  status: 'encerrada',
  criadoEm: new Date(),
  despesas: [],
  ...o,
})
const d = (o: Partial<Despesa>): Despesa => ({
  id: 1,
  viagemId: 1,
  tipo: 'Diesel',
  valor: 0,
  litros: null,
  kmAbastecimento: null,
  obs: null,
  data: '2026-09-01',
  pagoPor: 'empresa',
  status: 'aprovada',
  motivoRecusa: null,
  fotoId: null,
  clientId: null,
  criadoEm: new Date(),
  ...o,
})

describe('calcViagem: casos de borda', () => {
  it('viagem sem km final: km, consumo e "deixou de ganhar" ficam vazios/zero', () => {
    const c = calcViagem(v({ kmFinal: null, kmVazio: 100, despesas: [d({ valor: 10_000, litros: 50 })] }), 60)
    expect(c).toMatchObject({ km: null, kmCarregado: null, perdido: 0, consumo: null })
  })
  it('sem litros não calcula consumo', () => {
    expect(calcViagem(v({ despesas: [d({ tipo: 'Pedágio', valor: 1 })] }), 60).consumo).toBeNull()
  })
  it('km zero não calcula consumo nem perdido', () => {
    const c = calcViagem(v({ kmFinal: 1000, kmVazio: 10, despesas: [d({ litros: 10 })] }), 60)
    expect(c).toMatchObject({ km: 0, kmCarregado: -10, perdido: 0, consumo: null })
  })
  it('tudo vazio (km vazio = km total) não divide por zero', () => {
    expect(calcViagem(v({ kmVazio: 1000 }), 60)).toMatchObject({ kmCarregado: 0, perdido: 0 })
    expect(calcViagem(v({ kmVazio: 1500 }), 60)).toMatchObject({ kmCarregado: -500, perdido: 0 })
  })
  it('separa diesel, pedágio e outros; litros de despesa recusada não contam', () => {
    const c = calcViagem(
      v({
        despesas: [
          d({ valor: 100, litros: 10 }),
          d({ tipo: 'Pedágio', valor: 20 }),
          d({ tipo: 'Estadia', valor: 5, status: 'pendente' }),
          d({ valor: 999, litros: 99, status: 'recusada' }),
        ],
      }),
      60,
    )
    expect(c).toMatchObject({ total: 125, diesel: 100, pedagio: 20, outros: 5, litros: 10, pendentes: 1, consumo: 100 })
  })
  it('reembolso não inclui gasto do bolso recusado nem pago pela empresa', () => {
    const c = calcViagem(v({ despesas: [d({ valor: 7, pagoPor: 'motorista', status: 'recusada' }), d({ valor: 3 })] }), 60)
    expect(c.reembolso).toBe(0)
  })
  it('comissão arredondada ao centavo', () => {
    expect(calcViagem(v({ frete: 333, comissaoPct: 10 }), 60).comissao).toBe(33)
    expect(calcViagem(v({ frete: 335, comissaoPct: 10 }), 60).comissao).toBe(34)
  })
})

describe('agregar e resultado geral', () => {
  it('viagem encerrada sem km final soma 0 km; lista vazia zera tudo', () => {
    const a = agregar([v({ kmFinal: null, adiantamento: 500 })], 60)
    expect(a).toMatchObject({ n: 1, km: 0, adiantamento: 500 })
    expect(agregar([], 60)).toMatchObject({ n: 0, frete: 0, lucroViagens: 0 })
  })
  it('fracaoMes no último e no primeiro dia do mês', () => {
    expect(fracaoMes('2026-10', '2026-10-31')).toBe(1)
    expect(fracaoMes('2026-02', '2026-02-14')).toBe(0.5)
    expect(fracaoMes('2025-12', '2026-01-01')).toBe(1)
  })
  it('mês futuro: só manutenção entra; manutenção de outro mês é ignorada', () => {
    const g = resultadoGeral(
      '2026-11',
      '2026-10-15',
      [],
      [
        { id: 1, caminhaoId: 1, data: '2026-11-02', tipo: 'Preventiva', descricao: '', valor: 1_000, imprevisto: false },
        { id: 2, caminhaoId: 1, data: '2026-10-02', tipo: 'Preventiva', descricao: '', valor: 9_000, imprevisto: false },
      ],
      [{ id: 1, nome: 'Casco', cobertura: '', vigenciaAte: null, custoMensal: 30_000, obrigatorio: false }],
      [{ id: 1, nome: 'Contador', valorMensal: 20_000 }],
      60,
    )
    expect(g).toMatchObject({ manutencao: 1_000, seguros: 0, fixos: 0, custo: 1_000, lucro: -1_000 })
  })
  it('mês corrente: seguros e fixos proporcionais e arredondados', () => {
    const g = resultadoGeral(
      '2026-10',
      '2026-10-15',
      [],
      [],
      [{ id: 1, nome: 'X', cobertura: '', vigenciaAte: null, custoMensal: 31_001, obrigatorio: false }],
      [],
      60,
    )
    expect(g.seguros).toBe(Math.round((31_001 * 15) / 31))
  })
})
