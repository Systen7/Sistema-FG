import { test, expect, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'

// Fluxo completo: escritório envia o link, motorista entra, inicia viagem, lança gastos (um sem sinal), encerra; escritório aprova e vê o acerto.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')

test.beforeAll(() => { execSync('npx tsx scripts/seed.ts --limpar', { stdio: 'inherit' }) })

async function digitar(p: Page, rotulo: string, digitos: string) {
  const i = p.getByLabel(rotulo)
  await i.click()
  await i.pressSequentially(digitos)
}

test('fluxo completo motorista + escritório', async ({ browser }) => {
  const adm = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage()
  await adm.goto('/entrar')
  await adm.getByRole('button', { name: 'Escritório' }).click()
  await adm.fill('input[name=usuario]', 'admin')
  await adm.fill('input[name=senha]', 'fg2026')
  await adm.getByRole('button', { name: 'Entrar' }).click()
  await adm.waitForURL('**/admin')

  // link de acesso do Valdir
  await adm.goto('/admin/motoristas?acesso=1')
  await adm.getByRole('button', { name: 'Gerar link de acesso' }).click()
  const link = await adm.getByLabel('Link de acesso').inputValue()
  expect(link).toContain('/acesso/')
  await expect(adm.getByRole('link', { name: 'Enviar pelo WhatsApp' })).toHaveAttribute('href', /wa\.me\/5566900000001/)

  // motorista abre o link no celular
  const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mot = await ctxM.newPage()
  await mot.goto(new URL(link).pathname)
  await expect(mot.getByRole('heading', { name: 'Bem-vindo, Valdir' })).toBeVisible()
  await mot.getByRole('link', { name: 'Começar' }).click()
  await expect(mot.getByRole('heading', { name: 'Nenhuma viagem em andamento' })).toBeVisible()

  // iniciar viagem repetindo rota recente
  await mot.getByRole('link', { name: /Iniciar viagem/ }).click()
  await mot.getByRole('button', { name: /Rondonópolis → Santos/ }).click()
  await expect(mot.getByLabel('Carga', { exact: true })).toHaveValue('Soja 37 t')
  await digitar(mot, 'Valor do frete em reais', '1500000')
  await expect(mot.getByText('Sua comissão: R$ 1.500,00')).toBeVisible()
  const kmIni = Number(await mot.getByLabel('Km no painel do caminhão').inputValue())
  await mot.getByRole('button', { name: 'Iniciar viagem' }).click()
  await expect(mot.getByText('Viagem iniciada. Boa viagem!')).toBeVisible()
  await expect(mot.getByText('Rondonópolis/MT')).toBeVisible()

  // gasto de diesel com foto
  await mot.getByRole('link', { name: /Lançar gasto/ }).click()
  await mot.getByRole('button', { name: 'Combustível' }).click()
  await mot.getByLabel('Quantos litros?').fill('500')
  await digitar(mot, 'Valor em reais', '309500')
  await expect(mot.getByText('R$ 6,19')).toBeVisible()
  await mot.locator('input[type=file]').setInputFiles({ name: 'nota.png', mimeType: 'image/png', buffer: PNG })
  await expect(mot.getByText('Foto anexada')).toBeVisible()
  await mot.getByRole('button', { name: 'Enviar gasto' }).click()
  await expect(mot.getByRole('heading', { name: 'Gasto enviado' })).toBeVisible()

  // pedágio sem sinal: fica guardado e envia quando volta
  await mot.getByRole('button', { name: 'Lançar outro gasto' }).click()
  await ctxM.setOffline(true)
  await mot.getByRole('button', { name: 'Pedágio' }).click()
  await digitar(mot, 'Valor em reais', '12000')
  await mot.getByRole('button', { name: 'Enviar gasto' }).click()
  await expect(mot.getByRole('heading', { name: 'Guardado no celular' })).toBeVisible()
  await expect(mot.getByText(/Sem sinal/)).toBeVisible()
  await ctxM.setOffline(false)
  await expect(mot.getByText('1 gasto guardado foi enviado')).toBeVisible({ timeout: 15000 })

  // encerrar
  await mot.getByRole('link', { name: 'Voltar para a viagem' }).click()
  await expect(mot.getByText('Pedágio', { exact: true })).toBeVisible()
  await mot.getByRole('link', { name: /Encerrar viagem/ }).click()
  await mot.getByLabel('Km no painel agora').fill(String(kmIni + 1450))
  await mot.getByRole('button', { name: 'Não', exact: true }).click()
  await mot.getByRole('button', { name: 'Encerrar viagem' }).click()
  await expect(mot.getByRole('heading', { name: 'Confere os números?' })).toBeVisible()
  await mot.getByRole('button', { name: 'Confirmar' }).click()
  await mot.waitForURL('**/m/extrato**')
  await expect(mot.getByText('Viagem encerrada. Confira seu extrato.')).toBeVisible()

  // motorista não acessa o escritório
  await mot.goto('/admin')
  await expect(mot).toHaveURL(/\/m$/)
  await expect(mot.getByText('Administrador')).toHaveCount(0)

  // escritório aprova e confere
  await adm.goto('/admin/aprovacoes')
  await expect(adm.getByText('Combustível · R$ 3.095,00')).toBeVisible()
  await expect(adm.getByText('Pedágio · R$ 120,00')).toBeVisible()
  await adm.getByRole('button', { name: /Aprovar todas/ }).click()
  await expect(adm.getByText(/despesas aprovadas/)).toBeVisible()
  await adm.goto('/admin/viagens?motorista=1&status=encerrada')
  await adm.getByRole('link', { name: /Rondonópolis\/MT → Santos\/SP/ }).first().click()
  await expect(adm.getByRole('img', { name: 'Comprovante' })).toBeVisible()
  const res = await adm.request.get('/api/admin/exportar?tipo=despesas')
  expect(res.headers()['content-type']).toContain('text/csv')
  expect(await res.text()).toContain('Pedágio')
})
