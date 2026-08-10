import { describe, expect, it } from 'vitest'
import { parseProgram } from './parser.ts'
import { applyEdits, type TextEdit } from './edit.ts'
import {
  findState,
  findStateAtOffset,
  findStateSet,
  findStatementIndexAtOffset,
  type Program,
  type Span,
} from './ast.ts'
import { loadFixtures } from './__fixtures.ts'

const fixtures = loadFixtures()

/** Todo nó que carrega texto cru, achatado para verificação de fidelidade. */
function collectRawNodes(program: Program): { span: Span; raw: string }[] {
  const nodes: { span: Span; raw: string }[] = []
  const add = (node: { span: Span; raw: string } | null | undefined) => {
    if (node) nodes.push({ span: node.span, raw: node.raw })
  }

  for (const item of program.preamble) add(item)
  for (const comment of program.comments) add(comment)

  for (const stateSet of program.stateSets) {
    for (const state of stateSet.states) {
      for (const statement of state.statements) {
        add(statement)
        add(statement.trigger)
        if (statement.trigger.parsed?.kind === 'response') {
          add(statement.trigger.parsed.port)
        }
        if (statement.trigger.parsed?.kind === 'time') {
          add(statement.trigger.parsed.amount)
        }
        for (const segment of statement.segments) {
          add(segment.target)
          for (const command of segment.commands) {
            add(command)
            const detail = command.parsed
            if (!detail) continue
            if (detail.kind === 'port') detail.ports.forEach(add)
            if (detail.kind === 'counter') add(detail.target)
            if (detail.kind === 'set') detail.assignments.forEach((a) => add(a.target))
            if (detail.kind === 'show') detail.items.forEach((i) => add(i.value))
            if (detail.kind === 'if') {
              add(detail.condition)
              add(detail.condition.left)
              add(detail.condition.right)
            }
          }
        }
      }
    }
  }
  return nodes
}

describe('fidelidade sobre as fixtures', () => {
  it.each(fixtures)('$name: raw de cada nó bate com o span', ({ text }) => {
    const program = parseProgram(text)
    for (const node of collectRawNodes(program)) {
      expect(text.slice(node.span[0], node.span[1])).toBe(node.raw)
    }
  })

  it.each(fixtures)(
    '$name: reescrever cada statement com seu próprio raw é um no-op',
    ({ text }) => {
      const program = parseProgram(text)
      const edits: TextEdit[] = []
      for (const stateSet of program.stateSets) {
        for (const state of stateSet.states) {
          for (const statement of state.statements) {
            edits.push({ span: statement.span, newText: statement.raw })
          }
        }
      }
      expect(edits.length).toBeGreaterThan(0)
      expect(applyEdits(text, edits)).toBe(text)
    },
  )

  it.each(fixtures)(
    '$name: reescrever cada item de preâmbulo com seu raw é um no-op',
    ({ text }) => {
      const program = parseProgram(text)
      const edits = program.preamble.map((item) => ({
        span: item.span,
        newText: item.raw,
      }))
      expect(applyEdits(text, edits)).toBe(text)
    },
  )

  it.each(fixtures)('$name: spans de statement não se sobrepõem', ({ text }) => {
    const program = parseProgram(text)
    const spans = program.stateSets
      .flatMap((s) => s.states)
      .flatMap((s) => s.statements)
      .map((s) => s.span)
      .sort((a, b) => a[0] - b[0])
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1])
    }
  })

  it.each(fixtures)('$name: analisa sem erros de sintaxe', ({ text }) => {
    const program = parseProgram(text)
    expect(program.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  })
})

describe('estrutura do FR5', () => {
  const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!
  const program = parseProgram(fr5.text)

  it('encontra os dois processos e seus estados', () => {
    expect(program.stateSets.map((s) => s.index)).toEqual([1, 2])
    expect(findStateSet(program, 1)!.states.map((s) => s.index)).toEqual([1, 2, 3, 4])
    expect(findStateSet(program, 2)!.states.map((s) => s.index)).toEqual([1, 2, 3])
  })

  it('lê os nomes amigáveis anotados em comentário', () => {
    const tarefa = findStateSet(program, 1)!
    expect(tarefa.meta.nome).toBe('Tarefa')
    expect(findState(tarefa, 2)!.meta.nome).toBe('Esperando resposta')
    expect(findState(tarefa, 2)!.meta.papel).toBe('espera')
    expect(findState(tarefa, 2)!.meta.pos).toEqual({ x: 360, y: 140 })
  })

  it('reconhece o preâmbulo', () => {
    const constants = program.preamble.filter((p) => p.kind === 'ConstantDef')
    expect(constants.map((c) => c.name)).toEqual([
      'Alavanca',
      'Pelota',
      'LuzCasa',
      'Razao',
      'DuracaoSessao',
      'Timeout',
    ])
    expect(constants.find((c) => c.name === 'Razao')!.value).toBe('5')

    const alias = program.preamble.find((p) => p.kind === 'VarAliasBlock')!
    expect(alias.aliases.map((a) => [a.alias, a.variable])).toEqual([
      ['Respostas', 'A'],
      ['Reforcos', 'B'],
    ])

    const dim = program.preamble.find((p) => p.kind === 'DimDecl')!
    expect([dim.variable, dim.size]).toEqual(['C', '2000'])

    const list = program.preamble.find((p) => p.kind === 'ListDecl')!
    expect(list.values).toEqual(['1', '3', '5', '7', '9'])

    const disk = program.preamble.find((p) => p.kind === 'DiskDirective')!
    expect([disk.directive, disk.values]).toEqual(['DISKVARS', ['A', 'B', 'C']])
  })

  it('decompõe a regra de razão fixa em gatilho, comandos e ramos', () => {
    const esperando = findState(findStateSet(program, 1)!, 2)!
    expect(esperando.statements).toHaveLength(2)

    const [resposta, timeout] = esperando.statements
    expect(resposta!.trigger.parsed).toEqual({
      kind: 'response',
      channel: 'R',
      port: expect.objectContaining({ type: 'constant', name: 'Alavanca' }),
    })

    const primeiro = resposta!.segments[0]!
    expect(primeiro.label).toBeNull()
    expect(primeiro.commands.map((c) => c.parsed?.kind)).toEqual([
      'counter',
      'show',
      'if',
    ])

    const condicional = primeiro.commands[2]!.parsed!
    expect(condicional.kind).toBe('if')
    if (condicional.kind === 'if') {
      expect(condicional.thenLabel).toBe('Reforco')
      expect(condicional.elseLabel).toBe('Continua')
      expect(condicional.condition.operator).toBe('>=')
      expect(condicional.condition.left!.name).toBe('A')
      expect(condicional.condition.right!.name).toBe('Razao')
      expect(condicional.condition.right!.type).toBe('constant')
    }

    expect(resposta!.segments.map((s) => s.label)).toEqual([
      null,
      'Reforco',
      'Continua',
    ])
    expect(resposta!.segments[1]!.target!.state).toBe(3)
    expect(resposta!.segments[2]!.target!.state).toBe('SX')

    expect(timeout!.trigger.parsed).toEqual({
      kind: 'time',
      unit: 's',
      amount: expect.objectContaining({ type: 'number', name: '30' }),
    })
  })

  it('reconhece gatilhos de tempo por constante e por minuto', () => {
    const sessao = findStateSet(program, 2)!
    const aguardando = findState(sessao, 2)!.statements[0]!
    expect(aguardando.trigger.parsed).toEqual({
      kind: 'time',
      unit: 'min',
      amount: expect.objectContaining({ type: 'constant', name: 'DuracaoSessao' }),
    })
    expect(aguardando.segments[0]!.commands[0]!.parsed).toEqual({
      kind: 'signal',
      number: 1,
    })

    const fim = findState(sessao, 3)!.statements[0]!
    expect(fim.trigger.parsed).toEqual({ kind: 'signal', number: 1 })
  })

  it('reconhece SET com múltiplas atribuições e ON com constante', () => {
    const inicio = findState(findStateSet(program, 1)!, 1)!.statements[0]!
    expect(inicio.trigger.parsed).toEqual({ kind: 'start' })

    const [set, on] = inicio.segments[0]!.commands
    expect(set!.parsed!.kind).toBe('set')
    if (set!.parsed!.kind === 'set') {
      expect(
        set!.parsed!.assignments.map((a) => [a.target.name, a.value]),
      ).toEqual([
        ['A', '0'],
        ['B', '0'],
      ])
    }
    expect(on!.parsed).toEqual({
      kind: 'port',
      op: 'ON',
      ports: [expect.objectContaining({ type: 'constant', name: 'LuzCasa' })],
    })
  })
})

describe('degradação suave no arquivo legado', () => {
  const legado = fixtures.find((f) => f.name === 'vi30-legado.MPC')!
  const program = parseProgram(legado.text)

  it('mantém construções desconhecidas como texto cru, sem erro', () => {
    const comandos = program.stateSets
      .flatMap((s) => s.states)
      .flatMap((s) => s.statements)
      .flatMap((s) => s.segments)
      .flatMap((s) => s.commands)

    const randd = comandos.filter((c) => c.raw.startsWith('RANDD'))
    expect(randd.length).toBeGreaterThan(0)
    expect(randd.every((c) => c.parsed === null)).toBe(true)
    expect(program.diagnostics).toEqual([])
  })

  it('cai para nomes numéricos quando não há anotação', () => {
    expect(program.stateSets[0]!.meta.nome).toBeUndefined()
    expect(program.stateSets[0]!.states[0]!.meta.nome).toBeUndefined()
  })

  it('reconhece resposta com número colado (`#R1`)', () => {
    const statement = program.stateSets[0]!.states[1]!.statements[1]!
    expect(statement.trigger.parsed).toEqual({
      kind: 'response',
      channel: 'R',
      port: expect.objectContaining({ type: 'number', name: '1' }),
    })
  })

  it('reconhece gatilho de tempo baseado em variável (`K"`)', () => {
    const statement = program.stateSets[0]!.states[1]!.statements[0]!
    expect(statement.trigger.parsed).toEqual({
      kind: 'time',
      unit: 's',
      amount: expect.objectContaining({ type: 'variable', name: 'K' }),
    })
  })
})

describe('recuperação de erro', () => {
  it('reporta linha sem dois-pontos e continua analisando o resto', () => {
    const text = ['S.S.1,', 'S1,', '  isto não é uma regra', '  #START: ---> S2'].join(
      '\n',
    )
    const program = parseProgram(text)
    expect(program.diagnostics).toHaveLength(1)
    expect(program.diagnostics[0]!.code).toBe('statement-sem-gatilho')
    expect(program.diagnostics[0]!.plain).toContain('dois-pontos')

    const [statement] = program.stateSets[0]!.states[0]!.statements
    expect(statement!.trigger.parsed).toEqual({ kind: 'start' })
  })

  it('aponta a posição exata da linha problemática', () => {
    const text = 'S.S.1,\nS1,\n  regra torta\n'
    const program = parseProgram(text)
    const [start, end] = program.diagnostics[0]!.span
    expect(text.slice(start, end)).toBe('regra torta')
  })

  it('reclama de regra escrita antes de qualquer estado', () => {
    const program = parseProgram('S.S.1,\n  #START: ---> S2\n')
    expect(program.diagnostics[0]!.code).toBe('linha-fora-de-estado')
  })

  it('não lança com entrada arbitrária', () => {
    for (const junk of ['', '\n\n', '\\ só comentário', ']]][[[', 'S.S.', 'S1,']) {
      expect(() => parseProgram(junk)).not.toThrow()
    }
  })
})

describe('busca por offset (espelhamento código → canvas)', () => {
  const text = 'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  30": ---> SX\n  1": ---> SX\n'
  const program = parseProgram(text)
  const stateSet = program.stateSets[0]!

  it('encontra o estado que contém um offset', () => {
    const offsetEmS1 = text.indexOf('#START')
    const offsetEmS2 = text.lastIndexOf('30"')
    expect(findStateAtOffset(stateSet, offsetEmS1)!.index).toBe(1)
    expect(findStateAtOffset(stateSet, offsetEmS2)!.index).toBe(2)
  })

  it('devolve undefined fora de qualquer estado', () => {
    expect(findStateAtOffset(stateSet, text.length)).toBeUndefined()
  })

  it('encontra a regra dentro do estado que contém um offset', () => {
    const s2 = findState(stateSet, 2)!
    const offsetNaSegunda = text.lastIndexOf('1"')
    expect(findStatementIndexAtOffset(s2, offsetNaSegunda)).toBe(1)
  })

  it('devolve null fora de qualquer regra', () => {
    const s1 = findState(stateSet, 1)!
    expect(findStatementIndexAtOffset(s1, 0)).toBeNull()
  })
})
