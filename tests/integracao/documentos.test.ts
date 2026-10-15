import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, schema as s } from '@/db'
import { anexarPdf, documentosDasViagens, importarArquivos, ligarDocumento } from '@/lib/documentos'
import { CTE, ENCERRAMENTO, MDFE, chave } from '../xml-exemplos'
import { arquivo, base, limpar } from './banco'

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
const cte = chave('57', 1234)
const mdfe = chave('58', 77)

beforeEach(limpar)

describe('importação de CT-e e MDF-e no banco', () => {
  it('liga o MDF-e à viagem pela placa e data, e leva junto o CT-e citado', async () => {
    const { v } = await base()
    const r = await importarArquivos([arquivo('cte.xml', CTE(cte)), arquivo('mdfe.xml', MDFE(mdfe, cte))], null, 'admin:1')
    expect(r.map((x) => x.ok)).toEqual([true, true])
    expect(r[0].mensagem).toBe('CT-e nº 1234 importado, sem viagem: ligue manualmente.')
    expect(r[1].mensagem).toBe(`MDF-e nº 77 importado, ligado à viagem ${v.id}.`)
    const docs = await documentosDasViagens([v.id])
    expect(docs.map((d) => [d.tipo, d.numero, d.situacao])).toEqual([
      ['cte', 1234, 'autorizado'],
      ['mdfe', 77, 'autorizado'],
    ])
    const [auditoria] = await db.select().from(s.auditoria).where(eq(s.auditoria.acao, 'importou')).limit(1)
    expect(auditoria.autor).toBe('admin:1')
  })

  it('CT-e importado depois do MDF-e entra na mesma viagem', async () => {
    const { v } = await base()
    await importarArquivos([arquivo('mdfe.xml', MDFE(mdfe, cte))], null, 'admin:1')
    const [r] = await importarArquivos([arquivo('cte.xml', CTE(cte))], null, 'admin:1')
    expect(r.mensagem).toContain(`ligado à viagem ${v.id}`)
  })

  it('MDF-e de outra placa ou fora das datas fica sem viagem', async () => {
    await base()
    const [r1] = await importarArquivos([arquivo('a.xml', MDFE(mdfe, cte, '2026-10-10', 'ABC-1D23'))], null, 'admin:1')
    expect(r1.mensagem).toContain('sem viagem')
    await limpar()
    await base({ inicio: '2026-10-20' })
    const [r2] = await importarArquivos([arquivo('b.xml', MDFE(mdfe, cte, '2026-10-10'))], null, 'admin:1')
    expect(r2.mensagem).toContain('sem viagem')
  })

  it('reimportar atualiza sem duplicar e não "desencerra" o MDF-e', async () => {
    await base()
    await importarArquivos([arquivo('m.xml', MDFE(mdfe, cte))], null, 'admin:1')
    const [enc] = await importarArquivos([arquivo('enc.xml', ENCERRAMENTO(mdfe))], null, 'admin:1')
    expect(enc).toMatchObject({ ok: true, mensagem: 'MDF-e nº 77 marcado como encerrado.' })
    const [deNovo] = await importarArquivos([arquivo('m.xml', MDFE(mdfe, cte))], null, 'admin:1')
    expect(deNovo.mensagem).toContain('atualizado')
    const todos = await db.select().from(s.documentos)
    expect(todos).toHaveLength(1)
    expect(todos[0].situacao).toBe('encerrado')
    expect(todos[0].encerradoEm).toBeInstanceOf(Date)
  })

  it('evento de documento que não está no sistema é recusado com orientação', async () => {
    const [r] = await importarArquivos([arquivo('enc.xml', ENCERRAMENTO(mdfe))], null, 'admin:1')
    expect(r.ok).toBe(false)
    expect(r.mensagem).toContain('Importe primeiro o XML do MDF-e')
  })

  it('escolher a viagem na importação vale mais que a ligação automática', async () => {
    const { v } = await base()
    const [cam2] = await db.insert(s.caminhoes).values({ placa: 'XYZ9A99', descricao: 'Volvo' }).returning()
    const [m2] = await db.insert(s.motoristas).values({ nome: 'Outro', telefone: '66900000002', pinHash: 'x', caminhaoId: cam2.id }).returning()
    const [v2] = await db
      .insert(s.viagens)
      .values({ motoristaId: m2.id, caminhaoId: cam2.id, origem: 'A', destino: 'B', carga: 'C', frete: 1, comissaoPct: 10, inicio: '2026-10-10', kmInicial: 1 })
      .returning()
    const [r] = await importarArquivos([arquivo('m.xml', MDFE(mdfe, cte))], v2.id, 'admin:1')
    expect(r.mensagem).toContain(`viagem ${v2.id}`)
    expect(r.mensagem).not.toContain(`viagem ${v.id},`)
  })

  it('PDF acha o documento pela chave no nome; sem chave ou sem XML, explica o que fazer', async () => {
    await base()
    await importarArquivos([arquivo('c.xml', CTE(cte))], null, 'admin:1')
    const [ok] = await importarArquivos([arquivo(`DACTE-${cte}.pdf`, PDF)], null, 'admin:1')
    expect(ok).toMatchObject({ ok: true, mensagem: 'PDF anexado ao CT-e nº 1234.' })
    const [d] = await db.select().from(s.documentos)
    expect(d.pdfId).toBeTruthy()
    const [foto] = await db.select().from(s.fotos).where(eq(s.fotos.id, d.pdfId!))
    expect(foto.mime).toBe('application/pdf')

    expect((await anexarPdf('sem-chave.pdf', PDF, null, 'admin:1')).mensagem).toContain('Não achei a chave')
    expect((await anexarPdf(`x-${mdfe}.pdf`, PDF, null, 'admin:1')).mensagem).toContain('Importe primeiro o XML')
    expect((await anexarPdf('falso.pdf', Buffer.from('oi'), null, 'admin:1')).mensagem).toBe('O arquivo não é um PDF.')
  })

  it('trocar o PDF apaga o arquivo antigo', async () => {
    await base()
    await importarArquivos([arquivo('c.xml', CTE(cte))], null, 'admin:1')
    const [d] = await db.select().from(s.documentos)
    await anexarPdf('1.pdf', PDF, d.id, 'admin:1')
    await anexarPdf('2.pdf', PDF, d.id, 'admin:1')
    expect(await db.select().from(s.fotos)).toHaveLength(1)
  })

  it('tipo de arquivo errado e XML de NF-e recebem mensagem clara', async () => {
    const r = await importarArquivos([arquivo('foto.jpg', 'x', 'image/jpeg'), arquivo('nota.xml', '<nfeProc><NFe/></nfeProc>')], null, 'admin:1')
    expect(r.every((x) => !x.ok)).toBe(true)
    expect(r[0].mensagem).toContain('Envie arquivos .xml')
    expect(r[1].mensagem).toContain('NF-e')
  })

  it('ligar o MDF-e manualmente leva os CT-e soltos dele', async () => {
    const { v } = await base({ placa: 'OUT1R00' })
    await importarArquivos([arquivo('c.xml', CTE(cte)), arquivo('m.xml', MDFE(mdfe, cte))], null, 'admin:1')
    const [m] = await db.select().from(s.documentos).where(eq(s.documentos.tipo, 'mdfe'))
    await ligarDocumento(m.id, v.id)
    expect((await documentosDasViagens([v.id])).map((d) => d.tipo)).toEqual(['cte', 'mdfe'])
    await ligarDocumento(m.id, null)
    expect((await documentosDasViagens([v.id])).map((d) => d.tipo)).toEqual(['cte'])
  })
})
