'use client'
import { useState } from 'react'

/** Imagem que só carrega quando chega perto da tela e aparece com um esmaecer suave (sem "pular" no lugar). */
export function Foto({ src, alt = '', className = '', ...resto }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [ok, setOk] = useState(false)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...resto} src={src} alt={alt} loading="lazy" decoding="async"
      className={`${className} img-carrega${ok ? ' ok' : ''}`}
      onLoad={() => setOk(true)} onError={() => setOk(true)}
      ref={(el) => { if (el?.complete && el.naturalWidth) setOk(true) }}
    />
  )
}
