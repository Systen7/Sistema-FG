import { Pagina, MTitulo, MLista } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando"><MTitulo sub={false} /><MLista itens={4} /></Pagina>
}
