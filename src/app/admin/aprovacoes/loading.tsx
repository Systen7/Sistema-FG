import { Pagina, Cabecalho, Lista, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando as aprovações">
      <Cabecalho />
      <Esq className="texto" w={320} />
      <Lista itens={5} titulo={false} />
    </Pagina>
  )
}
