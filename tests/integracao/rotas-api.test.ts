import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { GET as saude } from '@/app/api/saude/route'
import { GET as verFoto } from '@/app/api/fotos/[id]/route'
import { GET as verDocumento } from '@/app/api/documentos/[id]/[arquivo]/route'
import { GET as exportar } from '@/app/api/admin/exportar/route'
import { GET as abrirLink } from '@/app/acesso/[token]/route'
import { hashToken, novoLink } from '@/lib/acesso'
import { sessaoAtual } from '@/lib/auth'
import { anexarPdf, importarArquivos } from '@/lib/documentos'
import { CTE, chave } from '../xml-exemplos'
import { arquivo, base, entrarComo, entrarComoAdmin, limpar } from './banco'

beforeEach(limpar)
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

const BYTES = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

/** Base + outro motorista com a própria viagem; cada viagem com um gasto com foto. */
async function doisMotoristas() {
  const b = await base()
  const [cam2] = await db.insert(s.caminhoes).values({ placa: 'XYZ9A99', descricao: 'Volvo' }).returning()
  const [mot2] = await db.insert(s.motoristas).values({ nome: 'Ana', telefone: '66900000002', pinHash: 'x', caminhaoId: cam2.id }).returning()
  const [v2] = await db
    .insert(s.viagens)
    .values({ motoristaId: mot2.id, caminhaoId: cam2.id, origem: 'A', destino: 'B', carga: 'C', frete: 1, comissaoPct: 10, inicio: '2026-10-10', kmInicial: 1 })
    .returning()
  const novaFoto = async (viagemId: number) => {
    const [f] = await db
      .insert(s.fotos)
      .values({ dados: Buffer.from(BYTES), mime: 'image/jpeg', tamanho: BYTES.length })
      .returning()
    await db.insert(s.despesas).values({ viagemId, tipo: 'Pedágio', valor: 100, data: '2026-10-11', fotoId: f.id })
    return f
  }
  return { ...b, mot2, v2, foto1: await novaFoto(b.v.id), foto2: await novaFoto(v2.id) }
}

describe('GET /api/saude', () => {
  it('responde ok com o banco no ar, sem cache e sem dados sensíveis', async () => {
    const r = await saude()
    expect(r.status).toBe(200)
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    const j = await r.json()
    expect(j).toEqual({ ok: true, banco: 'ok', ms: expect.any(Number), versao: 'local' })
  })

  it('mostra os 7 primeiros caracteres do commit quando a Vercel informa', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef1234567890')
    expect((await (await saude()).json()).versao).toBe('abcdef1')
  })

  it('banco fora do ar: 503 sem detalhes do erro', async () => {
    vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('senha do banco: xyz'))
    const r = await saude()
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ ok: false, banco: 'erro' })
  })
})

describe('GET /api/fotos/[id]', () => {
  const pedir = (id: string) => verFoto(new Request(`http://localhost/api/fotos/${id}`), { params: Promise.resolve({ id }) })

  it('sem sessão: 401; id fora do formato: 404 sem nem consultar sessão', async () => {
    const { foto1 } = await doisMotoristas()
    expect((await pedir(foto1.id)).status).toBe(401)
    expect((await pedir('../../etc/passwd')).status).toBe(404)
  })

  it('motorista vê a foto das próprias viagens, com cabeçalhos seguros', async () => {
    const { mot, foto1 } = await doisMotoristas()
    await entrarComo(mot)
    const r = await pedir(foto1.id)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('image/jpeg')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(r.headers.get('Cache-Control')).toContain('private')
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual(BYTES)
  })

  it('motorista NÃO vê foto de outro motorista nem PDF de documento (404, como se não existisse)', async () => {
    const { mot, foto2 } = await doisMotoristas()
    await entrarComo(mot)
    expect((await pedir(foto2.id)).status).toBe(404)
    const [solta] = await db.insert(s.fotos).values({ dados: PDF, mime: 'application/pdf', tamanho: PDF.length }).returning()
    expect((await pedir(solta.id)).status).toBe(404)
  })

  it('motorista desconectado (versão da sessão trocada) recebe 401', async () => {
    const { mot, foto1 } = await doisMotoristas()
    await entrarComo(mot)
    await db.update(s.motoristas).set({ versaoSessao: 9 }).where(eq(s.motoristas.id, mot.id))
    expect((await pedir(foto1.id)).status).toBe(401)
  })

  it('escritório vê a foto de qualquer motorista; id inexistente ou foto sem conteúdo dá 404', async () => {
    const { foto1, foto2 } = await doisMotoristas()
    await entrarComoAdmin()
    expect((await pedir(foto1.id)).status).toBe(200)
    expect((await pedir(foto2.id)).status).toBe(200)
    expect((await pedir('00000000-0000-0000-0000-000000000000')).status).toBe(404)
    const [vazia] = await db.insert(s.fotos).values({ mime: 'image/jpeg', tamanho: 0 }).returning()
    expect((await pedir(vazia.id)).status).toBe(404)
  })
})

describe('GET /api/documentos/[id]/[arquivo]', () => {
  const pedir = (id: number | string, arq: string) =>
    verDocumento(new Request(`http://localhost/api/documentos/${id}/${arq}`), { params: Promise.resolve({ id: String(id), arquivo: arq }) })

  /** CT-e ligado à viagem do motorista da base, com PDF anexado; e outro CT-e na viagem do segundo motorista. */
  async function cenario() {
    const b = await doisMotoristas()
    const c1 = chave('57', 1234)
    const c2 = chave('57', 5678)
    await importarArquivos([arquivo('c1.xml', CTE(c1)), arquivo('c2.xml', CTE(c2))], null, 'admin:1')
    const [d1] = await db.select().from(s.documentos).where(eq(s.documentos.chave, c1))
    const [d2] = await db.select().from(s.documentos).where(eq(s.documentos.chave, c2))
    await db.update(s.documentos).set({ viagemId: b.v.id }).where(eq(s.documentos.id, d1.id))
    await db.update(s.documentos).set({ viagemId: b.v2.id }).where(eq(s.documentos.id, d2.id))
    await anexarPdf('1.pdf', PDF, d1.id, 'admin:1')
    await anexarPdf('2.pdf', PDF, d2.id, 'admin:1')
    return { ...b, d1, d2 }
  }

  it('documento inexistente ou arquivo desconhecido: 404; sem sessão: 401', async () => {
    const { d1 } = await cenario()
    expect((await pedir(9999, 'pdf')).status).toBe(404)
    expect((await pedir('abc', 'pdf')).status).toBe(404)
    expect((await pedir(d1.id, 'json')).status).toBe(404)
    expect((await pedir(d1.id, 'pdf')).status).toBe(401)
  })

  it('motorista baixa o PDF da própria viagem', async () => {
    const { mot, d1 } = await cenario()
    await entrarComo(mot)
    const r = await pedir(d1.id, 'pdf')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe(`inline; filename="CTe-1234-${d1.chave}.pdf"`)
    expect(
      Buffer.from(await r.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-')
  })

  it('motorista não baixa PDF de outra viagem nem de documento sem viagem, e nunca o XML', async () => {
    const { mot, d1, d2 } = await cenario()
    await entrarComo(mot)
    expect((await pedir(d2.id, 'pdf')).status).toBe(404)
    expect((await pedir(d1.id, 'xml')).status).toBe(401)
    await db.update(s.documentos).set({ viagemId: null }).where(eq(s.documentos.id, d1.id))
    expect((await pedir(d1.id, 'pdf')).status).toBe(404)
  })

  it('escritório baixa XML (como anexo) e PDF de qualquer documento; sem PDF anexado dá 404', async () => {
    const { d1, d2 } = await cenario()
    await entrarComoAdmin()
    const x = await pedir(d2.id, 'xml')
    expect(x.status).toBe(200)
    expect(x.headers.get('Content-Disposition')).toBe(`attachment; filename="CTe-1234-${d2.chave}.xml"`)
    expect(x.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await x.text()).toContain(`<chCTe>${d2.chave}</chCTe>`)
    expect((await pedir(d1.id, 'pdf')).status).toBe(200)
    await db.update(s.documentos).set({ pdfId: null }).where(eq(s.documentos.id, d1.id))
    expect((await pedir(d1.id, 'pdf')).status).toBe(404)
  })
})

describe('GET /api/admin/exportar (CSV)', () => {
  const baixar = (q = '') => exportar(new Request(`http://localhost/api/admin/exportar${q}`))
  const linhas = async (r: Response) => (await r.text()).replace(/^﻿/, '').split('\r\n')

  it('sem sessão de escritório: 401 (também para motorista logado)', async () => {
    const { mot } = await base()
    expect((await baixar()).status).toBe(401)
    await entrarComo(mot)
    expect((await baixar('?tipo=despesas')).status).toBe(401)
  })

  it('viagens: CSV brasileiro com BOM, ponto e vírgula, vírgula decimal e nome de arquivo com o mês', async () => {
    const { v } = await base()
    await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000, adiantamento: 50050 }).where(eq(s.viagens.id, v.id))
    await entrarComoAdmin()
    const r = await baixar('?tipo=viagens&mes=2026-10')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="fg-viagens-2026-10.csv"')
    // BOM (EF BB BF) para o Excel abrir em UTF-8; o .text() do Response o remove ao decodificar.
    expect([...new Uint8Array(await r.clone().arrayBuffer()).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const [cab, l1, ...resto] = await linhas(r)
    expect(cab.split(';')[0]).toBe('Nº')
    expect(resto).toEqual([])
    const c = l1.split(';')
    expect(c.slice(0, 9)).toEqual([String(v.id), 'Valdir Teste', 'RKT4E21', 'Rondonópolis/MT', 'Santos/SP', 'Soja', '2026-10-10', '2026-10-12', 'Encerrada'])
    expect(c[15]).toBe('13800') // frete em reais
    expect(c[21]).toBe('500,5') // adiantamento com vírgula decimal
  })

  it('neutraliza fórmulas (= + - @) em texto digitado e põe entre aspas o que tem ; ou "', async () => {
    const { v } = await base()
    await db.update(s.viagens).set({ origem: '=HYPERLINK("http://golpe.example","clique")', destino: '+55 66', carga: '-2+3' }).where(eq(s.viagens.id, v.id))
    await db.insert(s.despesas).values([
      { viagemId: v.id, tipo: 'Outros', valor: 1000, data: '2026-10-11', obs: '@SUM(A1:A9)' },
      { viagemId: v.id, tipo: 'Diesel', valor: 2000, litros: 10.5, data: '2026-10-11', obs: 'nota; "fiscal"', pagoPor: 'motorista' },
    ])
    await entrarComoAdmin()
    const [, l1] = await linhas(await baixar('?tipo=viagens'))
    expect(l1).toContain(`;"'=HYPERLINK(""http://golpe.example"",""clique"")";'+55 66;'-2+3;`)
    expect(l1).not.toMatch(/;=/)
    const [cabD, d1, d2] = await linhas(await baixar('?tipo=despesas'))
    expect(cabD).toContain('Quem pagou')
    expect(d1).toContain(";Outros;10;;Empresa;pendente;'@SUM(A1:A9);não")
    expect(d2).toContain(';Combustível;20;10,5;Motorista;pendente;"nota; ""fiscal""";não')
  })

  it('números negativos continuam números (não ganham apóstrofo)', async () => {
    const { v } = await base()
    await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000, frete: 0 }).where(eq(s.viagens.id, v.id))
    await db.insert(s.despesas).values({ viagemId: v.id, tipo: 'Pedágio', valor: 5000, data: '2026-10-11', status: 'aprovada' })
    await entrarComoAdmin()
    const [, l1] = await linhas(await baixar('?tipo=viagens'))
    const lucro = l1.split(';').at(-1)!
    expect(lucro).toMatch(/^-\d/)
  })

  it('acerto: uma linha por motorista com viagem encerrada no mês', async () => {
    const { v, mot } = await base()
    await db.update(s.viagens).set({ status: 'encerrada', fim: '2026-10-12', kmFinal: 101000 }).where(eq(s.viagens.id, v.id))
    await db.insert(s.motoristas).values({ nome: 'Sem viagem', telefone: '66900000004', pinHash: 'x' })
    await entrarComoAdmin()
    const ls = await linhas(await baixar('?tipo=acerto&mes=2026-10'))
    expect(ls).toHaveLength(2)
    expect(ls[1].split(';').slice(0, 4)).toEqual(['2026-10', mot.nome, '1', '1656']) // 12% de R$ 13.800
    expect(await linhas(await baixar('?tipo=acerto&mes=2026-09'))).toHaveLength(1)
  })

  it('manutenções filtradas pelo mês e documentos com a chave protegida contra notação científica', async () => {
    const { cam } = await base()
    await db.insert(s.manutencoes).values([
      { caminhaoId: cam.id, data: '2026-10-02', tipo: 'Corretiva', descricao: '=cmd', valor: 85050, imprevisto: true },
      { caminhaoId: cam.id, data: '2026-09-02', tipo: 'Preventiva', descricao: 'óleo', valor: 1 },
    ])
    const c = chave('57', 1234)
    await importarArquivos([arquivo('c.xml', CTE(c))], null, 'admin:1')
    await entrarComoAdmin()
    const ms = await linhas(await baixar('?tipo=manutencoes&mes=2026-10'))
    expect(ms).toEqual(['Data;Caminhão;Tipo;Descrição;Valor (R$);Imprevisto', "2026-10-02;RKT4E21;Corretiva;'=cmd;850,5;sim"])
    expect(await linhas(await baixar('?tipo=manutencoes'))).toHaveLength(3)
    const ds = await linhas(await baixar('?tipo=documentos&mes=2026-10'))
    expect(ds).toHaveLength(2)
    expect(ds[1].split(';').slice(0, 6)).toEqual(['CT-e', '1234', '1', `​${c}`, '2026-10-10', 'autorizado'])
    expect(await linhas(await baixar('?tipo=documentos&mes=2026-09'))).toHaveLength(1)
  })

  it('tipo inválido: 400; mês inválido é ignorado (exporta tudo)', async () => {
    await base()
    await entrarComoAdmin()
    expect((await baixar('?tipo=senhas')).status).toBe(400)
    const r = await baixar('?tipo=viagens&mes=2026-13')
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="fg-viagens-tudo.csv"')
    expect(await linhas(r)).toHaveLength(2)
  })
})

describe('link de acesso pelo WhatsApp (/acesso/[token])', () => {
  const abrir = (token: string) => abrirLink(new Request(`http://localhost:3000/acesso/${token}`), { params: Promise.resolve({ token }) })
  const tokenDe = (link: string) => link.split('/').at(-1)!

  it('novoLink guarda só o hash do token, vale 7 dias e invalida o link anterior', async () => {
    const { mot } = await base()
    const antes = Date.now()
    const t1 = tokenDe(await novoLink(mot.id))
    const t2 = tokenDe(await novoLink(mot.id))
    expect(t1).not.toBe(t2)
    const ls = await db.select().from(s.linksAcesso)
    expect(ls).toHaveLength(1)
    expect(ls[0].tokenHash).toBe(hashToken(t2))
    expect(ls[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
    const dias = (ls[0].expiraEm.getTime() - antes) / 864e5
    expect(dias).toBeGreaterThan(6.99)
    expect(dias).toBeLessThan(7.01)
    expect((await abrir(t1)).headers.get('location')).toBe('http://localhost:3000/entrar?link=expirado')
  })

  it('usa APP_URL (sem barra final) ou o domínio de produção da Vercel', async () => {
    const { mot } = await base()
    vi.stubEnv('APP_URL', 'https://fg.example.com/')
    expect(await novoLink(mot.id)).toMatch(/^https:\/\/fg\.example\.com\/acesso\/[\w-]+$/)
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'fg.vercel.app')
    expect(await novoLink(mot.id)).toMatch(/^https:\/\/fg\.vercel\.app\/acesso\//)
  })

  it('link válido: entra como o motorista, marca o uso e manda para as boas-vindas sem cache', async () => {
    const { mot } = await base()
    const token = tokenDe(await novoLink(mot.id))
    const r = await abrir(token)
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('http://localhost:3000/m/bem-vindo')
    expect(r.headers.get('Cache-Control')).toBe('no-store')
    expect(await sessaoAtual()).toMatchObject({ tipo: 'motorista', id: mot.id, v: mot.versaoSessao })
    const [l] = await db.select().from(s.linksAcesso)
    expect(l.usadoEm).toBeInstanceOf(Date)
  })

  it('link vencido, inventado ou de motorista inativo não entra', async () => {
    const { mot } = await base()
    const token = tokenDe(await novoLink(mot.id))
    expect((await abrir('inventado123')).headers.get('location')).toBe('http://localhost:3000/entrar?link=expirado')
    await db.update(s.motoristas).set({ ativo: false }).where(eq(s.motoristas.id, mot.id))
    expect((await abrir(token)).headers.get('location')).toBe('http://localhost:3000/entrar?link=expirado')
    await db.update(s.motoristas).set({ ativo: true }).where(eq(s.motoristas.id, mot.id))
    await db.update(s.linksAcesso).set({ expiraEm: new Date(Date.now() - 1000) })
    expect((await abrir(token)).headers.get('location')).toBe('http://localhost:3000/entrar?link=expirado')
    expect(await sessaoAtual()).toBeNull()
  })

  it('desconectar o motorista no escritório derruba a sessão aberta pelo link', async () => {
    const { mot } = await base()
    await abrir(tokenDe(await novoLink(mot.id)))
    await db
      .update(s.motoristas)
      .set({ versaoSessao: mot.versaoSessao + 1 })
      .where(eq(s.motoristas.id, mot.id))
    const { motoristaDaApi } = await import('@/lib/auth')
    expect(await motoristaDaApi()).toBeNull()
  })
})
