import { Pagina, Cabecalho, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando os motoristas"><Cabecalho botoes={2} /><Tabela linhas={6} colunas={8} titulo={false} /></Pagina>
}
