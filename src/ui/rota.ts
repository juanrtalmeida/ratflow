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

export type Rota = 'editor' | 'manual' | 'linguagem' | 'estilo' | 'glossario'

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
 * Os guias, em ordem de leitura. É esta lista que desenha as abas de troca
 * rápida, o rodapé "próximo guia" e os atalhos numéricos: acrescentar um guia
 * aqui basta para ele aparecer nos três lugares — e a busca o indexa junto.
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
    rota: 'estilo',
    rotulo: 'Estilo',
    icone: '✍️',
    titulo: 'Estilo e estrutura',
    descricao:
      'A escrita: como nomear, organizar e comentar um `.MPC` que outra pessoa consiga ler e ajustar.',
  },
  {
    rota: 'glossario',
    rotulo: 'Glossário',
    icone: '📖',
    titulo: 'Glossário',
    descricao: 'O vocabulário: os mesmos termos que o balãozinho "?" mostra dentro do editor.',
  },
]

/**
 * Onde se está: a rota, a seção pedida e o termo a destacar —
 * `#/manual/atalhos/salvar`.
 */
export interface Local {
  readonly rota: Rota
  /** `id` da seção a mostrar. Ausente = comece do topo do guia. */
  readonly secao?: string
  /** Consulta de busca a destacar no texto. Ausente = nada em destaque. */
  readonly termo?: string
}

function localAtual(): Local {
  const [rota, secao, termo] = window.location.hash.replace(/^#\/?/, '').split('/')
  if (!GUIAS.some((g) => g.rota === rota)) return { rota: 'editor' }
  return {
    rota: rota as Rota,
    secao: secao || undefined,
    // Um termo com acento, espaço ou barra chega aqui percentual-codificado.
    termo: termo ? decodeURIComponent(termo) : undefined,
  }
}

export function useLocal(): Local {
  const [local, setLocal] = useState(localAtual)

  useEffect(() => {
    const aoTrocar = () => setLocal(localAtual())
    window.addEventListener('hashchange', aoTrocar)
    return () => window.removeEventListener('hashchange', aoTrocar)
  }, [])

  return local
}

/**
 * Navega — entra no histórico, então o botão voltar desfaz.
 *
 * A seção e o termo buscado vão na própria URL em vez de num estado à parte: o
 * link de um resultado de busca pode ser copiado, recarregado e favoritado, e
 * cai exatamente no mesmo parágrafo, com a palavra já destacada.
 */
export function irPara(rota: Rota, secao?: string, termo?: string): void {
  if (rota === 'editor') {
    window.location.hash = ''
    return
  }
  // O termo é o terceiro segmento: sem seção não há onde encaixá-lo, e
  // `#/manual/salvar` seria lido como um `id` de seção.
  const alvo = secao ? `/${secao}${termo ? `/${encodeURIComponent(termo)}` : ''}` : ''
  window.location.hash = `#/${rota}${alvo}`
}
