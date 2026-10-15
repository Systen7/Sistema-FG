import { Pagina, MTitulo, MLista, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return <Pagina rotulo="Carregando sua conta"><MTitulo /><MLista itens={4} /><Esq className="acao" /><Esq className="acao" /></Pagina>
}
