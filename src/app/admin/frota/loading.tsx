import { Pagina, Cabecalho, Tabela } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando a frota">
      <Cabecalho botoes={3} />
      <Tabela linhas={5} colunas={8} />
      <Tabela linhas={4} colunas={6} />
    </Pagina>
  )
}
