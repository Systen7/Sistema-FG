// Campos dos formulários do escritório. Ficam aqui para a página (que desenha) e a ação (que valida) usarem a mesma lista.
import type { Campo } from '@/components/form-modal'
import { TIPOS_DESPESA, lerNumero, lerReais, nomeTipo } from '@/lib/format'

export const camposMotorista = (caminhoes: [string, string][], novo: boolean): Campo[] => [
  { nome: 'nome', rotulo: 'Nome completo', largo: true },
  { nome: 'telefone', rotulo: 'Celular (WhatsApp) com DDD', tipo: 'tel', placeholder: '(66) 99999-0000', dica: 'O motorista entra com este número.' },
  { nome: 'pin', rotulo: novo ? 'PIN de 4 números' : 'Novo PIN', tipo: 'senha', obrig: novo, placeholder: novo ? '' : 'deixe vazio para manter', dica: novo ? 'Ou envie o link de acesso e ele não precisa decorar.' : undefined },
  { nome: 'comissaoPct', rotulo: 'Comissão sobre o frete (%)', tipo: 'num', dica: 'Vale para as próximas viagens; as já iniciadas mantêm o percentual delas.' },
  { nome: 'caminhaoId', rotulo: 'Caminhão', tipo: 'select', opcoes: [['', 'Sem caminhão'], ...caminhoes] },
  { nome: 'cnhAte', rotulo: 'Validade da CNH', tipo: 'data', obrig: false },
  { nome: 'toxicologicoAte', rotulo: 'Validade do exame toxicológico', tipo: 'data', obrig: false },
  { nome: 'ativo', rotulo: 'Ativo', tipo: 'bool', dica: 'Inativo não consegue entrar, mas o histórico fica.' },
]

export const camposCaminhao: Campo[] = [
  { nome: 'placa', rotulo: 'Placa do cavalo', placeholder: 'ABC1D23' },
  { nome: 'placaCarreta', rotulo: 'Placa da carreta', obrig: false },
  { nome: 'descricao', rotulo: 'Descrição do conjunto', largo: true, placeholder: 'Ex.: Cavalo 6x4 + graneleira' },
  { nome: 'ano', rotulo: 'Ano', tipo: 'num', obrig: false },
  { nome: 'km', rotulo: 'Km atual', tipo: 'num' },
  { nome: 'metaConsumo', rotulo: 'Meta de consumo (km/l)', tipo: 'num' },
  { nome: 'proximaRevisaoKm', rotulo: 'Próxima revisão no km', tipo: 'num', obrig: false },
  { nome: 'tacografoAte', rotulo: 'Tacógrafo aferido até', tipo: 'data', obrig: false },
  { nome: 'licenciamentoAte', rotulo: 'Licenciamento válido até', tipo: 'data', obrig: false },
  { nome: 'ativo', rotulo: 'Em operação', tipo: 'bool' },
]

export const camposViagem = (motoristas: [string, string][], caminhoes: [string, string][]): Campo[] => [
  { nome: 'motoristaId', rotulo: 'Motorista', tipo: 'select', opcoes: motoristas },
  { nome: 'caminhaoId', rotulo: 'Caminhão', tipo: 'select', opcoes: caminhoes },
  { nome: 'origem', rotulo: 'Origem', placeholder: 'Cidade/UF' },
  { nome: 'destino', rotulo: 'Destino', placeholder: 'Cidade/UF' },
  { nome: 'carga', rotulo: 'Carga', largo: true },
  { nome: 'frete', rotulo: 'Frete (R$)', tipo: 'dinheiro' },
  { nome: 'comissaoPct', rotulo: 'Comissão desta viagem (%)', tipo: 'num', obrig: false, dica: 'Vazio = comissão atual do motorista.' },
  { nome: 'adiantamento', rotulo: 'Adiantamento ao motorista (R$)', tipo: 'dinheiro', obrig: false },
  { nome: 'inicio', rotulo: 'Início', tipo: 'data' },
  { nome: 'kmInicial', rotulo: 'Km inicial', tipo: 'num' },
  { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['andamento', 'Em viagem'], ['encerrada', 'Encerrada']] },
  { nome: 'fim', rotulo: 'Chegada', tipo: 'data', obrig: false },
  { nome: 'kmFinal', rotulo: 'Km final', tipo: 'num', obrig: false },
  { nome: 'kmVazio', rotulo: 'Km rodado vazio', tipo: 'num', obrig: false },
]

export const camposDespesa: Campo[] = [
  { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS_DESPESA.map((t) => [t, nomeTipo(t)]) },
  { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro' },
  { nome: 'litros', rotulo: 'Litros (se combustível)', tipo: 'num', obrig: false },
  { nome: 'data', rotulo: 'Data', tipo: 'data' },
  { nome: 'pagoPor', rotulo: 'Quem pagou', tipo: 'select', opcoes: [['empresa', 'Empresa'], ['motorista', 'Motorista (reembolsar)']] },
  { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: [['aprovada', 'Aprovada'], ['pendente', 'Pendente'], ['recusada', 'Recusada']] },
  { nome: 'obs', rotulo: 'Observação', largo: true, obrig: false },
]

export const camposManutencao = (caminhoes: [string, string][]): Campo[] => [
  { nome: 'caminhaoId', rotulo: 'Caminhão', tipo: 'select', opcoes: caminhoes },
  { nome: 'data', rotulo: 'Data', tipo: 'data' },
  { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: ['Preventiva', 'Corretiva', 'Pneus', 'Peças', 'Funilaria', 'Outros'].map((x) => [x, x]) },
  { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'dinheiro' },
  { nome: 'descricao', rotulo: 'Descrição', largo: true },
  { nome: 'imprevisto', rotulo: 'Foi imprevisto?', tipo: 'bool' },
]

export const camposPneu: Campo[] = [
  { nome: 'sulco', rotulo: 'Sulco (mm)', tipo: 'num' },
  { nome: 'recapagens', rotulo: 'Recapagens', tipo: 'num' },
  { nome: 'km', rotulo: 'Km rodado', tipo: 'num' },
  { nome: 'custo', rotulo: 'Custo acumulado (R$)', tipo: 'dinheiro' },
]

export const camposApolice: Campo[] = [
  { nome: 'nome', rotulo: 'Seguro', largo: true },
  { nome: 'cobertura', rotulo: 'Cobertura', largo: true },
  { nome: 'vigenciaAte', rotulo: 'Vigência até', tipo: 'data', obrig: false },
  { nome: 'custoMensal', rotulo: 'Custo mensal (R$)', tipo: 'dinheiro' },
  { nome: 'obrigatorio', rotulo: 'É obrigatório?', tipo: 'bool' },
]

export const camposFixo: Campo[] = [
  { nome: 'nome', rotulo: 'Custo', largo: true },
  { nome: 'valorMensal', rotulo: 'Valor mensal (R$)', tipo: 'dinheiro' },
]

export const camposLembrete: Campo[] = [
  { nome: 'texto', rotulo: 'Lembrete', largo: true },
  { nome: 'data', rotulo: 'Data limite', tipo: 'data' },
]

// ---------- leitura dos campos ----------
export class ErroCampo extends Error {}

export function ler(f: FormData, campos: Campo[]) {
  const o: Record<string, string | number | boolean | null> = {}
  for (const c of campos) {
    const bruto = f.get(c.nome)
    const s = typeof bruto === 'string' ? bruto.trim() : ''
    const t = c.tipo ?? 'text'
    const obrig = c.obrig !== false && t !== 'bool' && t !== 'senha'
    if (!s && obrig && t !== 'select') throw new ErroCampo(`Preencha "${c.rotulo}".`)
    if (t === 'bool') o[c.nome] = s === '1'
    else if (t === 'num') {
      if (!s) { o[c.nome] = null; continue }
      const v = lerNumero(s)
      if (v === null || v < 0) throw new ErroCampo(`"${c.rotulo}" precisa ser um número.`)
      o[c.nome] = v
    } else if (t === 'dinheiro') {
      if (!s) { o[c.nome] = c.obrig === false ? 0 : null; continue }
      const v = lerReais(s)
      if (v === null || v < 0) throw new ErroCampo(`"${c.rotulo}" precisa ser um valor em reais.`)
      o[c.nome] = v
    } else if (t === 'data') {
      if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ErroCampo(`Data inválida em "${c.rotulo}".`)
      o[c.nome] = s || null
    } else if (t === 'select') {
      if (c.opcoes?.length && !c.opcoes.some(([k]) => k === s)) throw new ErroCampo(`Escolha uma opção em "${c.rotulo}".`)
      o[c.nome] = s || null
    } else o[c.nome] = s || null
  }
  return o
}
