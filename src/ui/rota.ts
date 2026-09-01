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

export type Rota = 'editor' | 'manual' | 'linguagem' | 'glossario'

/** Toda rota que não é o editor. O editor é o que sobra. */
export type RotaGuia = Exclude<Rota, 'editor'>

export interface Guia {
  readonly rota: RotaGuia
  /** Rótulo curto: é o que cabe na aba de troca rápida. */
  readonly rotulo: string
  readonly icone: string
  /** Vai no `<h1>` e no título da aba do navegador. */
  readonly titulo: string
  /** Uma linha dizendo a que este guia responde — some a dúvida "é neste?". */
  readonly descricao: string
}

/**
 * Os três guias, em ordem de leitura. É esta lista que desenha as abas de
 * troca rápida, o rodapé "próximo guia" e os atalhos `1`–`3`: acrescentar um
 * guia aqui basta para ele aparecer nos três lugares.
 */
export const GUIAS: readonly Guia[] = [
  {
    rota: 'manual',
    rotulo: 'Manual',
    icone: '🧭',
    titulo: 'Manual do RatFlow',
    descricao: 'A ferramenta: o que existe na tela, como usar, atalhos e limites conhecidos.',
  },
  {
    rota: 'linguagem',
    rotulo: 'Linguagem',
    icone: '📐',
    titulo: 'A linguagem MED-PC',
    descricao: 'A linguagem: como um programa MedState roda, a sintaxe, os padrões e as armadilhas.',
  },
  {
    rota: 'glossario',
    rotulo: 'Glossário',
    icone: '📖',
    titulo: 'Glossário',
    descricao: 'O vocabulário: os mesmos termos que o balãozinho "?" mostra dentro do editor.',
  },
]

function rotaAtual(): Rota {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return GUIAS.some((g) => g.rota === hash) ? (hash as Rota) : 'editor'
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
