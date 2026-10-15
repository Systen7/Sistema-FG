import { Pagina, Cabecalho, Tabela, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando as viagens">
      <Cabecalho botoes={2} />
      <div className="row">{[170, 180, 160].map((w, i) => <Esq key={i} w={w} h={38} style={{ borderRadius: 6 }} />)}</div>
      <Tabela linhas={9} colunas={8} titulo={false} />
    </Pagina>
  )
}
