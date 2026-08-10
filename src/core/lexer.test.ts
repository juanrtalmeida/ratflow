import { describe, expect, it } from 'vitest'
import { tokenize } from './lexer.ts'
import { loadFixtures } from './__fixtures.ts'

const fixtures = loadFixtures()

describe('tokenize', () => {
  it.each(fixtures)('reconstrói $name byte a byte', ({ text }) => {
    const tokens = tokenize(text)
    expect(tokens.map((t) => t.text).join('')).toBe(text)
  })

  it.each(fixtures)('cobre $name com spans contíguos', ({ text }) => {
    const tokens = tokenize(text)
    let cursor = 0
    for (const token of tokens) {
      expect(token.start).toBe(cursor)
      expect(token.text).toBe(text.slice(token.start, token.end))
      cursor = token.end
    }
    expect(cursor).toBe(text.length)
  })

  it('trata CRLF como uma única quebra de linha', () => {
    const tokens = tokenize('^A = 1\r\n^B = 2\n')
    const newlines = tokens.filter((t) => t.kind === 'newline')
    expect(newlines.map((t) => t.text)).toEqual(['\r\n', '\n'])
  })

  it('separa `S.S.1` em identificadores e pontos, não em número decimal', () => {
    const kinds = tokenize('S.S.1,').map((t) => t.kind)
    expect(kinds).toEqual(['ident', 'dot', 'ident', 'dot', 'number', 'comma'])
  })

  it('distingue a seta do menos aritmético', () => {
    expect(tokenize('---> S2')[0]!.kind).toBe('arrow')
    expect(tokenize('A - 1')[2]!.kind).toBe('op')
  })

  it('lê o comentário até o fim da linha, sem engolir a quebra', () => {
    const tokens = tokenize('S1, \\@nome: Início\n')
    const comment = tokens.find((t) => t.kind === 'comment')
    expect(comment?.text).toBe('\\@nome: Início')
    expect(tokens[tokens.length - 1]!.kind).toBe('newline')
  })

  it('reconhece operadores relacionais de dois caracteres', () => {
    expect(tokenize('A >= 5').map((t) => t.text)).toContain('>=')
    expect(tokenize('A <> 5').map((t) => t.text)).toContain('<>')
    expect(tokenize('A <= 5').map((t) => t.text)).toContain('<=')
  })

  it('não quebra com entrada arbitrária', () => {
    const junk = '§¤ ]]] ^^^ ;;; ###\n\t\\\\ 12.5.7 --> ->'
    expect(tokenize(junk).map((t) => t.text).join('')).toBe(junk)
  })
})
