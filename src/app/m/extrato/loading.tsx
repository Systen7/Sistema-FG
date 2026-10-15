import { Pagina, MTitulo, MLista, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando seu extrato">
      <MTitulo sub={false} />
      <div className="row" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>{Array.from({ length: 5 }, (_, i) => <Esq key={i} w={78} h={40} style={{ flex: 'none' }} />)}</div>
      <section className="esq-hero"><Esq className="linha" w={200} /><Esq w={190} h={48} /><div className="kv" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>{[0, 1, 2].map((i) => <div key={i}><Esq className="linha" w="60%" /><Esq className="num" /></div>)}</div></section>
      <MLista itens={4} />
    </Pagina>
  )
}
