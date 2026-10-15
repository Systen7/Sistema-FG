// Recriado a cada troca de página do motorista: o conteúdo novo (ou o esqueleto) entra com animação (movimento.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pagina">{children}</div>
}
