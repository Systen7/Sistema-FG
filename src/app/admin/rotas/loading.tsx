import { Pagina, Cabecalho, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando as rotas">
      <Cabecalho botoes={0} />
      <Tabela linhas={6} colunas={8} titulo={false} />
    </Pagina>
  )
}
