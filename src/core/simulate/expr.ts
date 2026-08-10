import { tokenize } from '../lexer.ts'
import { isTrivia, type Token } from '../tokens.ts'

/**
 * Avaliador de expressões aritméticas para o simulador — não é um avaliador
 * geral da linguagem, é o que cobre o que apareceu nas fixtures reais:
 * `B(3) * A(3)`, `B(2) + .6`, `B(1)/6000`, `-987.987`, `D(B(17))` (índice
 * aninhado). `+ - * /`, parênteses de índice, e menos unário.
 *
 * Falha graciosamente: uma expressão fora desse subconjunto devolve `null`,
 * e quem chama decide o que fazer (registrar aviso, não travar a sessão).
 */

export interface Ref {
  readonly type: 'variable' | 'constant'
  readonly name: string
  /** Só relevante para `variable` — 0 quando não há índice (`A` sem `(...)`). */
  readonly index: number
}

export type Resolve = (ref: Ref) => number

export function evalExpression(text: string, resolve: Resolve): number | null {
  const sig = tokenize(text).filter((t) => !isTrivia(t))
  if (sig.length === 0) return null

  let pos = 0
  const peek = (): Token | undefined => sig[pos]
  const advance = (): Token | undefined => sig[pos++]
  const isOp = (t: Token | undefined, ...texts: string[]): boolean =>
    t?.kind === 'op' && texts.includes(t.text)

  function parseFactor(): number | null {
    const t = advance()
    if (!t) return null

    if (isOp(t, '-')) {
      const inner = parseFactor()
      return inner === null ? null : -inner
    }

    if (t.kind === 'number') return Number(t.text)

    // `.6` sem zero à esquerda: o léxico só junta o ponto a um número quando
    // já vinha consumindo dígitos antes dele (ver lexer.ts), então aqui o
    // ponto chega como token próprio, seguido do número.
    if (t.kind === 'dot' && peek()?.kind === 'number') {
      return Number(`0.${advance()!.text}`)
    }

    if (t.kind === 'caret') {
      const ident = advance()
      if (ident?.kind !== 'ident') return null
      return resolve({ type: 'constant', name: ident.text, index: 0 })
    }

    if (t.kind === 'ident') {
      let index = 0
      if (peek()?.kind === 'lparen') {
        advance()
        const idx = parseExpr()
        if (idx === null || peek()?.kind !== 'rparen') return null
        advance()
        index = Math.trunc(idx)
      }
      return resolve({ type: 'variable', name: t.text, index })
    }

    if (t.kind === 'lparen') {
      const inner = parseExpr()
      if (inner === null || peek()?.kind !== 'rparen') return null
      advance()
      return inner
    }

    return null
  }

  function parseTerm(): number | null {
    let left = parseFactor()
    if (left === null) return null
    while (isOp(peek(), '*', '/')) {
      const op = advance()!
      const right = parseFactor()
      if (right === null) return null
      left = op.text === '*' ? left * right : left / right
    }
    return left
  }

  function parseExpr(): number | null {
    let left = parseTerm()
    if (left === null) return null
    while (isOp(peek(), '+', '-')) {
      const op = advance()!
      const right = parseTerm()
      if (right === null) return null
      left = op.text === '+' ? left + right : left - right
    }
    return left
  }

  const result = parseExpr()
  return pos === sig.length ? result : null
}
