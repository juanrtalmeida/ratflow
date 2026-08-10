import { describe, expect, it } from 'vitest'
import { loadFixtures } from '../core/__fixtures.ts'
import { parseProgram } from '../core/parser.ts'
import { collectSignals } from './signals.ts'

const fr5 = loadFixtures().find((f) => f.name === 'fr5-sintetico.MPC')!

describe('collectSignals', () => {
  it('agrupa quem avisa e quem espera cada sinal Z', () => {
    const program = parseProgram(fr5.text)
    const signals = collectSignals(program)

    expect(signals).toHaveLength(1)
    expect(signals[0]!.number).toBe(1)
    expect(signals[0]!.emits).toEqual([{ stateSetIndex: 2, stateIndex: 2 }])
    expect(signals[0]!.waits).toEqual([{ stateSetIndex: 2, stateIndex: 3 }])
  })

  it('devolve lista vazia quando não há sinais no programa', () => {
    const program = parseProgram('S.S.1,\nS1,\n  #START: ---> SX\n')
    expect(collectSignals(program)).toEqual([])
  })
})
