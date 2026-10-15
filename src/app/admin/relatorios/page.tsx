import { FileSpreadsheet } from 'lucide-react'
import { mesesDisponiveis } from '@/lib/dados'
import { mesAtual, nomeMes } from '@/lib/datas'
import { Cabecalho } from '../ui'

export const metadata = { title: 'Relatórios' }

const TIPOS = [
  ['viagens', 'Viagens', 'Uma linha por viagem: motorista, caminhão, rota, km, frete, despesas, comissão e lucro.'],
  ['despesas', 'Despesas', 'Todos os gastos lançados, com tipo, litros, quem pagou e situação.'],
  ['acerto', 'Acerto', 'Comissões, reembolsos, adiantamentos e saldo de cada motorista.'],
  ['manutencoes', 'Manutenções', 'Serviços e peças por caminhão.'],
  ['documentos', 'CT-e e MDF-e', 'Documentos fiscais importados, com chave, situação e viagem.'],
] as const

export default async function Relatorios() {
  const meses = await mesesDisponiveis(mesAtual())
  return (
    <>
      <Cabecalho titulo="Relatórios" texto="Baixe os dados em planilha (abre no Excel e no Google Planilhas) para a contabilidade ou para análises próprias." />
      <div className="cols">
        {TIPOS.map(([k, t, d]) => (
          <section key={k} className="panel">
            <header><h2>{t}</h2></header>
            <p className="muted">{d}</p>
            <form action="/api/admin/exportar" className="row">
              <input type="hidden" name="tipo" value={k} />
              <select name="mes" className="inp" style={{ width: 'auto', minHeight: 40, padding: '6px 10px' }} aria-label="Mês">
                {k !== 'acerto' && <option value="">Todos os meses</option>}
                {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
              </select>
              <button type="submit" className="btn pri"><FileSpreadsheet className="ico" />Baixar planilha</button>
            </form>
          </section>
        ))}
      </div>
    </>
  )
}
