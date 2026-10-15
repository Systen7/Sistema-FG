import { describe, it, expect } from 'vitest'
import type { Caminhao, Configuracao, Motorista, Pneu } from '@/db/schema'
import { calcAlertas } from '@/lib/alertas'

const HOJE = '2026-10-15'
const cfg: Configuracao = {
  id: 1,
  diasAviso: 60,
  diasUrgente: 20,
  kmAvisoRevisao: 5000,
  sulcoMinimo: 3,
  retornoPct: 60,
  nomeEmpresa: 'FG',
  whatsappEscritorio: null,
}
const base = { cfg, motoristas: [] as Motorista[], caminhoes: [] as Caminhao[], apolices: [], lembretes: [], pneus: [] as Pneu[] }
const mot = (o: Partial<Motorista> = {}): Motorista => ({
  id: 1,
  nome: 'Ana',
  telefone: '',
  pinHash: '',
  comissaoPct: 10,
  caminhaoId: null,
  cnhAte: null,
  toxicologicoAte: null,
  ativo: true,
  versaoSessao: 1,
  criadoEm: new Date(),
  ...o,
})
const cam = (o: Partial<Caminhao> = {}): Caminhao => ({
  id: 1,
  placa: 'AAA1A11',
  placaCarreta: null,
  descricao: '',
  ano: null,
  km: 100_000,
  metaConsumo: 2.4,
  proximaRevisaoKm: null,
  tacografoAte: null,
  licenciamentoAte: null,
  ativo: true,
  ...o,
})
const pneu = (caminhaoId: number, sulco: number, posicao = 0): Pneu => ({
  id: posicao,
  caminhaoId,
  posicao,
  eixo: 'Direcional',
  lado: 'Esquerdo',
  local: '',
  sulco,
  recapagens: 0,
  km: 0,
  custo: 0,
})
const lembrete = (data: string, id = 1) => ({ id, texto: `Lembrete ${id}`, data })

describe('alertas por data', () => {
  it('texto do prazo: vencido, hoje, amanhã e com data', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      lembretes: [lembrete('2026-10-14', 1), lembrete('2026-10-10', 2), lembrete(HOJE, 3), lembrete('2026-10-16', 4), lembrete('2026-11-04', 5)],
    })
    expect(a.map((x) => x.detalhe)).toEqual([
      'vencido há 5 dias',
      'vencido há 1 dia',
      'vence hoje',
      'vence em 1 dia (16/10/2026)',
      'vence em 20 dias (04/11/2026)',
    ])
    expect(a.map((x) => x.ordem)).toEqual([-5, -1, 0, 1, 20])
    expect(a[0]).toMatchObject({ chave: 'lb2:2026-10-10', link: '/admin/alertas?editar=2', texto: 'Lembrete 2' })
  })
  it('limites de aviso e de urgência são inclusivos', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      lembretes: [lembrete('2026-11-04', 1), lembrete('2026-11-05', 2), lembrete('2026-12-14', 3), lembrete('2026-12-15', 4)],
    })
    expect(a.map((x) => [x.chave, x.urgente])).toEqual([
      ['lb1:2026-11-04', true],
      ['lb2:2026-11-05', false],
      ['lb3:2026-12-14', false],
    ])
  })
  it('ignora motoristas e caminhões inativos e datas vazias', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      motoristas: [mot({ ativo: false, cnhAte: HOJE }), mot({ id: 2 })],
      caminhoes: [cam({ ativo: false, tacografoAte: HOJE, proximaRevisaoKm: 1 }), cam({ id: 2 })],
      pneus: [pneu(1, 1)],
    })
    expect(a).toEqual([])
  })
  it('toxicológico, apólice, tacógrafo e licenciamento com seus links', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      motoristas: [mot({ id: 7, toxicologicoAte: '2026-10-20' })],
      apolices: [{ id: 3, nome: 'RCTR-C', cobertura: '', vigenciaAte: '2026-10-21', custoMensal: 0, obrigatorio: true }],
      caminhoes: [cam({ id: 9, tacografoAte: '2026-10-22', licenciamentoAte: '2026-10-23' })],
    })
    expect(a.map((x) => [x.texto, x.link])).toEqual([
      ['Exame toxicológico de Ana', '/admin/motoristas?editar=7'],
      ['Apólice: RCTR-C', '/admin/seguros?editar=apolice-3'],
      ['Tacógrafo do AAA1A11', '/admin/frota?editar=9'],
      ['Licenciamento do AAA1A11', '/admin/frota?editar=9'],
    ])
  })
})

describe('alerta de revisão', () => {
  const rev = (km: number, proximaRevisaoKm: number | null) => calcAlertas(HOJE, { ...base, caminhoes: [cam({ km, proximaRevisaoKm })] })
  it('só a partir de kmAvisoRevisao (inclusivo)', () => {
    expect(rev(94_999, 100_000)).toEqual([])
    expect(rev(95_000, 100_000)).toMatchObject([{ chave: 'rev1:100000', detalhe: 'faltam 5.000 km', urgente: false, ordem: 25 }])
    expect(rev(0, null)).toEqual([])
  })
  it('urgente com 2.000 km ou menos (kmAvisoRevisao / 2,5)', () => {
    expect(rev(97_999, 100_000)[0].urgente).toBe(false)
    expect(rev(98_000, 100_000)[0].urgente).toBe(true)
  })
  it('revisão vencida mostra quanto passou', () => {
    expect(rev(101_500, 100_000)[0]).toMatchObject({ detalhe: 'passou 1.500 km', urgente: true, ordem: -7.5 })
    expect(rev(100_000, 100_000)[0].detalhe).toBe('faltam 0 km')
  })
})

describe('alerta de pneus', () => {
  it('conta só pneus do caminhão abaixo do sulco mínimo (estritamente)', () => {
    const um = calcAlertas(HOJE, { ...base, caminhoes: [cam()], pneus: [pneu(1, 2.9, 0), pneu(1, 3, 1), pneu(2, 1, 2)] })
    expect(um).toEqual([
      { chave: 'pn1:1', ordem: 5, urgente: true, texto: 'Pneus do AAA1A11', detalhe: '1 pneu com sulco abaixo de 3,0 mm', link: '/admin/pneus?caminhao=1' },
    ])
    const dois = calcAlertas(HOJE, { ...base, caminhoes: [cam()], pneus: [pneu(1, 2, 0), pneu(1, 1.5, 1)] })
    expect(dois[0].detalhe).toBe('2 pneus com sulco abaixo de 3,0 mm')
  })
})

describe('alerta de MDF-e', () => {
  it('30 dias ainda não avisa; 31 avisa e aponta para a lista de abertos sem viagem', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      mdfes: [
        { id: 1, numero: 1, emitidoEm: '2026-09-15', viagemId: 4, viagemEncerrada: false },
        { id: 2, numero: 2, emitidoEm: '2026-09-14', viagemId: null, viagemEncerrada: false },
      ],
    })
    expect(a).toEqual([
      {
        chave: 'mdfe2',
        ordem: -1,
        urgente: true,
        texto: 'MDF-e nº 2 ainda aberto',
        detalhe: 'emitido há 31 dias; encerre no seu emissor',
        link: '/admin/documentos?ver=abertos',
      },
    ])
  })
  it('viagem encerrada avisa mesmo com MDF-e recente', () => {
    const a = calcAlertas(HOJE, { ...base, mdfes: [{ id: 1, numero: 1, emitidoEm: HOJE, viagemId: 4, viagemEncerrada: true }] })
    expect(a[0]).toMatchObject({ detalhe: 'a viagem 4 já terminou; encerre no seu emissor', link: '/admin/viagens/4' })
  })
  it('sem lista de MDF-e não quebra', () => {
    expect(calcAlertas(HOJE, base)).toEqual([])
  })
})

describe('ordenação', () => {
  it('mais urgentes primeiro, misturando tipos', () => {
    const a = calcAlertas(HOJE, {
      ...base,
      lembretes: [lembrete('2026-10-25', 1), lembrete('2026-10-01', 2)],
      caminhoes: [cam()],
      pneus: [pneu(1, 1)],
      mdfes: [{ id: 1, numero: 1, emitidoEm: HOJE, viagemId: 4, viagemEncerrada: true }],
    })
    expect(a.map((x) => x.chave)).toEqual(['lb2:2026-10-01', 'mdfe1', 'pn1:1', 'lb1:2026-10-25'])
  })
})
