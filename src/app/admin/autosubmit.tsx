'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Comportamentos da área do escritório: selects com data-autosubmit enviam o filtro; linhas com data-href abrem o item. */
export function AutoSubmit() {
  const router = useRouter()
  useEffect(() => {
    const mudou = (e: Event) => {
      const t = e.target as HTMLSelectElement
      if (t.matches?.('[data-autosubmit]')) t.form?.requestSubmit()
    }
    const clicou = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('a,button,input,select,summary,form')) return
      const tr = t.closest<HTMLElement>('[data-href]')
      if (tr) router.push(tr.dataset.href!)
    }
    document.addEventListener('change', mudou)
    document.addEventListener('click', clicou)
    return () => { document.removeEventListener('change', mudou); document.removeEventListener('click', clicou) }
  }, [router])
  return null
}
