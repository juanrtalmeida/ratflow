import { describe, expect, it } from 'vitest'
import { loadFixtures } from './__fixtures.ts'
import { applyEdits } from './edit.ts'
import {
  createDevice,
  deletePulseState,
  expandPulse,
  createProcess,
  createState,
  createTransition,
  deleteState,
  deleteStatement,
  insertStateInTransition,
  insertStatement,
  renameState,
  retargetTransition,
  setCounterAlias,
  setStatePosition,
} from './mutations.ts'
import { parseProgram } from './parser.ts'
import { transitionRule } from '../graph/mutate.ts'
import { decompileStatement } from '../graph/decompile.ts'
import { CompileError } from '../graph/compile.ts'
import { foldablePulse } from '../graph/macros.ts'
import { validate } from './validate/index.ts'

const fixtures = loadFixtures()

/** Erros (não avisos) do arquivo — a régua de "a mutação não estragou nada". */
function erros(text: string): string[] {
  const program = parseProgram(text)
  return validate(program, { dialect: 'V' })
    .filter((d) => d.severity === 'error')
    .map((d) => d.code)
    .sort()
}

describe('setStatePosition', () => {
  it('atualiza só a posição, preservando nome e papel', () => {
    const text = 'S.S.1,\nS2, \\@nome: Espera \\@papel: espera \\@pos: 10,20\n  #START: ---> SX\n'
    const program = parseProgram(text)
    const state = program.stateSets[0]!.states[0]!

    const edits = setStatePosition(state, { x: 99, y: 5 })
    const result = applyEdits(text, edits)

    expect(result).toContain('S2, \\@nome: Espera \\@papel: espera \\@pos: 99,5')
    expect(result).not.toContain('10,20')
  })

  it('preserva a marca de macro ao mover um estado auxiliar de pulso', () => {
    const text =
      'S.S.1,\nS3, \\@nome: Pulso \\@macro: pulso ^Pelota 0.05 \\@pos: 10,20\n  0.05": OFF ^Pelota ---> SX\n'
    const program = parseProgram(text)
    const state = program.stateSets[0]!.states[0]!

    const edits = setStatePosition(state, { x: 1, y: 2 })
    const result = applyEdits(text, edits)

    expect(result).toContain('\\@macro: pulso ^Pelota 0.05')
    expect(result).toContain('\\@pos: 1,2')
  })

  it('não toca em outras linhas do arquivo', () => {
    const text =
      'S.S.1,\nS1, \\@pos: 0,0\n  #START: ---> S2\nS2, \\@pos: 200,0\n  30": ---> SX\n'
    const program = parseProgram(text)
    const state = program.stateSets[0]!.states[1]!

    const edits = setStatePosition(state, { x: 999, y: 999 })
    const result = applyEdits(text, edits)

    expect(result).toContain('S1, \\@pos: 0,0')
    expect(result).toContain('#START: ---> S2')
    expect(result).toContain('S2, \\@pos: 999,999')
  })
})

describe('renameState', () => {
  it('reescreve só o nome, preservando papel e posição', () => {
    const text = 'S.S.1,\nS2, \\@nome: Velho \\@papel: espera \\@pos: 10,20\n  #START: ---> SX\n'
    const program = parseProgram(text)
    const state = program.stateSets[0]!.states[0]!

    const result = applyEdits(text, renameState(state, 'Novo'))

    expect(result).toContain('S2, \\@nome: Novo \\@papel: espera \\@pos: 10,20')
  })
})

describe('deleteState', () => {
  it('remove o bloco inteiro sem deixar lixo nem tocar nos vizinhos', () => {
    const text =
      'S.S.1,\nS1, \\@pos: 0,0\n  #START: ---> S2\nS2, \\@pos: 200,0\n  30": ---> SX\nS3, \\@pos: 400,0\n  1": ---> SX\n'
    const program = parseProgram(text)
    const meio = program.stateSets[0]!.states[1]!

    const result = applyEdits(text, deleteState(meio))
    const reparsed = parseProgram(result)

    expect(reparsed.stateSets[0]!.states.map((s) => s.index)).toEqual([1, 3])
    expect(result).toContain('S1, \\@pos: 0,0')
    expect(result).toContain('S3, \\@pos: 400,0')
    expect(result).not.toContain('S2,')
  })
})

describe('retargetTransition', () => {
  it('troca só o identificador depois de --->', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  30": ---> SX\n'
    const program = parseProgram(text)
    const target = program.stateSets[0]!.states[0]!.statements[0]!.segments[0]!.target!

    const result = applyEdits(text, retargetTransition(target, 'SX'))

    expect(result).toContain('#START: ---> SX')
    expect(parseProgram(result).diagnostics).toEqual([])
  })

  it('religa para um número de estado', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\nS2,\n  30": ---> SX\n'
    const program = parseProgram(text)
    const target = program.stateSets[0]!.states[0]!.statements[0]!.segments[0]!.target!

    const result = applyEdits(text, retargetTransition(target, 2))

    expect(result).toContain('#START: ---> S2')
  })
})

describe('createState', () => {
  it('cria um estado vazio com o próximo índice livre, no fim do processo', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\nS3,\n  1": ---> SX\n'
    const program = parseProgram(text)
    const stateSet = program.stateSets[0]!

    const { edits, index } = createState(stateSet, text, { nome: 'Novo estado' })
    const result = applyEdits(text, edits)
    const reparsed = parseProgram(result)

    expect(index).toBe(4) // maior índice existente (3) + 1, não a contagem de estados
    expect(reparsed.stateSets[0]!.states.map((s) => s.index)).toEqual([1, 3, 4])
    expect(reparsed.stateSets[0]!.states[2]!.meta.nome).toBe('Novo estado')
    expect(result).toContain('S1,\n  #START: ---> SX')
  })

  it('cria o primeiro estado quando o processo ainda está vazio', () => {
    const text = 'S.S.1,\n'
    const { edits, index } = createState(parseProgram(text).stateSets[0]!, text)
    const reparsed = parseProgram(applyEdits(text, edits))

    expect(index).toBe(1)
    expect(reparsed.stateSets[0]!.states.map((s) => s.index)).toEqual([1])
  })
})

describe('createProcess', () => {
  it('cria S.S.n com um S1 que já tem #START', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const { edits, index } = createProcess(program, text, { nome: 'Sessão' })
    const result = applyEdits(text, edits)
    const reparsed = parseProgram(result)

    expect(index).toBe(2)
    expect(reparsed.stateSets.map((s) => s.index)).toEqual([1, 2])
    expect(reparsed.stateSets[1]!.meta.nome).toBe('Sessão')
    expect(reparsed.stateSets[1]!.states[0]!.statements[0]!.trigger.parsed?.kind).toBe('start')
  })
})

describe('createDevice', () => {
  it('insere a constante depois da última já existente', () => {
    const text = '^A = 1\n^B = 2\n\nS.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const result = applyEdits(text, createDevice(program, text, 'Pelota', 3))
    const reparsed = parseProgram(result)

    expect(reparsed.preamble.map((i) => (i.kind === 'ConstantDef' ? i.name : null))).toEqual([
      'A',
      'B',
      'Pelota',
    ])
  })

  it('funciona num preâmbulo sem nenhuma constante ainda', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const result = applyEdits(text, createDevice(program, text, 'Pelota', 1))
    const reparsed = parseProgram(result)

    expect(reparsed.preamble.some((i) => i.kind === 'ConstantDef' && i.name === 'Pelota')).toBe(
      true,
    )
    expect(reparsed.stateSets).toHaveLength(1)
  })
})

describe('setCounterAlias', () => {
  it('atualiza o apelido de uma variável já aliasada', () => {
    const text = 'VAR_ALIAS\n  Velho = A\nEND\n\nS.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const result = applyEdits(text, setCounterAlias(program, text, 'A', 'Novo'))
    const reparsed = parseProgram(result)

    expect(reparsed.stateSets).toHaveLength(1)
    const bloco = reparsed.preamble.find((i) => i.kind === 'VarAliasBlock')
    expect(bloco?.kind === 'VarAliasBlock' && bloco.aliases.map((a) => a.alias)).toEqual(['Novo'])
  })

  it('acrescenta uma variável nova a um bloco VAR_ALIAS já existente', () => {
    const text = 'VAR_ALIAS\n  Respostas = A\nEND\n\nS.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const result = applyEdits(text, setCounterAlias(program, text, 'B', 'Reforcos'))
    const reparsed = parseProgram(result)

    const bloco = reparsed.preamble.find((i) => i.kind === 'VarAliasBlock')
    expect(
      bloco?.kind === 'VarAliasBlock' &&
        bloco.aliases.map((a) => [a.alias, a.variable]),
    ).toEqual([
      ['Respostas', 'A'],
      ['Reforcos', 'B'],
    ])
  })

  it('cria o bloco VAR_ALIAS quando o arquivo ainda não tem nenhum', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\n'
    const program = parseProgram(text)

    const result = applyEdits(text, setCounterAlias(program, text, 'A', 'Respostas'))
    const reparsed = parseProgram(result)

    const bloco = reparsed.preamble.find((i) => i.kind === 'VarAliasBlock')
    expect(bloco?.kind === 'VarAliasBlock' && bloco.aliases).toEqual([
      { alias: 'Respostas', variable: 'A', span: expect.anything() },
    ])
    expect(reparsed.stateSets).toHaveLength(1)
  })
})

const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!

/** O estado `S<index>` do primeiro processo. */
function estado(text: string, index: number) {
  return parseProgram(text).stateSets[0]!.states.find((s) => s.index === index)!
}

describe('insertStatement', () => {
  it('escreve a primeira regra de um estado que só tem cabeçalho', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> S2\nS2, \\@nome: Vazio\n'
    const result = applyEdits(text, insertStatement(text, estado(text, 2), transitionRule('SX')))

    expect(result).toContain('S2, \\@nome: Vazio\n  5": ---> SX')
    const reparsed = estado(result, 2)
    expect(reparsed.statements).toHaveLength(1)
    expect(erros(result)).toEqual(erros(text))
  })

  it('acrescenta depois da última regra, preservando a linha em branco antes do próximo estado', () => {
    const result = applyEdits(
      fr5.text,
      insertStatement(fr5.text, estado(fr5.text, 2), transitionRule(4)),
    )

    // A regra nova entra depois de `30": ---> S4` e a linha em branco que
    // separava S2 de S3 continua ali.
    expect(result).toContain('  30": ---> S4\n  5": ---> S4\n\nS3,')
    expect(estado(result, 2).statements).toHaveLength(3)
  })

  it('copia o recuo do arquivo em vez de impor um padrão', () => {
    const text = 'S.S.1,\nS1,\n\t#START: ---> SX\n'
    const result = applyEdits(text, insertStatement(text, estado(text, 1), transitionRule('SX')))

    expect(result).toContain('\t#START: ---> SX\n\t5": ---> SX')
  })

  it('não empurra o comentário de fim de linha da última regra', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX  \\ nota do autor\n'
    const result = applyEdits(text, insertStatement(text, estado(text, 1), transitionRule('SX')))

    expect(result).toContain('#START: ---> SX  \\ nota do autor\n')
    expect(result).toContain('\n  5": ---> SX')
  })

  it('preserva CRLF', () => {
    const crlf = fixtures.find((f) => f.name === 'crlf-sintetico.MPC')!
    const state = parseProgram(crlf.text).stateSets[0]!.states[0]!
    const result = applyEdits(crlf.text, insertStatement(crlf.text, state, transitionRule('SX')))

    expect(result).not.toMatch(/[^\r]\n/)
  })

  it('funciona em arquivo sem quebra de linha no fim', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX'
    const result = applyEdits(text, insertStatement(text, estado(text, 1), transitionRule('SX')))

    expect(result).toBe('S.S.1,\nS1,\n  #START: ---> SX\n  5": ---> SX')
    expect(estado(result, 1).statements).toHaveLength(2)
  })
})

describe('deleteStatement', () => {
  it('remove a linha inteira, sem deixar linha em branco no lugar', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> S2\n  30": ---> SX\n'
    const statement = estado(text, 1).statements[1]!
    const result = applyEdits(text, deleteStatement(text, statement))

    expect(result).toBe('S.S.1,\nS1,\n  #START: ---> S2\n')
  })

  it('remove todas as linhas de uma regra com segmentos rotulados', () => {
    // A regra do `IF` em S2 da fr5 ocupa três linhas físicas.
    const statement = estado(fr5.text, 2).statements[0]!
    const result = applyEdits(fr5.text, deleteStatement(fr5.text, statement))

    expect(result).not.toContain('@Reforco')
    expect(result).not.toContain('@Continua')
    expect(result).toContain('  30": ---> S4')
    expect(estado(result, 2).statements).toHaveLength(1)
  })

  it('apagar a última regra deixa o estado sem regras e o parser não reclama', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\nS2,\n  30": ---> SX\n'
    const statement = estado(text, 2).statements[0]!
    const result = applyEdits(text, deleteStatement(text, statement))

    expect(estado(result, 2).statements).toHaveLength(0)
    expect(parseProgram(result).diagnostics).toEqual(parseProgram(text).diagnostics)
  })

  it('não deixa \\r órfão num arquivo CRLF', () => {
    const text = 'S.S.1,\r\nS1,\r\n  #START: ---> S2\r\n  30": ---> SX\r\n'
    const statement = estado(text, 1).statements[1]!
    const result = applyEdits(text, deleteStatement(text, statement))

    expect(result).toBe('S.S.1,\r\nS1,\r\n  #START: ---> S2\r\n')
  })
})

describe('createTransition', () => {
  it('escreve uma regra nova apontando para o destino', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  30": ---> SX\n'
    const result = applyEdits(text, createTransition(text, estado(text, 2), 1))

    expect(result).toContain('  5": ---> S1')
    expect(erros(result)).toEqual(erros(text))
  })

  it('aponta para "fica aqui" quando o destino é SX', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> SX\n'
    const result = applyEdits(text, createTransition(text, estado(text, 1), 'SX'))

    expect(result).toContain('  5": ---> SX')
  })
})

describe('insertStateInTransition', () => {
  it('põe o estado novo no meio: a origem passa a apontar para ele, e ele para o destino antigo', () => {
    const text = 'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  30": ---> SX\n'
    const program = parseProgram(text)
    const stateSet = program.stateSets[0]!
    const target = stateSet.states[0]!.statements[0]!.segments[0]!.target!

    const { edits, index } = insertStateInTransition(text, stateSet, target, { papel: 'timeout' })
    const result = applyEdits(text, edits)

    expect(index).toBe(3)
    expect(result).toContain('#START: ---> S3') // origem desviada
    expect(result).toContain('\\@papel: timeout')
    expect(estado(result, 3).statements).toHaveLength(1)
    // O estado novo continua o caminho até onde a transição ia antes.
    expect(estado(result, 3).statements[0]!.segments[0]!.target!.state).toBe(2)
    expect(erros(result)).toEqual(erros(text))
  })
})

describe('expandPulse', () => {
  const base =
    '^Alavanca = 1\n^Pelota = 2\n\nS.S.1,\nS1, \\@nome: Espera\n' +
    '  #R^Alavanca: ADD A ---> S2\nS2, \\@nome: Fim\n  30": ---> SX\n'

  /** Troca o `ADD A` da regra de S1 por um "ligar por um tempo". */
  function comPulso(text: string, params: Record<string, string>) {
    const state = estado(text, 1)
    const statement = state.statements[0]!
    const { graph } = decompileStatement(statement)
    const acao = Object.values(graph.nodes).find((n) => n.kind === 'action')!
    return {
      state,
      statement,
      graph: {
        ...graph,
        nodes: { ...graph.nodes, [acao.id]: { ...acao, spec: 'pulsar', params } },
      },
      pulsoId: acao.id,
    }
  }

  it('cria o estado auxiliar marcado e aponta a regra para ele', () => {
    const stateSet = parseProgram(base).stateSets[0]!
    const { state, statement, graph, pulsoId } = comPulso(base, {
      dispositivo: '^Pelota',
      duracao: '0.05',
    })

    const { edits, index } = expandPulse(base, stateSet, state, statement, graph, pulsoId)
    const result = applyEdits(base, edits)

    expect(index).toBe(3)
    expect(result).toContain('#R^Alavanca: ON ^Pelota ---> S3') // a regra desvia para o auxiliar
    const aux = estado(result, 3)
    expect(foldablePulse(aux)).toEqual({ dispositivo: '^Pelota', duracao: '0.05' })
    // O auxiliar continua o caminho até onde a regra ia antes.
    expect(aux.statements[0]!.segments[0]!.target!.state).toBe(2)
    expect(erros(result)).toEqual(erros(base))
  })

  it('destino SX faz o auxiliar voltar ao próprio estado', () => {
    const text = '^Alavanca = 1\n^Pelota = 2\n\nS.S.1,\nS1,\n  #R^Alavanca: ADD A ---> SX\n'
    const stateSet = parseProgram(text).stateSets[0]!
    const { state, statement, graph, pulsoId } = comPulso(text, {
      dispositivo: '^Pelota',
      duracao: '0.05',
    })

    const result = applyEdits(text, expandPulse(text, stateSet, state, statement, graph, pulsoId).edits)
    expect(estado(result, 2).statements[0]!.segments[0]!.target!.state).toBe(1)
  })

  it('as duas edições convivem no mesmo lote, mesmo sem quebra de linha no fim', () => {
    // Aqui a âncora da regra e a do estado auxiliar coincidem — duas inserções
    // puras no mesmo offset seriam recusadas pelo lote.
    const text = '^Alavanca = 1\n^Pelota = 2\n\nS.S.1,\nS1,\n  #R^Alavanca: ADD A ---> SX'
    const stateSet = parseProgram(text).stateSets[0]!
    const { state, statement, graph, pulsoId } = comPulso(text, {
      dispositivo: '^Pelota',
      duracao: '0.05',
    })

    const edits = expandPulse(text, stateSet, state, statement, graph, pulsoId).edits
    expect(() => applyEdits(text, edits)).not.toThrow()
  })

  it('recusa quando falta preencher o pulso, quando é em minutos, ou quando há decisão no caminho', () => {
    const stateSet = parseProgram(base).stateSets[0]!
    const vazio = comPulso(base, { duracao: '0.05' })
    expect(() =>
      expandPulse(base, stateSet, vazio.state, vazio.statement, vazio.graph, vazio.pulsoId),
    ).toThrow(CompileError)

    const minutos = comPulso(base, { dispositivo: '^Pelota', duracao: '2', unidade: 'min' })
    expect(() =>
      expandPulse(base, stateSet, minutos.state, minutos.statement, minutos.graph, minutos.pulsoId),
    ).toThrow(/segundos/)

    // Decisão entre o pulso e o destino: cada ramo exigiria seu próprio auxiliar.
    const comIf = comPulso(base, { dispositivo: '^Pelota', duracao: '0.05' })
    const decisao = {
      kind: 'decision' as const,
      id: 'd9',
      left: 'A',
      operator: '>=',
      right: '5',
      whenTrue: null,
      whenFalse: null,
    }
    const grafoComIf = {
      ...comIf.graph,
      nodes: {
        ...comIf.graph.nodes,
        d9: decisao,
        [comIf.pulsoId]: { ...comIf.graph.nodes[comIf.pulsoId]!, next: 'd9' },
      },
    }
    expect(() =>
      expandPulse(base, stateSet, comIf.state, comIf.statement, grafoComIf, comIf.pulsoId),
    ).toThrow(/decisão/)
  })
})

describe('deletePulseState', () => {
  it('religa quem apontava para o auxiliar e o apaga', () => {
    const text =
      '^Pelota = 2\n\nS.S.1,\nS1,\n  #START: ON ^Pelota ---> S2\n' +
      'S2, \\@macro: pulso ^Pelota 0.05\n  0.05": OFF ^Pelota ---> S3\nS3,\n  30": ---> S1\n'
    const stateSet = parseProgram(text).stateSets[0]!
    const aux = estado(text, 2)

    const result = applyEdits(text, deletePulseState(stateSet, aux)!)
    expect(result).toContain('#START: ON ^Pelota ---> S3')
    expect(estado(result, 3)).toBeTruthy()
    expect(parseProgram(result).stateSets[0]!.states.map((s) => s.index)).toEqual([1, 3])
    expect(erros(result)).toEqual(erros(text))
  })

  it('devolve null quando o auxiliar foi editado à mão', () => {
    const text =
      'S.S.1,\nS1,\n  #START: ON ^Pelota ---> S2\n' +
      'S2, \\@macro: pulso ^Pelota 0.05\n  0.05": OFF ^Outro ---> S1\n'
    const stateSet = parseProgram(text).stateSets[0]!
    expect(deletePulseState(stateSet, estado(text, 2))).toBeNull()
  })
})

describe('propriedade: mutações não corrompem nenhuma fixture', () => {
  it.each(fixtures)('$name: inserir uma regra e apagá-la devolve o arquivo idêntico', ({ text }) => {
    const state = parseProgram(text).stateSets[0]?.states[0]
    if (!state) return

    const comRegra = applyEdits(text, insertStatement(text, state, transitionRule('SX')))
    const nova = parseProgram(comRegra).stateSets[0]!.states[0]!
    const ultima = nova.statements[nova.statements.length - 1]!

    expect(applyEdits(comRegra, deleteStatement(comRegra, ultima))).toBe(text)
  })

  it.each(fixtures)('$name: inserir uma regra não cria erro de validação novo', ({ text }) => {
    const state = parseProgram(text).stateSets[0]?.states[0]
    if (!state) return

    const comRegra = applyEdits(text, insertStatement(text, state, transitionRule('SX')))
    expect(erros(comRegra)).toEqual(erros(text))
  })
})

describe('propriedade: mutações antigas não corrompem nenhuma fixture', () => {
  it.each(fixtures)('$name: mover, renomear e excluir um estado real continuam válidos', ({ text }) => {
    const program = parseProgram(text)
    const stateSet = program.stateSets[0]
    if (!stateSet || stateSet.states.length === 0) return
    const state = stateSet.states[0]!

    for (const edits of [
      setStatePosition(state, { x: 42, y: 42 }),
      renameState(state, 'Renomeado'),
    ]) {
      const result = applyEdits(text, edits)
      expect(() => parseProgram(result)).not.toThrow()
      // Fora do span editado, o arquivo é idêntico byte a byte.
      const [start, end] = edits[0]!.span
      expect(result.slice(0, start)).toBe(text.slice(0, start))
      expect(result.slice(result.length - (text.length - end))).toBe(text.slice(end))
    }

    const delEdits = deleteState(state)
    const afterDelete = applyEdits(text, delEdits)
    expect(() => parseProgram(afterDelete)).not.toThrow()
  })

  it.each(fixtures)('$name: criar estado e processo continuam válidos', ({ text }) => {
    const program = parseProgram(text)
    const stateSet = program.stateSets[0]
    if (!stateSet) return

    const { edits: stateEdits, index: novoIndice } = createState(stateSet, text)
    const afterState = applyEdits(text, stateEdits)
    const reparsedState = parseProgram(afterState)
    expect(findIndices(reparsedState, stateSet.index)).toContain(novoIndice)

    const { edits: processEdits, index: novoProcesso } = createProcess(program, text)
    const afterProcess = applyEdits(text, processEdits)
    const reparsedProcess = parseProgram(afterProcess)
    expect(reparsedProcess.stateSets.map((s) => s.index)).toContain(novoProcesso)
  })
})

function findIndices(program: ReturnType<typeof parseProgram>, stateSetIndex: number): number[] {
  return (
    program.stateSets.find((s) => s.index === stateSetIndex)?.states.map((s) => s.index) ?? []
  )
}
