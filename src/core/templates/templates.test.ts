import { describe, expect, it } from 'vitest'
import { compileRule } from '../../graph/compile.ts'
import { decompileStatement } from '../../graph/decompile.ts'
import { detectNewline, printStatement } from '../printer.ts'
import { parseProgram } from '../parser.ts'
import { validate } from '../validate/index.ts'
import { ALL_TEMPLATES, defaultValues, templateById } from './index.ts'

describe('biblioteca de templates', () => {
  it('tem ids únicos', () => {
    const ids = ALL_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todo parâmetro declara um valor padrão', () => {
    for (const template of ALL_TEMPLATES) {
      for (const param of template.params) {
        expect(param.default, `${template.id}.${param.id}`).not.toBe('')
      }
    }
  })

  it.each(ALL_TEMPLATES)(
    '$id: nos valores padrão, passa pelo parser e pelo validador sem nenhum diagnóstico',
    (template) => {
      const text = template.gerar(defaultValues(template))
      const program = parseProgram(text)

      expect(program.diagnostics, `${template.id}: diagnóstico do parser`).toEqual([])
      expect(program.stateSets.length, `${template.id}: nenhum processo gerado`).toBeGreaterThan(0)

      const diagnosticos = validate(program)
      expect(diagnosticos, `${template.id}: diagnóstico do validador`).toEqual([])
    },
  )

  it.each(ALL_TEMPLATES)(
    '$id: toda regra sobrevive à ida e volta pelo grafo (é editável no nível 2, não cai em cru à toa)',
    (template) => {
      const text = template.gerar(defaultValues(template))
      const newline = detectNewline(text)
      const program = parseProgram(text)

      for (const stateSet of program.stateSets) {
        for (const state of stateSet.states) {
          for (const statement of state.statements) {
            const { graph } = decompileStatement(statement)
            const compilado = compileRule(graph, { newline })
            const reparsed = parseProgram(`S.S.1,${newline}S1,${newline}${compilado}${newline}`)
            const statementReparsed = reparsed.stateSets[0]!.states[0]!.statements[0]!
            expect(printStatement(statementReparsed), statement.raw).toBe(printStatement(statement))
          }
        }
      }
    },
  )

  it('templateById encontra pelo id e devolve undefined para um id desconhecido', () => {
    expect(templateById('fr')?.label).toBe('Razão fixa (FR)')
    expect(templateById('não-existe')).toBeUndefined()
  })
})
