import { hoverTooltip, type Tooltip } from '@codemirror/view'
import { tokenize } from '../core/lexer.ts'
import { isTrivia, type Token } from '../core/tokens.ts'
import { ajudaPalavra, ajudaSimbolo } from './command-help.ts'

/** Acha o índice do token cujo intervalo `[start, end)` contém `pos`. */
function tokenAt(tokens: readonly Token[], pos: number): number {
  return tokens.findIndex((t) => pos >= t.start && pos < t.end)
}

function precedidoPorHash(tokens: readonly Token[], index: number): boolean {
  let j = index - 1
  while (j >= 0 && isTrivia(tokens[j]!)) j--
  return tokens[j]?.kind === 'hash'
}

/**
 * Popover ao passar o mouse sobre um comando ou símbolo reconhecido —
 * reaproveita `core/lexer.ts` (mesmo princípio do realce de sintaxe): nunca
 * diverge do que o parser realmente vê, porque tokeniza com a mesma função.
 */
export function medstateHover() {
  return hoverTooltip((view, pos): Tooltip | null => {
    const tokens = tokenize(view.state.doc.toString())
    const index = tokenAt(tokens, pos)
    if (index === -1) return null
    const token = tokens[index]!

    const ajuda =
      token.kind === 'ident'
        ? ajudaPalavra(token.text, precedidoPorHash(tokens, index))
        : ajudaSimbolo(token.kind)
    if (!ajuda) return null

    return {
      pos: token.start,
      end: token.end,
      above: true,
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'cm-medstate-tooltip'
        const titulo = document.createElement('strong')
        titulo.textContent = ajuda.titulo
        const texto = document.createElement('p')
        texto.textContent = ajuda.texto
        dom.append(titulo, texto)
        return { dom }
      },
    }
  })
}
