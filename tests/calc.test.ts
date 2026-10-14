import { describe, it, expect } from 'vitest'
import { calcViagem, agregar, acerto, fracaoMes, resultadoGeral, type ViagemCompleta } from '@/lib/calc'
import { lerNumero, lerReais, reais, reaisC } from '@/lib/format'
import { calcAlertas } from '@/lib/alertas'

const v = (o: Partial<ViagemCompleta> = {}): ViagemCompleta => ({
  id: 1, motoristaId: 1, caminhaoId: 1, origem: 'A', destino: 'B', carga: 'Soja', frete: 1_000_000, comissaoPct: 10, adiantamento: 100_000,
  inicio: '2026-09-01', fim: '2026-09-03', kmInicial: 1000, kmFinal: 2000, kmVazio: 0, status: 'encerrada', criadoEm: new Date(), despesas: [], ...o,
})
const d = (o: Record<string, unknown>) => ({
  id: 1, viagemId: 1, tipo: 'Diesel', valor: 0, litros: null, kmAbastecimento: null, obs: null, data: '2026-09-01', pagoPor: 'empresa' as const,
  status: 'aprovada' as const, motivoRecusa: null, fotoId: null, clientId: null, criadoEm: new Date(), ...o,
})

describe('cálculo da viagem', () => {
  it('lucro = frete − despesas − comissão, ignorando recusadas', () => {
    const c = calcViagem(v({ despesas: [d({ valor: 300_000, litros: 400 }), d({ tipo: 'Pedágio', valor: 50_000 }), d({ tipo: 'Alimentação', valor: 20_000, status: 'recusada' })] }), 60)
    expect(c.total).toBe(350_000)
    expect(c.comissao).toBe(100_000)
    expect(c.lucro).toBe(1_000_000 - 350_000 - 100_000)
    expect(c.consumo).toBe(2.5)
  })
  it('usa a comissão gravada na viagem', () => {
    expect(calcViagem(v({ comissaoPct: 12 }), 60).comissao).toBe(120_000)
  })
  it('deixou de ganhar: km vazio × frete por km carregado × % retorno × % comissão', () => {
    // 1000 km, 200 vazios: R$ 10.000 / 800 km = R$ 12,50/km; 200 km × 12,50 × 60% × 10% = R$ 150
    expect(calcViagem(v({ kmVazio: 200 }), 60).perdido).toBe(15_000)
  })
  it('reembolso só de gasto do bolso aprovado', () => {
    const c = calcViagem(v({ despesas: [d({ valor: 9_000, pagoPor: 'motorista' }), d({ valor: 5_000, pagoPor: 'motorista', status: 'pendente' })] }), 60)
    expect(c.reembolso).toBe(9_000)
    expect(c.pendentes).toBe(1)
  })
})

describe('acerto e resultado do mês', () => {
  it('acerto = comissões + reembolsos − adiantamentos, só viagens encerradas', () => {
    const a = acerto([v({ despesas: [d({ valor: 9_000, pagoPor: 'motorista' })] }), v({ status: 'andamento', kmFinal: null })], 60)
    expect(a).toEqual({ viagens: 1, comissao: 100_000, reembolso: 9_000, adiantamento: 100_000, saldo: 9_000 })
  })
  it('custos fixos proporcionais no mês corrente', () => {
    expect(fracaoMes('2026-09', '2026-10-15')).toBe(1)
    expect(fracaoMes('2026-10', '2026-10-15')).toBeCloseTo(15 / 31)
    expect(fracaoMes('2026-11', '2026-10-15')).toBe(0)
  })
  it('lucro líquido desconta manutenção, seguros e fixos', () => {
    const g = resultadoGeral('2026-09', '2026-10-15', [v()],
      [{ id: 1, caminhaoId: 1, data: '2026-09-10', tipo: 'Corretiva', descricao: '', valor: 50_000, imprevisto: false }],
      [{ id: 1, nome: 'Casco', cobertura: '', vigenciaAte: null, custoMensal: 30_000, obrigatorio: false }],
      [{ id: 1, nome: 'Contador', valorMensal: 20_000 }], 60)
    expect(g.lucro).toBe(1_000_000 - 100_000 - 50_000 - 30_000 - 20_000)
    expect(agregar([v()], 60).n).toBe(1)
  })
})

describe('formatos', () => {
  it('lê números no jeito brasileiro', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56)
    expect(lerNumero('1.234')).toBe(1234)
    expect(lerNumero('550')).toBe(550)
    expect(lerNumero('6.19')).toBe(6.19)
    expect(lerReais('R$ 3.095,00')).toBe(309_500)
    expect(lerNumero('abc')).toBeNull()
  })
  it('formata reais', () => {
    expect(reais(1_234_567)).toBe('R$ 12.346')
    expect(reaisC(-150)).toBe('−R$ 1,50')
  })
})

describe('alertas', () => {
  it('avisa CNH perto do vencimento e revisão por km', () => {
    const cfg = { id: 1, diasAviso: 60, diasUrgente: 20, kmAvisoRevisao: 5000, sulcoMinimo: 3, retornoPct: 60, nomeEmpresa: 'FG', whatsappEscritorio: null }
    const a = calcAlertas('2026-10-01', {
      cfg,
      motoristas: [{ id: 1, nome: 'Ana', telefone: '', pinHash: '', comissaoPct: 10, caminhaoId: 1, cnhAte: '2026-10-11', toxicologicoAte: '2028-01-01', ativo: true, versaoSessao: 1, criadoEm: new Date() }],
      caminhoes: [{ id: 1, placa: 'AAA1A11', placaCarreta: null, descricao: '', ano: null, km: 99_000, metaConsumo: 2.4, proximaRevisaoKm: 100_000, tacografoAte: null, licenciamentoAte: null, ativo: true }],
      apolices: [], lembretes: [], pneus: [],
    })
    expect(a.map((x) => x.texto)).toEqual(['Revisão do AAA1A11', 'CNH de Ana'])
    expect(a.every((x) => x.urgente)).toBe(true)
  })
})
