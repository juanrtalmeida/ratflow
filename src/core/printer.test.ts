import { describe, expect, it } from 'vitest'
import { parseProgram } from './parser.ts'
import { printStateHeader, printStatement } from './printer.ts'
import type { Statement } from './ast.ts'
import { loadFixtures } from './__fixtures.ts'

const fixtures = loadFixtures()

function statementsOf(text: string): Statement[] {
  return parseProgram(text)
    .stateSets.flatMap((s) => s.states)
    .flatMap((s) => s.statements)
}

/** Reanalisa um statement isolado, embrulhando-o num processo mínimo. */
function reparse(printed: string): Statement {
  const program = parseProgram(`S.S.1,\nS1,\n${printed}\n`)
  const statement = program.stateSets[0]?.states[0]?.statements[0]
  if (!statement) throw new Error(`não reanalisou:\n${printed}`)
  return statement
}

describe('printStatement', () => {
  it.each(fixtures)('$name: imprimir é idempotente após reanálise', ({ text }) => {
    const statements = statementsOf(text)
    expect(statements.length).toBeGreaterThan(0)

    for (const statement of statements) {
      const once = printStatement(statement)
      const twice = printStatement(reparse(once))
      expect(twice).toBe(once)
    }
  })

  it.each(fixtures)('$name: preserva gatilho, comandos e destinos', ({ text }) => {
    for (const statement of statementsOf(text)) {
      const round = reparse(printStatement(statement))

      expect(round.trigger.parsed).toEqual(
        statement.trigger.parsed
          ? expect.objectContaining({ kind: statement.trigger.parsed.kind })
          : null,
      )
      expect(round.segments.map((s) => s.label)).toEqual(
        statement.segments.map((s) => s.label),
      )
      expect(round.segments.map((s) => s.target?.state ?? null)).toEqual(
        statement.segments.map((s) => s.target?.state ?? null),
      )
      expect(round.segments.map((s) => s.commands.length)).toEqual(
        statement.segments.map((s) => s.commands.length),
      )
    }
  })

  it('escreve a regra de razão fixa em forma canônica', () => {
    const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!
    const regra = statementsOf(fr5.text).find((s) =>
      s.raw.startsWith('#R^Alavanca'),
    )!

    expect(printStatement(regra)).toBe(
      [
        '  #R^Alavanca: ADD A; SHOW 1, Respostas, A; IF A >= ^Razao [@Reforco, @Continua]',
        '       @Reforco: ON ^Pelota; ADD B; SET A = 0 ---> S3',
        '       @Continua: ---> SX',
      ].join('\n'),
    )
  })

  it('mantém comandos desconhecidos exatamente como estavam', () => {
    const printed = printStatement(
      reparse('  #START: RANDD K = J; ON ^H ---> S2'),
    )
    expect(printed).toContain('RANDD K = J')
  })

  it('respeita o recuo pedido', () => {
    const statement = reparse('#START: ---> S2')
    expect(printStatement(statement, { indent: '' })).toBe('#START: ---> S2')
    expect(printStatement(statement, { indent: '\t' })).toBe('\t#START: ---> S2')
  })
})

describe('printStateHeader', () => {
  it('escreve o cabeçalho puro quando não há anotações', () => {
    expect(printStateHeader(3)).toBe('S3,')
  })

  it('anexa nome, papel e posição como comentário', () => {
    expect(
      printStateHeader(2, {
        nome: 'Esperando resposta',
        papel: 'espera',
        pos: { x: 280.4, y: 120 },
      }),
    ).toBe('S2, \\@nome: Esperando resposta \\@papel: espera \\@pos: 280,120')
  })

  it('gera cabeçalho que o parser lê de volta', () => {
    const header = printStateHeader(7, { nome: 'Reforço', pos: { x: 10, y: 20 } })
    const state = parseProgram(`S.S.1,\n${header}\n`).stateSets[0]!.states[0]!
    expect(state.index).toBe(7)
    expect(state.meta.nome).toBe('Reforço')
    expect(state.meta.pos).toEqual({ x: 10, y: 20 })
  })
})
