// Esqueletos (skeleton) com o formato de cada tela: aparecem na hora ao navegar, enquanto o servidor busca os dados.
// Só formas neutras, com um brilho lento que passa (desligado com "reduzir movimento"). Leitores de tela ouvem "Carregando".

type P = { w?: string | number; h?: string | number; className?: string; style?: React.CSSProperties }
export const Esq = ({ w, h, className = '', style }: P) => <span className={`esq ${className}`} style={{ width: w, height: h, ...style }} aria-hidden />

export function Pagina({ children, rotulo = 'Carregando' }: { children: React.ReactNode; rotulo?: string }) {
  return <div className="esq-pagina" role="status" aria-busy="true" aria-label={rotulo}><span className="sr">{rotulo}…</span>{children}</div>
}

/* ---------- peças do escritório ---------- */
export function Cabecalho({ botoes = 1, texto = true }: { botoes?: number; texto?: boolean }) {
  return (
    <div className="head">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Esq className="titulo" />
        {texto && <Esq className="texto" w="min(520px, 70vw)" />}
      </div>
      {botoes > 0 && <div className="row">{Array.from({ length: botoes }, (_, i) => <Esq key={i} className="botao" />)}</div>}
    </div>
  )
}

export function Kpis({ n = 4, escuro = false }: { n?: number; escuro?: boolean }) {
  return (
    <div className="minis" style={escuro ? undefined : { gap: 12 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={escuro ? undefined : { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: '10px 12px' }}>
          <Esq className="linha" w="50%" /><Esq className="num" />
        </div>
      ))}
    </div>
  )
}

export function Tabela({ linhas = 6, colunas = 6, titulo = true }: { linhas?: number; colunas?: number; titulo?: boolean }) {
  const larg = ['18%', '12%', '24%', '10%', '12%', '10%', '8%', '6%']
  const grade = Array.from({ length: colunas }, (_, i) => `${[2, 1, 2.4, 1, 1, 1, 0.8, 0.6][i] ?? 1}fr`).join(' ')
  return (
    <section className="panel">
      {titulo && <Esq className="linha" w={160} h={18} />}
      <div className="esq-tabela">
        {Array.from({ length: linhas }, (_, r) => (
          <div key={r} style={{ gridTemplateColumns: grade }}>
            {Array.from({ length: colunas }, (_, c) => <Esq key={c} className="texto" w={r === 0 ? '60%' : larg[c] ? `${70 + ((r * 7 + c * 13) % 30)}%` : '80%'} style={r === 0 ? { height: 10, opacity: .6 } : undefined} />)}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Lista({ itens = 4, titulo = true, botoes = 1 }: { itens?: number; titulo?: boolean; botoes?: number }) {
  return (
    <section className="panel">
      {titulo && <div className="row between"><Esq className="linha" w={180} h={18} />{botoes > 0 && <Esq className="botao" w={110} h={32} />}</div>}
      <div className="esq-tabela">
        {Array.from({ length: itens }, (_, i) => (
          <div key={i} style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Esq className="texto" w={`${55 + (i * 17) % 35}%`} /><Esq className="linha" w={`${30 + (i * 11) % 25}%`} /></span>
            <Esq className="botao" w={90} h={32} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function Grafico({ altura = 240 }: { altura?: number }) {
  return (
    <section className="panel">
      <Esq className="linha" w={220} h={18} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6%', height: altura, padding: '0 4% 0 10%', borderBottom: '1px solid var(--line)' }}>
        {[55, 72, 40, 88, 63, 30].map((h, i) => <Esq key={i} w="8%" h={`${h}%`} style={{ borderRadius: '4px 4px 0 0' }} />)}
      </div>
    </section>
  )
}

export function Hero() {
  return (
    <section className="esq-hero">
      <div className="row between" style={{ alignItems: 'flex-end', gap: '18px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Esq className="linha" w={200} /><Esq w={300} h={72} style={{ borderRadius: 8 }} /><Esq className="texto" w={260} />
        </div>
        <div style={{ flex: '1 1 380px', maxWidth: 580 }}><Kpis n={3} escuro /></div>
      </div>
      <Esq h={40} style={{ borderRadius: 4 }} />
      <div className="row">{[140, 110, 180, 160, 150].map((w, i) => <Esq key={i} w={w} h={24} style={{ borderRadius: 20 }} />)}</div>
    </section>
  )
}

export function Duas({ children }: { children: React.ReactNode }) {
  return <div className="cols">{children}</div>
}

/* ---------- peças do app do motorista ---------- */
export function MTitulo({ sub = true }: { sub?: boolean }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{sub && <Esq className="linha" w={120} />}<Esq className="titulo" /></div>
}
export function MCartao({ acoes = 2 }: { acoes?: number }) {
  return (
    <section className="esq-hero">
      <div className="row between"><Esq w={170} h={26} style={{ borderRadius: 4 }} /><Esq className="linha" w={80} /></div>
      <Esq w="70%" h={30} /><Esq w="55%" h={30} />
      <Esq className="texto" w="60%" />
      <div className="kv">{[0, 1].map((i) => <div key={i}><Esq className="linha" w="50%" /><Esq className="num" w="70%" /></div>)}</div>
      {Array.from({ length: acoes }, (_, i) => <Esq key={i} className="acao" />)}
    </section>
  )
}
export function MLista({ itens = 3 }: { itens?: number }) {
  return (
    <section className="panel">
      <div className="row between"><Esq className="linha" w={170} h={20} /><Esq className="linha" w={80} h={20} /></div>
      <div className="esq-tabela">
        {Array.from({ length: itens }, (_, i) => (
          <div key={i} style={{ gridTemplateColumns: '28px 1fr auto', alignItems: 'center' }}>
            <Esq w={26} h={26} className="circ" />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Esq className="texto" w="60%" /><Esq className="linha" w="40%" /></span>
            <Esq className="texto" w={70} />
          </div>
        ))}
      </div>
    </section>
  )
}
export function MCampos({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from({ length: n }, (_, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Esq className="linha" w={140} /><Esq h={56} style={{ borderRadius: 10 }} /></div>)}
      <Esq h={64} style={{ borderRadius: 12 }} />
    </div>
  )
}
