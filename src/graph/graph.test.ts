import { describe, expect, it } from 'vitest'
import { parseProgram } from '../core/parser.ts'
import { detectNewline, printStatement } from '../core/printer.ts'
import type { Statement } from '../core/ast.ts'
import { loadFixtures } from '../core/__fixtures.ts'
import { compileRule, CompileError } from './compile.ts'
import { decompileStatement } from './decompile.ts'
import { canConnect, validateGraph } from './validate.ts'
import {
  createBuilder,
  inDegrees,
  RAW_SPEC,
  unreachableNodes,
  walkGraph,
  type RuleGraph,
} from './model.ts'
import { foldablePulse, parsePulseMacro, printPulseState } from './macros.ts'

const fixtures = loadFixtures()

function statementsOf(text: string): Statement[] {
  return parseProgram(text)
    .stateSets.flatMap((s) => s.states)
    .flatMap((s) => s.statements)
}

function reparse(printed: string): Statement {
  const program = parseProgram(`S.S.1,\nS1,\n${printed}\n`)
  const statement = program.stateSets[0]?.states[0]?.statements[0]
  if (!statement) throw new Error(`não reanalisou:\n${printed}`)
  return statement
}

describe('contrato de fidelidade: compile(decompile(regra)) === regra', () => {
  it.each(fixtures)(
    '$name: toda regra sobrevive à ida e volta pelo grafo',
    ({ text }) => {
      const newline = detectNewline(text)
      const statements = statementsOf(text)
      expect(statements.length).toBeGreaterThan(0)

      for (const statement of statements) {
        const { graph } = decompileStatement(statement)
        const compilado = compileRule(graph, { newline })
        expect(printStatement(reparse(compilado)), statement.raw).toBe(
          printStatement(statement),
        )
      }
    },
  )

  it.each(fixtures)('$name: compilar duas vezes dá o mesmo texto', ({ text }) => {
    const newline = detectNewline(text)
    for (const statement of statementsOf(text)) {
      const uma = compileRule(decompileStatement(statement).graph, { newline })
      const outra = compileRule(decompileStatement(reparse(uma)).graph, { newline })
      expect(outra).toBe(uma)
    }
  })
})

describe('descompilação', () => {
  const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!
  const razaoFixa = statementsOf(fr5.text).find((s) =>
    s.raw.startsWith('#R^Alavanca'),
  )!

  it('monta gatilho, ações, decisão e destinos como nós', () => {
    const { graph } = decompileStatement(razaoFixa)
    const tipos = [...walkGraph(graph)].map((n) => n.kind)

    expect(tipos.filter((t) => t === 'trigger')).toHaveLength(1)
    expect(tipos.filter((t) => t === 'decision')).toHaveLength(1)
    expect(tipos.filter((t) => t === 'target')).toHaveLength(2)
    // ADD A, SHOW, e no ramo verdadeiro ON, ADD B, SET.
    expect(tipos.filter((t) => t === 'action')).toHaveLength(5)
  })

  it('preenche o gatilho com o dispositivo escolhido', () => {
    const { graph } = decompileStatement(razaoFixa)
    const raiz = graph.nodes[graph.root]!
    expect(raiz.kind).toBe('trigger')
    if (raiz.kind === 'trigger') {
      expect(raiz.spec).toBe('resposta')
      expect(raiz.params.dispositivo).toBe('^Alavanca')
    }
  })

  it('guarda os rótulos originais da decisão para recompilar igual', () => {
    const { graph } = decompileStatement(razaoFixa)
    const decisao = [...walkGraph(graph)].find((n) => n.kind === 'decision')!
    if (decisao.kind !== 'decision') throw new Error('esperava decisão')
    expect(decisao.left).toBe('A')
    expect(decisao.operator).toBe('>=')
    expect(decisao.right).toBe('^Razao')
    expect(decisao.labels).toEqual({ whenTrue: 'Reforco', whenFalse: 'Continua' })
  })

  it('marca como cru o que o catálogo não modela', () => {
    const legado = fixtures.find((f) => f.name === 'vi30-legado.MPC')!
    const comRandd = statementsOf(legado.text).find((s) => s.raw.includes('RANDD'))!
    const { graph, rawNodes } = decompileStatement(comRandd)

    expect(rawNodes.length).toBeGreaterThan(0)
    const cru = graph.nodes[rawNodes[0]!]!
    expect(cru.kind).toBe('action')
    if (cru.kind === 'action') {
      expect(cru.spec).toBe(RAW_SPEC)
      expect(cru.raw).toContain('RANDD')
    }
  })

  it('preserva a regra inteira quando um caminho rotulado fica órfão', () => {
    const statement = reparse(
      '  #START: ---> S2\n       @Sobrando: ON ^A ---> S3',
    )
    const { graph } = decompileStatement(statement)
    expect(graph.rawStatement).toBeDefined()
    expect(compileRule(graph)).toContain('@Sobrando')
    expect(printStatement(reparse(compileRule(graph)))).toBe(
      printStatement(statement),
    )
  })

  it('não quebra comandos de múltiplos alvos em vários nós', () => {
    // `SET A = 0, B = 0` viraria `SET A = 0; SET B = 0` se fosse dividido —
    // texto diferente do original. Vira um nó cru, e o texto se mantém.
    const statement = reparse('  #START: SET A = 0, B = 0 ---> S2')
    const { graph, rawNodes } = decompileStatement(statement)
    expect(rawNodes).toHaveLength(1)
    expect(compileRule(graph)).toBe('  #START: SET A = 0, B = 0 ---> S2')
  })

  it('um destino especial (STOP/ABORT/FLUSH/KILL…) vira só aquele nó cru, não a regra inteira', () => {
    // Relatado pelo usuário: um IF aninhado dentro de outro IF, com um dos
    // ramos apontando para STOPKILL, fazia a regra inteira (inclusive as
    // duas decisões, perfeitamente modeláveis) cair em cru.
    const statement = reparse(
      '  #START: IF A(0) < 3 [@HERE, @ELSEWHERE]\n' +
        '       @HERE: IF B(0) = 1 [@BOXTESTED, @NOT]\n' +
        '           @BOXTESTED: ---> S2\n' +
        '           @NOT: ---> STOPKILL\n' +
        '       @ELSEWHERE: ---> S2',
    )
    const { graph, rawNodes } = decompileStatement(statement)

    expect(graph.rawStatement).toBeUndefined()
    const tipos = [...walkGraph(graph)].map((n) => n.kind)
    expect(tipos.filter((t) => t === 'decision')).toHaveLength(2)

    expect(rawNodes).toHaveLength(1)
    const cru = graph.nodes[rawNodes[0]!]!
    expect(cru.kind).toBe('target')
    if (cru.kind === 'target') {
      expect(cru.state).toBeNull()
      expect(cru.raw).toBe('STOPKILL')
    }

    expect(printStatement(reparse(compileRule(graph)))).toBe(printStatement(statement))
  })
})

describe('compilação', () => {
  it('escreve uma regra montada do zero', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x1', state: 3 })
    builder.add({ kind: 'target', id: 'x2', state: 'SX' })
    builder.add({
      kind: 'decision',
      id: 'd1',
      left: 'A',
      operator: '>=',
      right: '^Razao',
      whenTrue: 'x1',
      whenFalse: 'x2',
    })
    builder.add({
      kind: 'action',
      id: 'a1',
      spec: 'somar',
      params: { contador: 'A' },
      next: 'd1',
    })
    builder.add({
      kind: 'trigger',
      id: 'g0',
      spec: 'resposta',
      params: { dispositivo: '^Alavanca' },
      next: 'a1',
    })

    expect(compileRule(builder.build('g0'))).toBe(
      [
        '  #R^Alavanca: ADD A; IF A >= ^Razao [@Sim1, @Nao1]',
        '       @Sim1: ---> S3',
        '       @Nao1: ---> SX',
      ].join('\n'),
    )
  })

  it('compila cada tipo de ação do catálogo', () => {
    const casos: [string, Record<string, string>, string][] = [
      ['ligar', { dispositivo: '^Pelota' }, 'ON ^Pelota'],
      ['desligar', { dispositivo: '^Pelota' }, 'OFF ^Pelota'],
      ['pulsar', { dispositivo: '^Pelota', duracao: '0.05' }, 'ON ^Pelota'],
      ['somar', { contador: 'A' }, 'ADD A'],
      ['subtrair', { contador: 'A' }, 'SUB A'],
      ['definir', { contador: 'A', valor: '0' }, 'SET A = 0'],
      [
        'registrar',
        { posicao: '1', rotulo: 'Respostas', contador: 'A' },
        'SHOW 1, Respostas, A',
      ],
      ['avisar', { numero: '1' }, 'Z1'],
    ]

    for (const [spec, params, esperado] of casos) {
      const builder = createBuilder()
      builder.add({ kind: 'target', id: 'x', state: 'SX' })
      builder.add({ kind: 'action', id: 'a', spec, params, next: 'x' })
      builder.add({
        kind: 'trigger',
        id: 'g',
        spec: 'inicio',
        params: {},
        next: 'a',
      })
      expect(compileRule(builder.build('g')), spec).toBe(
        `  #START: ${esperado} ---> SX`,
      )
    }
  })

  it('compila cada tipo de gatilho', () => {
    const casos: [string, Record<string, string>, string][] = [
      ['inicio', {}, '#START'],
      ['resposta', { dispositivo: '^Alavanca' }, '#R^Alavanca'],
      ['resposta', { dispositivo: '1' }, '#R1'],
      ['tempo', { duracao: '30', unidade: 's' }, '30"'],
      ['tempo', { duracao: '^Sessao', unidade: 'min' }, "^Sessao'"],
      ['sinal', { numero: '3' }, '#Z3'],
    ]

    for (const [spec, params, esperado] of casos) {
      const builder = createBuilder()
      builder.add({ kind: 'target', id: 'x', state: 2 })
      builder.add({ kind: 'trigger', id: 'g', spec, params, next: 'x' })
      expect(compileRule(builder.build('g')), spec).toBe(`  ${esperado}: ---> S2`)
    }
  })

  it('respeita o recuo pedido', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'x' })
    expect(compileRule(builder.build('g'), { indent: '' })).toBe('#START: ---> S2')
  })

  it('recusa grafo sem gatilho na raiz', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    expect(() => compileRule(builder.build('x'))).toThrow(CompileError)
  })

  it('recusa nó com campo obrigatório vazio, dizendo qual é', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({
      kind: 'action',
      id: 'a',
      spec: 'definir',
      params: { contador: 'A' },
      next: 'x',
    })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    expect(() => compileRule(builder.build('g'))).toThrow(/valor/)
  })
})

describe('validação do grafo', () => {
  function grafoSimples(): RuleGraph {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({
      kind: 'action',
      id: 'a',
      spec: 'somar',
      params: { contador: 'A' },
      next: 'x',
    })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    return builder.build('g')
  }

  it('aprova um grafo bem formado', () => {
    expect(validateGraph(grafoSimples())).toEqual([])
  })

  it('acusa caminho que não termina em destino', () => {
    const builder = createBuilder()
    builder.add({
      kind: 'action',
      id: 'a',
      spec: 'somar',
      params: { contador: 'A' },
      next: null,
    })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    expect(validateGraph(builder.build('g')).map((p) => p.code)).toContain(
      'caminho-sem-fim',
    )
  })

  it('acusa campo vazio usando o rótulo do catálogo', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'action', id: 'a', spec: 'ligar', params: {}, next: 'x' })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    const problema = validateGraph(builder.build('g')).find(
      (p) => p.code === 'campo-vazio',
    )!
    expect(problema.plain).toContain('O quê')
    expect(problema.plain).toContain('Ligar dispositivo')
  })

  it('acusa decisão com saída solta', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({
      kind: 'decision',
      id: 'd',
      left: 'A',
      operator: '>=',
      right: '5',
      whenTrue: 'x',
      whenFalse: null,
    })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'd' })
    expect(validateGraph(builder.build('g')).map((p) => p.code)).toContain(
      'decisao-incompleta',
    )
  })

  it('acusa nó solto', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'target', id: 'orfao', state: 3 })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'x' })
    expect(validateGraph(builder.build('g')).map((p) => p.code)).toContain('no-solto')
  })

  it('não valida grafo preservado em texto', () => {
    const statement = reparse('  #START: ---> S2\n       @Orfao: ON ^A ---> S3')
    expect(validateGraph(decompileStatement(statement).graph)).toEqual([])
  })
})

describe('canConnect', () => {
  const grafo = (() => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({
      kind: 'action',
      id: 'a1',
      spec: 'somar',
      params: { contador: 'A' },
      next: 'x',
    })
    builder.add({
      kind: 'action',
      id: 'a2',
      spec: 'somar',
      params: { contador: 'B' },
      next: null,
    })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a1' })
    return builder.build('g')
  })()

  it('recusa seta para dentro de um gatilho', () => {
    const check = canConnect(grafo, 'a2', 'g')
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('começo')
  })

  it('recusa saída a partir de um destino', () => {
    expect(canConnect(grafo, 'x', 'a2').ok).toBe(false)
  })

  it('recusa nó ligado a si mesmo', () => {
    expect(canConnect(grafo, 'a2', 'a2').ok).toBe(false)
  })

  it('recusa caminho que voltaria para trás', () => {
    const check = canConnect(grafo, 'x', 'a1')
    expect(check.ok).toBe(false)
  })

  it('recusa junção e explica que é preciso duplicar', () => {
    const check = canConnect(grafo, 'a2', 'x')
    expect(check.ok).toBe(false)
    expect(check.reason).toContain('duplique')
  })

  it('aceita ligação válida', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'action', id: 'a', spec: 'somar', params: {}, next: null })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    expect(canConnect(builder.build('g'), 'a', 'x').ok).toBe(true)
  })
})

describe('macros de ação composta', () => {
  it('escreve e relê a marca do pulso', () => {
    const macro = { dispositivo: '^Pelota', duracao: '0.05' }
    const texto = printPulseState({ index: 4, macro, destino: 2 })

    expect(texto).toContain('\\@macro: pulso ^Pelota 0.05')
    expect(texto).toContain('0.05": OFF ^Pelota ---> S2')

    const state = parseProgram(`S.S.1,\n${texto}\n`).stateSets[0]!.states[0]!
    expect(parsePulseMacro(state.meta.macro)).toEqual(macro)
    expect(foldablePulse(state)).toEqual(macro)
  })

  it('desiste de dobrar quando o estado auxiliar foi editado à mão', () => {
    const texto = printPulseState({
      index: 4,
      macro: { dispositivo: '^Pelota', duracao: '0.05' },
      destino: 2,
    })
    const adulterado = texto.replace('OFF ^Pelota', 'OFF ^Pelota; ADD Z')
    const state = parseProgram(`S.S.1,\n${adulterado}\n`).stateSets[0]!.states[0]!

    expect(parsePulseMacro(state.meta.macro)).not.toBeNull()
    expect(foldablePulse(state)).toBeNull()
  })

  it('ignora estado comum, sem marca de macro', () => {
    const state = parseProgram('S.S.1,\nS2,\n  5": ---> SX\n').stateSets[0]!
      .states[0]!
    expect(foldablePulse(state)).toBeNull()
  })
})

describe('utilidades do modelo', () => {
  it('conta as setas que chegam em cada nó', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'action', id: 'a', spec: 'somar', params: {}, next: 'x' })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'a' })
    const graus = inDegrees(builder.build('g'))
    expect(graus.get('g')).toBe(0)
    expect(graus.get('a')).toBe(1)
    expect(graus.get('x')).toBe(1)
  })

  it('encontra nós que a raiz não alcança', () => {
    const builder = createBuilder()
    builder.add({ kind: 'target', id: 'x', state: 2 })
    builder.add({ kind: 'target', id: 'solto', state: 3 })
    builder.add({ kind: 'trigger', id: 'g', spec: 'inicio', params: {}, next: 'x' })
    expect(unreachableNodes(builder.build('g'))).toEqual(['solto'])
  })
})
