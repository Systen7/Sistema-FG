import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NOME, tipoDoToken } from '@/lib/token-edge'

// Primeira barreira: sem sessão válida, não entra nas áreas protegidas.
// A checagem completa (motorista ativo, sessão não revogada) acontece em cada página.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const tipo = await tipoDoToken(req.cookies.get(COOKIE_NOME)?.value)
  const area = pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/m') ? 'motorista' : null
  if (area && tipo !== area) {
    const url = req.nextUrl.clone()
    url.pathname = '/entrar'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/m', '/m/:path*'] }
