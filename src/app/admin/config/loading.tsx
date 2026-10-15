import { Pagina, Cabecalho, Duas, Lista, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando as configurações"><Cabecalho botoes={0} /><Duas><Lista itens={2} botoes={0} /><Lista itens={3} botoes={0} /></Duas><Lista itens={2} botoes={0} /><Tabela linhas={8} colunas={3} /></Pagina>
}
