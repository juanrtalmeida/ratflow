import { describe, expect, it } from 'vitest'
import { createBuilder } from '../../graph/model.ts'
import { decompileStatement } from '../../graph/decompile.ts'
import { loadFixtures } from '../../core/__fixtures.ts'
import { parseProgram } from '../../core/parser.ts'
import { COL_WIDTH, layoutRuleGraph } from './rule-graph-layout.ts'

const fr5 = loadFixtures().find((f) => f.name === 'fr5-sintetico.MPC')!

describe('layoutRuleGraph', () => {
  it('avança uma coluna por passo numa regra linear', () => {
    const b = createBuilder()
    const alvo = b.add({ kind: 'target', id: 't', state: 2 })
    const acao = b.add({ kind: 'action', id: 'a', spec: 'ligar', params: {}, next: alvo })
    const gatilho = b.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: acao })
    const graph = b.build(gatilho)

    const layout = layoutRuleGraph(graph)
    expect(layout.positions.get('g')).toEqual({ x: 0, y: 0 })
    expect(layout.positions.get('a')).toEqual({ x: COL_WIDTH, y: 0 })
    expect(layout.positions.get('t')).toEqual({ x: COL_WIDTH * 2, y: 0 })
  })

  it('abre uma decisão em duas linhas, uma para cada ramo', () => {
    const program = parseProgram(fr5.text)
    const s2 = program.stateSets[0]!.states[1]!
    // S2 tem duas regras: a de resposta (com IF) é a primeira.
    const { graph } = decompileStatement(s2.statements[0]!)

    const layout = layoutRuleGraph(graph)
    const decisao = Object.values(graph.nodes).find((n) => n.kind === 'decision')!
    const rowOf = (id: string) => layout.positions.get(id)!.y

    expect(rowOf(decisao.whenTrue!)).not.toBe(rowOf(decisao.whenFalse!))
    // A decisão fica entre as linhas dos dois ramos.
    const entre = rowOf(decisao.id)
    const [a, b] = [rowOf(decisao.whenTrue!), rowOf(decisao.whenFalse!)].sort((x, y) => x - y)
    expect(entre).toBeGreaterThanOrEqual(a)
    expect(entre).toBeLessThanOrEqual(b)
  })

  it('nunca deixa dois nós na mesma coluna e linha', () => {
    const program = parseProgram(fr5.text)
    for (const stateSet of program.stateSets) {
      for (const state of stateSet.states) {
        for (const statement of state.statements) {
          const { graph } = decompileStatement(statement)
          const layout = layoutRuleGraph(graph)
          const seen = new Set<string>()
          for (const pos of layout.positions.values()) {
            const key = `${pos.x},${pos.y}`
            expect(seen.has(key)).toBe(false)
            seen.add(key)
          }
        }
      }
    }
  })
})
