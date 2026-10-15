import { Pagina, Cabecalho, Kpis, Tabela, Duas, Lista } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando seguros e custos"><Cabecalho botoes={2} /><section className="esq-hero"><Kpis n={4} escuro /></section><Tabela linhas={5} colunas={5} /><Duas><Lista itens={4} /><Lista itens={6} /></Duas></Pagina>
}
