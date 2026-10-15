import { Pagina, MTitulo, MCampos, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando">
      <MTitulo sub={false} />
      {[0, 1].map((i) => (
        <Esq key={i} className="acao" h={60} />
      ))}
      <MCampos n={5} />
    </Pagina>
  )
}
