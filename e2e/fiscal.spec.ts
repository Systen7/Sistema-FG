import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { chave, CTE, MDFE, ENCERRAMENTO } from '../tests/xml-exemplos'

// CT-e e MDF-e: importar XML, criar a viagem pelo MDF-e, motorista ver a chave no celular, PDF, encerramento.
test.beforeAll(() => {
  execSync('npx tsx scripts/seed.ts --limpar', { stdio: 'inherit' })
})

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

test('documentos fiscais do XML até o celular do motorista', async ({ browser }) => {
  const ch = chave('57', 1234),
    mdfe = chave('58', 77)
  const adm = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage()
  await adm.goto('/entrar')
  await adm.getByRole('button', { name: 'Escritório' }).click()
  await adm.fill('input[name=usuario]', 'admin')
  await adm.fill('input[name=senha]', 'fg2026')
  await adm.getByRole('button', { name: 'Entrar' }).click()
  await adm.waitForURL('**/admin')

  // importa CT-e + MDF-e (placa do Valdir, emitido hoje) e um arquivo errado
  await adm.goto('/admin/documentos')
  await adm.locator('input[type=file][multiple]').setInputFiles([
    { name: `cte-${ch}.xml`, mimeType: 'application/xml', buffer: Buffer.from(CTE(ch, '', hoje)) },
    { name: `mdfe-${mdfe}.xml`, mimeType: 'application/xml', buffer: Buffer.from(MDFE(mdfe, ch, hoje, 'RKT-4E21')) },
    { name: 'nota.xml', mimeType: 'application/xml', buffer: Buffer.from('<nfeProc><NFe/></nfeProc>') },
  ])
  await expect(adm.getByText('CT-e nº 1234 importado')).toBeVisible()
  await expect(adm.getByText('MDF-e nº 77 importado')).toBeVisible()
  await expect(adm.getByText(/é de NF-e/)).toBeVisible()
  await expect(adm.getByRole('link', { name: /MDF-e abertos \(1\)/ })).toBeVisible()

  // cria a viagem pelo MDF-e: dados vêm do XML, motorista pelo caminhão da placa
  const linha = adm.locator('tr', { hasText: 'nº 77' })
  await linha.getByRole('link', { name: 'Viagem' }).click()
  await expect(adm.getByRole('heading', { name: 'Nova viagem pelo MDF-e nº 77' })).toBeVisible()
  await expect(adm.locator('input[name=origem]')).toHaveValue('Rondonópolis/MT')
  await expect(adm.locator('input[name=destino]')).toHaveValue('Santos/SP')
  await expect(adm.locator('input[name=carga]')).toHaveValue('Soja 37 t')
  await expect(adm.locator('input[name=frete]')).toHaveValue('13.800,00')
  await expect(adm.locator('select[name=motoristaId] option:checked')).toHaveText('Valdir Nogueira')
  await adm.getByRole('button', { name: 'Salvar' }).click()
  await adm.waitForURL(/\/admin\/viagens\/\d+/)
  const viagemUrl = new URL(adm.url()).pathname
  await expect(adm.getByText('nº 1234')).toBeVisible() // CT-e veio junto com o MDF-e
  await expect(adm.getByText('nº 77')).toBeVisible()

  // PDF pela chave no nome do arquivo
  await adm.locator('input[type=file][multiple]').setInputFiles({ name: `DAMDFE-${mdfe}.pdf`, mimeType: 'application/pdf', buffer: PDF })
  await expect(adm.getByText('PDF anexado ao MDF-e nº 77.')).toBeVisible()

  // motorista vê a chave e o PDF no celular
  const mot = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage()
  await mot.goto('/entrar')
  await mot.fill('input[type=tel]', '66900000001')
  await mot.getByRole('button', { name: 'Continuar' }).click()
  for (const d of '1111') await mot.getByRole('button', { name: d, exact: true }).click()
  await mot.waitForURL('**/m')
  await expect(mot.getByRole('heading', { name: 'Documentos da viagem' })).toBeVisible()
  await expect(mot.getByText(mdfe.replace(/(\d{4})(?=\d)/g, '$1 '))).toBeVisible()
  const pdfHref = await mot.getByRole('link', { name: 'Abrir PDF' }).getAttribute('href')
  const r = await mot.request.get(pdfHref!)
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toBe('application/pdf')
  // outro motorista não abre o PDF dessa viagem
  const outro = await (await browser.newContext()).newPage()
  await outro.goto('/entrar')
  await outro.fill('input[type=tel]', '64900000002')
  await outro.getByRole('button', { name: 'Continuar' }).click()
  for (const d of '2222') await outro.getByRole('button', { name: d, exact: true }).click()
  await outro.waitForURL('**/m')
  expect((await outro.request.get(pdfHref!)).status()).toBe(404)

  // evento de encerramento dá baixa no MDF-e
  await adm.goto(viagemUrl)
  await adm
    .locator('input[type=file][multiple]')
    .setInputFiles({ name: 'encerramento.xml', mimeType: 'application/xml', buffer: Buffer.from(ENCERRAMENTO(mdfe)) })
  await expect(adm.getByText('MDF-e nº 77 marcado como encerrado.')).toBeVisible()
  await adm.goto('/admin/documentos?ver=abertos')
  await expect(adm.getByText('Nenhum documento.')).toBeVisible()
  const csv = await (await adm.request.get('/api/admin/exportar?tipo=documentos')).text()
  expect(csv).toContain('encerrado')
})
