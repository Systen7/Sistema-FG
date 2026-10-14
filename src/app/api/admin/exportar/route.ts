import { adminDaApi } from '@/lib/auth'
import { config, viagensDoMes, viagensFiltradas, motoristas, caminhoes, manutencoes } from '@/lib/dados'
import { acerto, calcViagem } from '@/lib/calc'
import { mesAtual, mesValido } from '@/lib/datas'
import { nomeTipo } from '@/lib/format'

// Planilha CSV no padrão brasileiro (ponto e vírgula, vírgula decimal, BOM para o Excel reconhecer acentos).
const cel = (v: unknown) => {
  if (v == null) return ''
  if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ',')
  let s = String(v)
  // Texto digitado por usuários começando com = + - @ viraria fórmula no Excel: neutraliza com apóstrofo.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const rs = (c: number) => c / 100

export async function GET(req: Request) {
  if (!(await adminDaApi())) return new Response('Não autorizado', { status: 401 })
  const u = new URL(req.url)
  const tipo = u.searchParams.get('tipo') ?? 'viagens'
  const mesP = u.searchParams.get('mes')
  const mes = mesValido(mesP) ? mesP : null
  const [cfg, ms, cs] = await Promise.all([config(), motoristas(), caminhoes()])
  const nm = (id: number) => ms.find((m) => m.id === id)?.nome ?? ''
  const pl = (id: number) => cs.find((c) => c.id === id)?.placa ?? ''
  const vs = mes ? await viagensDoMes(mes) : await viagensFiltradas({})
  let linhas: unknown[][] = []

  if (tipo === 'viagens') {
    linhas = [['Nº', 'Motorista', 'Caminhão', 'Origem', 'Destino', 'Carga', 'Início', 'Chegada', 'Situação', 'Km inicial', 'Km final', 'Km rodado', 'Km vazio', 'Litros', 'Km/l', 'Frete (R$)', 'Combustível (R$)', 'Pedágio (R$)', 'Outras despesas (R$)', 'Comissão %', 'Comissão (R$)', 'Adiantamento (R$)', 'Lucro da viagem (R$)']]
    for (const v of vs) {
      const c = calcViagem(v, cfg.retornoPct)
      linhas.push([v.id, nm(v.motoristaId), pl(v.caminhaoId), v.origem, v.destino, v.carga, v.inicio, v.fim, v.status === 'andamento' ? 'Em viagem' : 'Encerrada', v.kmInicial, v.kmFinal, c.km, v.kmVazio, c.litros, c.consumo, rs(v.frete), rs(c.diesel), rs(c.pedagio), rs(c.outros), v.comissaoPct, rs(c.comissao), rs(v.adiantamento), rs(c.lucro)])
    }
  } else if (tipo === 'despesas') {
    linhas = [['Viagem', 'Motorista', 'Caminhão', 'Data', 'Tipo', 'Valor (R$)', 'Litros', 'Quem pagou', 'Situação', 'Observação', 'Tem foto']]
    for (const v of vs) for (const d of v.despesas) linhas.push([v.id, nm(v.motoristaId), pl(v.caminhaoId), d.data, nomeTipo(d.tipo), rs(d.valor), d.litros, d.pagoPor === 'motorista' ? 'Motorista' : 'Empresa', d.status, d.obs, d.fotoId ? 'sim' : 'não'])
  } else if (tipo === 'acerto') {
    const m = mes ?? mesAtual()
    const doMes = mes ? vs : await viagensDoMes(m)
    linhas = [['Mês', 'Motorista', 'Viagens', 'Comissões (R$)', 'Reembolsos (R$)', 'Adiantamentos (R$)', 'Saldo (R$)']]
    for (const mo of ms) {
      const a = acerto(doMes.filter((v) => v.motoristaId === mo.id && v.status === 'encerrada'), cfg.retornoPct)
      if (a.viagens) linhas.push([m, mo.nome, a.viagens, rs(a.comissao), rs(a.reembolso), rs(a.adiantamento), rs(a.saldo)])
    }
  } else if (tipo === 'manutencoes') {
    linhas = [['Data', 'Caminhão', 'Tipo', 'Descrição', 'Valor (R$)', 'Imprevisto']]
    for (const x of await manutencoes()) if (!mes || x.data.startsWith(mes)) linhas.push([x.data, pl(x.caminhaoId), x.tipo, x.descricao, rs(x.valor), x.imprevisto ? 'sim' : 'não'])
  } else return new Response('Tipo inválido', { status: 400 })

  const csv = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n')
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="fg-${tipo}-${mes ?? 'tudo'}.csv"`, 'Cache-Control': 'no-store' },
  })
}
