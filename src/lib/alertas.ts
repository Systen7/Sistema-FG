import type { Motorista, Caminhao, Apolice, Lembrete, Configuracao, Pneu } from '@/db/schema'
import { dias } from './datas'
import { dataLonga, num } from './format'

export type MdfeAberto = { id: number; numero: number; emitidoEm: string; viagemId: number | null; viagemEncerrada: boolean }

export interface Alerta {
  chave: string
  ordem: number
  urgente: boolean
  texto: string
  detalhe: string
  link: string // onde corrigir
}

export function calcAlertas(
  hoje: string,
  d: { motoristas: Motorista[]; caminhoes: Caminhao[]; apolices: Apolice[]; lembretes: Lembrete[]; pneus: Pneu[]; cfg: Configuracao; mdfes?: MdfeAberto[] },
): Alerta[] {
  const { cfg } = d
  const out: Alerta[] = []
  const porData = (chave: string, texto: string, v: string | null, link: string) => {
    if (!v) return
    const n = dias(hoje, v)
    if (n > cfg.diasAviso) return
    out.push({
      chave: `${chave}:${v}`,
      ordem: n,
      urgente: n <= cfg.diasUrgente,
      texto,
      link,
      detalhe: n < 0 ? `vencido há ${-n} ${-n === 1 ? 'dia' : 'dias'}` : n === 0 ? 'vence hoje' : `vence em ${n} ${n === 1 ? 'dia' : 'dias'} (${dataLonga(v)})`,
    })
  }
  for (const m of d.motoristas.filter((x) => x.ativo)) {
    porData(`cnh${m.id}`, `CNH de ${m.nome}`, m.cnhAte, `/admin/motoristas?editar=${m.id}`)
    porData(`tox${m.id}`, `Exame toxicológico de ${m.nome}`, m.toxicologicoAte, `/admin/motoristas?editar=${m.id}`)
  }
  for (const p of d.apolices) porData(`ap${p.id}`, `Apólice: ${p.nome}`, p.vigenciaAte, `/admin/seguros?editar=apolice-${p.id}`)
  for (const l of d.lembretes) porData(`lb${l.id}`, l.texto, l.data, `/admin/alertas?editar=${l.id}`)
  for (const t of d.caminhoes.filter((x) => x.ativo)) {
    porData(`tac${t.id}`, `Tacógrafo do ${t.placa}`, t.tacografoAte, `/admin/frota?editar=${t.id}`)
    porData(`lic${t.id}`, `Licenciamento do ${t.placa}`, t.licenciamentoAte, `/admin/frota?editar=${t.id}`)
    if (t.proximaRevisaoKm != null) {
      const falta = t.proximaRevisaoKm - t.km
      if (falta <= cfg.kmAvisoRevisao)
        out.push({
          chave: `rev${t.id}:${t.proximaRevisaoKm}`,
          ordem: falta / 200,
          urgente: falta <= cfg.kmAvisoRevisao / 2.5,
          texto: `Revisão do ${t.placa}`,
          detalhe: falta < 0 ? `passou ${num(-falta)} km` : `faltam ${num(falta)} km`,
          link: `/admin/frota?editar=${t.id}`,
        })
    }
    const gastos = d.pneus.filter((p) => p.caminhaoId === t.id && p.sulco < cfg.sulcoMinimo).length
    if (gastos)
      out.push({
        chave: `pn${t.id}:${gastos}`,
        ordem: 5,
        urgente: true,
        texto: `Pneus do ${t.placa}`,
        detalhe: `${gastos} ${gastos === 1 ? 'pneu' : 'pneus'} com sulco abaixo de ${num(cfg.sulcoMinimo, 1)} mm`,
        link: `/admin/pneus?caminhao=${t.id}`,
      })
  }
  // MDF-e precisa ser encerrado na entrega; aberto com a viagem já encerrada (ou há mais de 30 dias) é pendência fiscal.
  for (const m of d.mdfes ?? []) {
    const idade = dias(m.emitidoEm, hoje)
    if (m.viagemEncerrada || idade > 30)
      out.push({
        chave: `mdfe${m.id}`,
        ordem: -1,
        urgente: true,
        texto: `MDF-e nº ${m.numero} ainda aberto`,
        detalhe: m.viagemEncerrada ? `a viagem ${m.viagemId} já terminou; encerre no seu emissor` : `emitido há ${idade} dias; encerre no seu emissor`,
        link: m.viagemId ? `/admin/viagens/${m.viagemId}` : '/admin/documentos?ver=abertos',
      })
  }
  return out.sort((a, b) => a.ordem - b.ordem)
}
