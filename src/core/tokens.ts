/** Intervalo de origem em offsets absolutos de caractere: `[início, fim)`. */
export type Span = readonly [start: number, end: number]

export type TokenKind =
  | 'comment'
  | 'newline'
  | 'whitespace'
  | 'ident'
  | 'number'
  | 'caret'
  | 'hash'
  | 'at'
  | 'arrow'
  | 'quote'
  | 'apostrophe'
  | 'colon'
  | 'semicolon'
  | 'comma'
  | 'equals'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'dot'
  | 'op'
  | 'unknown'

export interface Token {
  readonly kind: TokenKind
  readonly start: number
  readonly end: number
  readonly text: string
}

/** Tokens que não carregam significado sintático e podem ser pulados. */
export function isTrivia(token: Token): boolean {
  return (
    token.kind === 'whitespace' ||
    token.kind === 'comment' ||
    token.kind === 'newline'
  )
}

export function spanOf(from: Token, to: Token = from): Span {
  return [from.start, to.end]
}

export function sliceSpan(text: string, span: Span): string {
  return text.slice(span[0], span[1])
}
