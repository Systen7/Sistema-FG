import { Esq, Pagina } from '@/components/esqueleto'

/** Tela de entrada enquanto confere a sessão. Mesmo desenho da tela real, para não pular. */
export default function Carregando() {
  return (
    <main className="login">
      <Pagina rotulo="Abrindo">
        <div className="brand">
          <i>FG</i>
          <Esq className="linha" w={140} h={18} />
        </div>
        <Esq h={52} style={{ borderRadius: 12 }} />
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Esq className="titulo" w="60%" />
          <Esq className="linha" w={140} />
          <Esq h={56} style={{ borderRadius: 10 }} />
          <Esq h={64} style={{ borderRadius: 12 }} />
        </section>
      </Pagina>
    </main>
  )
}
