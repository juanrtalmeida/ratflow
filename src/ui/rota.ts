import { useEffect, useState } from 'react'

/**
 * Roteamento por hash (`#/manual`), sem biblioteca.
 *
 * Hash e não History API porque o app é estático e roda offline: `/manual` só
 * funcionaria com um servidor configurado para devolver o `index.html` em
 * qualquer caminho, e o RatFlow precisa abrir de uma pasta, de um pendrive ou
 * de qualquer hospedagem simples. O hash dá o que uma rota tem que dar — URL
 * própria, botão voltar do navegador, recarregar sem perder o lugar — sem nada
 * disso.
 */

export type Rota = 'editor' | 'manual'

function rotaAtual(): Rota {
  return window.location.hash.replace(/^#\/?/, '') === 'manual' ? 'manual' : 'editor'
}

export function useRota(): Rota {
  const [rota, setRota] = useState(rotaAtual)

  useEffect(() => {
    const aoTrocar = () => setRota(rotaAtual())
    window.addEventListener('hashchange', aoTrocar)
    return () => window.removeEventListener('hashchange', aoTrocar)
  }, [])

  return rota
}

/** Navega — entra no histórico, então o botão voltar desfaz. */
export function irPara(rota: Rota): void {
  window.location.hash = rota === 'editor' ? '' : `#/${rota}`
}
