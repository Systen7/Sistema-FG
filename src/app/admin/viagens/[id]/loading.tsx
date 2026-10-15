import { Pagina, Cabecalho, Kpis, Lista, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando a viagem">
      <Cabecalho />
      <section className="esq-hero"><Kpis n={4} escuro /><Kpis n={4} escuro /></section>
      <Tabela linhas={4} colunas={7} />
      <Lista itens={2} />
    </Pagina>
  )
}
