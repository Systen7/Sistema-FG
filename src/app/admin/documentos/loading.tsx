import { Pagina, Cabecalho, Tabela, Esq } from '@/components/esqueleto'

export default function Carregando() {
  return (
    <Pagina rotulo="Carregando os documentos">
      <Cabecalho botoes={0} />
      <section className="panel"><Esq className="linha" w={120} h={18} /><Esq h={96} style={{ borderRadius: 10 }} /></section>
      <Esq h={46} w={520} style={{ borderRadius: 7, maxWidth: '100%' }} />
      <Tabela linhas={6} colunas={6} titulo={false} />
    </Pagina>
  )
}
