import { jwtVerify } from 'jose'

export const COOKIE_NOME = 'fg_sessao'

export async function tipoDoToken(token: string | undefined): Promise<'admin' | 'motorista' | null> {
  if (!token || !process.env.SESSION_SECRET) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET))
    return payload.tipo === 'admin' || payload.tipo === 'motorista' ? payload.tipo : null
  } catch {
    return null
  }
}
