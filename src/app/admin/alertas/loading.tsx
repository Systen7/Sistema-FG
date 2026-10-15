import { Pagina, Cabecalho, Duas, Lista } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando os alertas">
      <Cabecalho />
      <Duas>
        <Lista itens={6} />
        <Lista itens={3} botoes={0} />
      </Duas>
    </Pagina>
  )
}
