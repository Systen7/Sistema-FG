import { Pagina, MTitulo, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando">
      <MTitulo sub={false} />
      <Esq className="linha" w={200} h={20} />
      <div className="tiles">
        {Array.from({ length: 8 }, (_, i) => (
          <Esq key={i} h={104} style={{ borderRadius: 14 }} />
        ))}
      </div>
    </Pagina>
  )
}
