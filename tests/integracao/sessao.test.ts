import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { entrarMotorista } from '@/app/entrar/actions'
import { motoristaDaApi, sessaoAtual } from '@/lib/auth'
import { base, entrarComo, limpar } from './banco'

beforeEach(limpar)

/** O redirect() do Next interrompe a ação lançando um erro especial; aqui ele significa "entrou". */
async function tentar(tel: string, pin: string) {
  try {
    return await entrarMotorista(tel, pin)
  } catch (e) {
    if (String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) return 'entrou'
    throw e
  }
}

describe('login do motorista e sessão', () => {
  it('entra com celular e PIN certos e a sessão aponta para ele', async () => {
    const { mot } = await base()
    expect(await tentar('(66) 90000-0001', '1234')).toBe('entrou')
    expect(await sessaoAtual()).toMatchObject({ tipo: 'motorista', id: mot.id })
  })

  it('bloqueia por 15 minutos depois de 5 PINs errados, mesmo acertando depois', async () => {
    await base()
    const respostas = []
    for (let i = 0; i < 5; i++) respostas.push(await tentar('66900000001', '0000'))
    expect(respostas[0]).toMatchObject({ erro: 'Celular ou PIN não conferem.', restam: 4 })
    expect(respostas[4]).toMatchObject({ erro: 'Muitas tentativas erradas. Aguarde 15 min.' })
    expect(await tentar('66900000001', '1234')).toMatchObject({ erro: expect.stringContaining('Tente de novo em 15 min') })
  })

  it('acertar antes do limite zera as tentativas', async () => {
    await base()
    await tentar('66900000001', '0000')
    await tentar('66900000001', '1234')
    expect(await db.select().from(s.tentativasLogin)).toHaveLength(0)
  })

  it('motorista desativado não entra', async () => {
    const { mot } = await base()
    await db.update(s.motoristas).set({ ativo: false }).where(eq(s.motoristas.id, mot.id))
    expect(await tentar('66900000001', '1234')).toMatchObject({ erro: 'Celular ou PIN não conferem.' })
  })

  it('"desconectar" (versão da sessão) derruba o celular já conectado', async () => {
    const { mot } = await base()
    await entrarComo(mot)
    expect((await motoristaDaApi())?.id).toBe(mot.id)
    await db
      .update(s.motoristas)
      .set({ versaoSessao: mot.versaoSessao + 1 })
      .where(eq(s.motoristas.id, mot.id))
    expect(await motoristaDaApi()).toBeNull()
  })
})
