import { describe, expect, it } from 'vitest'
import { loadFixtures } from '../../core/__fixtures.ts'
import { parseProgram } from '../../core/parser.ts'
import { buildProtocolGraph } from './protocol-graph.ts'

const fr5 = loadFixtures().find((f) => f.name === 'fr5-sintetico.MPC')!

describe('buildProtocolGraph', () => {
  it('cria um nó por estado, com posição do \\@pos: quando presente', () => {
    const program = parseProgram(fr5.text)
    const graph = buildProtocolGraph(program.stateSets[0]!, program)

    expect(graph.autoLayout).toBe(false)
    expect(graph.nodes.map((n) => n.id)).toEqual(['1', '2', '3', '4'])
    expect(graph.nodes[0]!.position).toEqual({ x: 40, y: 140 })
    expect(graph.nodes[0]!.data.label).toBe('Início')
    expect(graph.nodes[0]!.data.papel).toBe('espera')
  })

  it('cria uma aresta para cada segmento com alvo, inclusive o auto-laço de SX', () => {
    const program = parseProgram(fr5.text)
    const graph = buildProtocolGraph(program.stateSets[0]!, program)

    // S2 tem duas saídas na mesma regra (@Reforco -> S3, @Continua -> SX) mais
    // a regra de tempo (30" -> S4): três arestas partindo de S2.
    const deS2 = graph.edges.filter((e) => e.source === '2')
    expect(deS2).toHaveLength(3)

    const paraS3 = deS2.find((e) => e.target === '3')
    expect(paraS3?.data.kind).toBe('response')
    expect(paraS3?.data.selfLoop).toBe(false)

    const laco = deS2.find((e) => e.target === '2')
    expect(laco?.data.selfLoop).toBe(true)

    const paraS4 = deS2.find((e) => e.target === '4')
    expect(paraS4?.data.kind).toBe('time')
  })

  it('rotula a aresta do início da sessão', () => {
    const program = parseProgram(fr5.text)
    const graph = buildProtocolGraph(program.stateSets[0]!, program)

    const inicio = graph.edges.find((e) => e.source === '1')!
    expect(inicio.data.kind).toBe('start')
    expect(inicio.data.label).toContain('início')
  })

  it('calcula layout automático quando algum estado não tem \\@pos:', () => {
    const text =
      'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  30": ---> SX\n'
    const program = parseProgram(text)
    const graph = buildProtocolGraph(program.stateSets[0]!, program)

    expect(graph.autoLayout).toBe(true)
    expect(graph.nodes).toHaveLength(2)
    for (const node of graph.nodes) {
      expect(Number.isFinite(node.position.x)).toBe(true)
      expect(Number.isFinite(node.position.y)).toBe(true)
    }
    // O dagre deve separar os dois estados em vez de empilhá-los na origem.
    expect(graph.nodes[0]!.position).not.toEqual(graph.nodes[1]!.position)
  })

  it('mantém o \\@pos: de quem já tem, mesmo quando outro estado do mesmo processo não tem', () => {
    // Bug relatado pelo usuário: arrastar um estado (que grava `\@pos:`)
    // "voltava sozinho" sempre que outro estado do mesmo processo — comum em
    // processos criados pelo botão "+", que só anota `S1` sem posição — não
    // tinha `\@pos:` ainda. O dagre reescrevia TODOS os estados do processo,
    // não só o que faltava.
    const text =
      'S.S.1,\nS1, \\@pos: 40,140\n  #START: ---> S2\nS2,\n  30": ---> SX\n'
    const program = parseProgram(text)
    const graph = buildProtocolGraph(program.stateSets[0]!, program)

    expect(graph.autoLayout).toBe(true) // S2 ainda usa dagre
    const s1 = graph.nodes.find((n) => n.id === '1')!
    expect(s1.position).toEqual({ x: 40, y: 140 }) // preservado, não recalculado
  })
})
