'use server'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { hash, iniciarSessao } from '@/lib/auth'

export async function criarPrimeiroAdmin(_: { erro?: string } | undefined, f: FormData) {
  const nome = String(f.get('nome') ?? '').trim()
  const usuario = String(f.get('usuario') ?? '').trim().toLowerCase()
  const senha = String(f.get('senha') ?? '')
  const empresa = String(f.get('empresa') ?? '').trim() || 'Empresa FG'
  if (!nome) return { erro: 'Digite seu nome.' }
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return { erro: 'Usuário: de 3 a 30 letras ou números, sem espaços.' }
  if (senha.length < 8) return { erro: 'A senha precisa ter pelo menos 8 caracteres.' }
  if (senha !== String(f.get('confirma') ?? '')) return { erro: 'As duas senhas não são iguais.' }
  const senhaHash = await hash(senha)
  // Trava: só cria se continuar sem nenhum administrador (evita duas pessoas ao mesmo tempo).
  const r = await db.execute<{ id: number }>(sql`
    INSERT INTO administradores (nome, usuario, senha_hash)
    SELECT ${nome}, ${usuario}, ${senhaHash} WHERE NOT EXISTS (SELECT 1 FROM administradores)
    RETURNING id`)
  const linhas = Array.from(r as unknown as { id: number }[])
  if (!linhas.length) redirect('/entrar')
  await db.insert(s.configuracao).values({ id: 1, nomeEmpresa: empresa }).onConflictDoUpdate({ target: s.configuracao.id, set: { nomeEmpresa: empresa } })
  await iniciarSessao({ tipo: 'admin', id: linhas[0].id, v: 1 })
  redirect(`/admin?ok=${encodeURIComponent('Bem-vindo! Comece cadastrando caminhões e motoristas.')}`)
}
