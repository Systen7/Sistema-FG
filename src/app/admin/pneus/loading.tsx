import { Pagina, Cabecalho, Duas, Esq, Kpis } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando os pneus">
      <Cabecalho />
      <Duas>
        <section className="panel">
          <Esq className="linha" w={160} h={18} />
          <div className="rig">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`axle${i === 3 ? ' gap' : ''}`}>
                <span className="axn" />{Array.from({ length: i ? 2 : 1 }, (_, k) => <Esq key={k} w={24} h={50} />)}<span className="shaft" />{Array.from({ length: i ? 2 : 1 }, (_, k) => <Esq key={k} w={24} h={50} />)}<span className="axn" />
              </div>
            ))}
          </div>
        </section>
        <section className="panel"><Esq className="linha" w={180} h={18} /><Kpis n={4} /></section>
      </Duas>
    </Pagina>
  )
}
