import type { DragEvent } from 'react'
import type { BlocoNovo } from '../graph/mutate.ts'

/**
 * O protocolo de arrasto entre a paleta e os canvases. A paleta escreve um
 * `BlocoArrastado` no `dataTransfer` e quem recebe decide o que fazer — nenhum
 * dos lados importa o outro.
 *
 * Fica fora de `Paleta.tsx` porque é dado e função pura: um arquivo que exporta
 * componentes e utilitários juntos quebra o hot reload do Vite.
 */

export const MIME_BLOCO = 'application/medpc-bloco'

/** Um estado do nível 1, ou um nó de regra do nível 2. */
export type BlocoArrastado = { readonly kind: 'estado'; readonly papel: string | null } | BlocoNovo

export function iniciarArrasto(e: DragEvent, bloco: BlocoArrastado): void {
  e.dataTransfer.setData(MIME_BLOCO, JSON.stringify(bloco))
  e.dataTransfer.effectAllowed = 'copy'
}

/**
 * Este arrasto é de um bloco nosso? Decidido por `types` e nunca pelo
 * conteúdo: durante o `dragover` o HTML5 esconde os dados do `dataTransfer`,
 * então `getData` devolve `''` e a checagem falharia — sem `preventDefault` o
 * `drop` nunca dispara, e o sintoma é "arrastar não faz nada".
 */
export function aceitaBloco(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(MIME_BLOCO)
}

/** Lê o bloco de um evento de `drop`. `null` quando não é um bloco nosso. */
export function blocoDoEvento(e: DragEvent): BlocoArrastado | null {
  const json = e.dataTransfer.getData(MIME_BLOCO)
  if (!json) return null
  try {
    return JSON.parse(json) as BlocoArrastado
  } catch {
    return null
  }
}

/**
 * Id da aresta sob o ponteiro, ou `null`. O `<g>` de cada aresta do React Flow
 * carrega `data-id`, e o `path.react-flow__edge-interaction` (20px de largura,
 * invisível) é o que o hit-test do navegador acerta — o mesmo caminho que faz
 * `onEdgeClick` funcionar, sem geometria própria nenhuma.
 */
export function fioNoPonteiro(e: DragEvent): string | null {
  const alvo = e.target as Element | null
  return alvo?.closest?.('.react-flow__edge')?.getAttribute('data-id') ?? null
}
