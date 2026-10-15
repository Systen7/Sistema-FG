import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminDaApi } from '@/lib/auth'
import { importarArquivos } from '@/lib/documentos'

// Importação de XML/PDF fiscais. É uma rota (e não uma ação de formulário) para o navegador poder
// mostrar a porcentagem do envio enquanto os arquivos sobem.
export async function POST(req: Request) {
  const a = await adminDaApi()
  if (!a) return NextResponse.json({ erro: 'Sessão expirada. Entre de novo.' }, { status: 401 })
  const f = await req.formData()
  const arquivos = f.getAll('arquivos').filter((x): x is File => x instanceof File && x.size > 0)
  if (!arquivos.length) return NextResponse.json({ erro: 'Escolha um ou mais arquivos XML ou PDF.' }, { status: 400 })
  if (arquivos.length > 50) return NextResponse.json({ erro: 'Envie no máximo 50 arquivos por vez.' }, { status: 400 })
  const viagemId = Number(f.get('viagemId')) || null
  const resultados = await importarArquivos(arquivos, viagemId, 'admin:' + a.id)
  revalidatePath('/admin', 'layout')
  revalidatePath('/m', 'layout')
  return NextResponse.json({ resultados })
}
