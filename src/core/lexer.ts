import type { Token, TokenKind } from './tokens.ts'

const SINGLE_CHAR: Record<string, TokenKind> = {
  '^': 'caret',
  '#': 'hash',
  '@': 'at',
  '"': 'quote',
  "'": 'apostrophe',
  ':': 'colon',
  ';': 'semicolon',
  ',': 'comma',
  '=': 'equals',
  '(': 'lparen',
  ')': 'rparen',
  '[': 'lbracket',
  ']': 'rbracket',
  '.': 'dot',
  '+': 'op',
  '*': 'op',
  '/': 'op',
  '<': 'op',
  '>': 'op',
  '!': 'op',
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}

function isIdentStart(c: string): boolean {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c === '_'
}

function isIdentPart(c: string): boolean {
  return isIdentStart(c) || isDigit(c)
}

/**
 * Tokeniza MedState Notation preservando tudo: espaços, comentários e quebras de
 * linha viram tokens próprios. A concatenação de `token.text` reproduz a entrada
 * byte a byte — propriedade verificada em `lexer.test.ts`.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  const push = (kind: TokenKind, start: number, end: number) => {
    tokens.push({ kind, start, end, text: text.slice(start, end) })
  }

  while (i < text.length) {
    const start = i
    const c = text[i]!

    // Comentário: barra invertida até o fim da linha (sem incluir a quebra).
    if (c === '\\') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++
      push('comment', start, i)
      continue
    }

    if (c === '\n') {
      i++
      push('newline', start, i)
      continue
    }

    // CRLF vira um único token de quebra, para que CRLF sobreviva ao round-trip.
    if (c === '\r') {
      i++
      if (text[i] === '\n') i++
      push('newline', start, i)
      continue
    }

    if (c === ' ' || c === '\t') {
      while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++
      push('whitespace', start, i)
      continue
    }

    if (isDigit(c)) {
      while (i < text.length && isDigit(text[i]!)) i++
      // Só consome o ponto se houver dígito depois — `S.S.1` não é número.
      if (text[i] === '.' && isDigit(text[i + 1] ?? '')) {
        i++
        while (i < text.length && isDigit(text[i]!)) i++
      }
      push('number', start, i)
      continue
    }

    if (isIdentStart(c)) {
      while (i < text.length && isIdentPart(text[i]!)) i++
      push('ident', start, i)
      continue
    }

    // `--->` (qualquer número de hifens seguido de `>`) contra o menos aritmético.
    if (c === '-') {
      let j = i
      while (text[j] === '-') j++
      if (text[j] === '>') {
        i = j + 1
        push('arrow', start, i)
      } else {
        i++
        push('op', start, i)
      }
      continue
    }

    // Operadores relacionais de dois caracteres: `<=`, `>=`, `<>`.
    const next = text[i + 1]
    if (
      (c === '<' && (next === '=' || next === '>')) ||
      (c === '>' && next === '=')
    ) {
      i += 2
      push('op', start, i)
      continue
    }

    const single = SINGLE_CHAR[c]
    if (single) {
      i++
      push(single, start, i)
      continue
    }

    i++
    push('unknown', start, i)
  }

  return tokens
}
