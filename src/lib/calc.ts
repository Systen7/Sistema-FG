// Regras de cálculo do sistema. Funções puras: recebem os dados e devolvem números (dinheiro em centavos).
import type { Viagem, Despesa, Manutencao, Apolice, CustoFixo } from '@/db/schema'
import { diasNoMes } from './datas'

export type ViagemCompleta = Viagem & { despesas: Despesa[] }

export interface CalcViagem {
  total: number; diesel: number; pedagio: number; outros: number; litros: number
  comissao: number; km: number | null; kmCarregado: number | null; perdido: number
  reembolso: number; lucro: number; consumo: number | null; pendentes: number
}

export function calcViagem(v: ViagemCompleta, retornoPct: number): CalcViagem {
  const validas = v.despesas.filter((e) => e.status !== 'recusada')
  const soma = (f: (e: Despesa) => boolean) => validas.filter(f).reduce((s, e) => s + e.valor, 0)
  const total = soma(() => true)
  const diesel = soma((e) => e.tipo === 'Diesel')
  const pedagio = soma((e) => e.tipo === 'Pedágio')
  const litros = validas.reduce((s, e) => s + (e.litros ?? 0), 0)
  const comissao = Math.round((v.frete * v.comissaoPct) / 100)
  const km = v.kmFinal != null ? v.kmFinal - v.kmInicial : null
  const kmCarregado = km != null ? km - v.kmVazio : null
  // "Deixou de ganhar": comissão que o motorista teria sobre um frete de retorno nos km rodados vazios.
  const perdido = km && v.kmVazio > 0 && kmCarregado && kmCarregado > 0
    ? Math.round(v.kmVazio * (v.frete / kmCarregado) * (retornoPct / 100) * (v.comissaoPct / 100))
    : 0
  const reembolso = v.despesas.filter((e) => e.pagoPor === 'motorista' && e.status === 'aprovada').reduce((s, e) => s + e.valor, 0)
  return {
    total, diesel, pedagio, outros: total - diesel - pedagio, litros, comissao, km, kmCarregado, perdido, reembolso,
    lucro: v.frete - total - comissao,
    consumo: km && litros ? km / litros : null,
    pendentes: v.despesas.filter((e) => e.status === 'pendente').length,
  }
}

export interface Agregado {
  n: number; frete: number; diesel: number; pedagio: number; outros: number; comissao: number
  km: number; kmVazio: number; litros: number; perdido: number; lucroViagens: number; reembolso: number; adiantamento: number
}

export function agregar(vs: ViagemCompleta[], retornoPct: number): Agregado {
  const a: Agregado = { n: 0, frete: 0, diesel: 0, pedagio: 0, outros: 0, comissao: 0, km: 0, kmVazio: 0, litros: 0, perdido: 0, lucroViagens: 0, reembolso: 0, adiantamento: 0 }
  for (const v of vs) {
    if (v.status !== 'encerrada') continue
    const c = calcViagem(v, retornoPct)
    a.n++; a.frete += v.frete; a.diesel += c.diesel; a.pedagio += c.pedagio; a.outros += c.outros; a.comissao += c.comissao
    a.km += c.km ?? 0; a.kmVazio += v.kmVazio; a.litros += c.litros; a.perdido += c.perdido; a.lucroViagens += c.lucro
    a.reembolso += c.reembolso; a.adiantamento += v.adiantamento
  }
  return a
}

/** Fração do mês já corrida: custos fixos do mês atual entram proporcionais. */
export function fracaoMes(mes: string, hoje: string): number {
  const atual = hoje.slice(0, 7)
  if (mes < atual) return 1
  if (mes > atual) return 0
  return Number(hoje.slice(8, 10)) / diasNoMes(mes)
}

export interface Geral extends Agregado {
  manutencao: number; seguros: number; fixos: number; custo: number; lucro: number
}

export function resultadoGeral(
  mes: string, hoje: string, viagensMes: ViagemCompleta[], manut: Manutencao[], apol: Apolice[], fixos: CustoFixo[], retornoPct: number,
): Geral {
  const a = agregar(viagensMes, retornoPct)
  const f = fracaoMes(mes, hoje)
  const manutencao = manut.filter((m) => m.data.startsWith(mes)).reduce((s, m) => s + m.valor, 0)
  const seguros = Math.round(apol.reduce((s, x) => s + x.custoMensal, 0) * f)
  const fx = Math.round(fixos.reduce((s, x) => s + x.valorMensal, 0) * f)
  const custo = a.diesel + a.pedagio + a.outros + a.comissao + manutencao + seguros + fx
  return { ...a, manutencao, seguros, fixos: fx, custo, lucro: a.frete - custo }
}

/** Acerto do motorista no mês: comissões + reembolsos − adiantamentos. */
export function acerto(vs: ViagemCompleta[], retornoPct: number) {
  const a = agregar(vs, retornoPct)
  return { viagens: a.n, comissao: a.comissao, reembolso: a.reembolso, adiantamento: a.adiantamento, saldo: a.comissao + a.reembolso - a.adiantamento }
}
