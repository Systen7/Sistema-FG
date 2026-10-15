import { Pagina, Cabecalho, Duas, Esq } from '@/components/esqueleto'

const Cartao = () => <section className="panel"><Esq className="linha" w={120} h={20} /><Esq className="texto" w="85%" /><div className="row"><Esq w={170} h={40} /><Esq className="botao" w={170} /></div></section>

export default function Carregando() {
  return <Pagina rotulo="Carregando os relatórios"><Cabecalho botoes={0} /><Duas><Cartao /><Cartao /><Cartao /><Cartao /><Cartao /></Duas></Pagina>
}
