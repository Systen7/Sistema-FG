import { Pagina, Cabecalho, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando o acerto"><Cabecalho /><Tabela linhas={6} colunas={7} titulo={false} /></Pagina>
}
