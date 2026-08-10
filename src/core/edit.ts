import type { Span } from './tokens.ts'

/** Substituição de um intervalo do arquivo. É a única forma de alterar texto. */
export interface TextEdit {
  readonly span: Span
  readonly newText: string
  /** Rótulo curto para o histórico de desfazer. */
  readonly label?: string
}

export class OverlappingEditsError extends Error {
  constructor(a: Span, b: Span) {
    super(
      `Edições sobrepostas: [${a[0]}, ${a[1]}) e [${b[0]}, ${b[1]}). ` +
        'Cada gesto deve tocar apenas o seu próprio intervalo.',
    )
    this.name = 'OverlappingEditsError'
  }
}

/**
 * Aplica edições a um texto. As edições podem vir em qualquer ordem; são
 * ordenadas e aplicadas de trás para frente, de modo que os offsets das
 * anteriores continuem válidos.
 *
 * Lança se duas edições se sobrepõem — sinal de que uma mutação está
 * ultrapassando o próprio span, exatamente o defeito que corromperia o arquivo.
 */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  if (edits.length === 0) return text

  for (const edit of edits) {
    const [start, end] = edit.span
    if (start < 0 || end > text.length || start > end) {
      throw new RangeError(
        `Edição fora do texto: [${start}, ${end}) em documento de ${text.length} caracteres.`,
      )
    }
  }

  const ordered = [...edits].sort(
    (a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1],
  )

  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]!.span
    const current = ordered[i]!.span
    const isOverlap = current[0] < previous[1]
    // Duas inserções puras no mesmo ponto não têm ordem definida.
    const ambiguousInsertions =
      current[0] === previous[0] &&
      current[0] === current[1] &&
      previous[0] === previous[1]
    if (isOverlap || ambiguousInsertions) {
      throw new OverlappingEditsError(previous, current)
    }
  }

  let result = text
  for (let i = ordered.length - 1; i >= 0; i--) {
    const { span, newText } = ordered[i]!
    result = result.slice(0, span[0]) + newText + result.slice(span[1])
  }
  return result
}

/** Desloca um offset para depois de aplicar as edições dadas. */
export function mapOffset(offset: number, edits: readonly TextEdit[]): number {
  let delta = 0
  for (const edit of edits) {
    if (edit.span[1] <= offset) {
      delta += edit.newText.length - (edit.span[1] - edit.span[0])
    }
  }
  return offset + delta
}
