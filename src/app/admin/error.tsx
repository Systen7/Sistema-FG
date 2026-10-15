'use client'
import { TelaErro } from '@/components/tela-erro'

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <TelaErro error={error} reset={reset} voltar="/admin" />
}
