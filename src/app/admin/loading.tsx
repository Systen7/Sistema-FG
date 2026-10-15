import { Pagina, Cabecalho, Hero, Duas, Lista, Grafico, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando o painel">
      <Cabecalho />
      <Hero />
      <Duas>
        <Lista itens={4} />
        <Lista itens={2} />
      </Duas>
      <Grafico />
      <Tabela linhas={5} colunas={8} />
    </Pagina>
  )
}
