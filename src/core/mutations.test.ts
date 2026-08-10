import { describe, expect, it } from 'vitest'
import { loadFixtures } from './__fixtures.ts'
import { applyEdits } from './edit.ts'
import {
  createDevice,
  createProcess,
  createState,
  deleteState,
  renameState,
  retargetTransition,
  setCounterAlias,
  setStatePosition,
} from './mutations.ts'
import { parseProgram } from './parser.ts'

const fixtures = loadFixtures()

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

describe('propriedade: mutações não corrompem nenhuma fixture', () => {
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
