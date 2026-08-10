import { describe, expect, it } from 'vitest'
import { loadFixtures } from '../__fixtures.ts'
import { parseProgram } from '../parser.ts'
import { Machine } from './machine.ts'

const fixtures = loadFixtures()
const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!

describe('Machine — FR5 (critério de aceitação do plano)', () => {
  it('liga a luz e vai para "Esperando resposta" assim que a sessão começa', () => {
    const m = new Machine(parseProgram(fr5.text))
    expect(m.isPortOn('LuzCasa')).toBe(true)
    expect(m.snapshot().currentStates.get(1)).toBe(2)
  })

  it('reforça exatamente a cada 5 respostas na alavanca, nem antes nem depois', () => {
    const m = new Machine(parseProgram(fr5.text))

    for (let i = 1; i <= 4; i++) {
      m.respond('Alavanca')
      m.tick()
      expect(m.isPortOn('Pelota')).toBe(false)
      expect(m.snapshot().currentStates.get(1)).toBe(2)
      expect(m.variableValue('A')).toBe(i)
    }

    m.respond('Alavanca')
    m.tick()

    expect(m.isPortOn('Pelota')).toBe(true)
    expect(m.snapshot().currentStates.get(1)).toBe(3)
    expect(m.variableValue('A')).toBe(0) // SET A = 0 no ramo @Reforco
    expect(m.variableValue('B')).toBe(1) // ADD B (Reforcos)
  })

  it('desliga a pelota depois de exatamente 0,05 s (5 ticks) em Reforço', () => {
    const m = new Machine(parseProgram(fr5.text))
    for (let i = 0; i < 5; i++) {
      m.respond('Alavanca')
      m.tick()
    }
    expect(m.snapshot().currentStates.get(1)).toBe(3)
    expect(m.isPortOn('Pelota')).toBe(true)

    for (let i = 0; i < 4; i++) {
      m.tick()
      expect(m.isPortOn('Pelota')).toBe(true)
      expect(m.snapshot().currentStates.get(1)).toBe(3)
    }

    m.tick() // 5º tick em Reforço: 0,05 s completos
    expect(m.isPortOn('Pelota')).toBe(false)
    expect(m.snapshot().currentStates.get(1)).toBe(4) // Intervalo
  })

  it('a alavanca não faz nada fora do estado que a escuta', () => {
    const m = new Machine(parseProgram(fr5.text))
    for (let i = 0; i < 5; i++) {
      m.respond('Alavanca')
      m.tick()
    }
    expect(m.snapshot().currentStates.get(1)).toBe(3) // Reforço não escuta a alavanca

    m.respond('Alavanca')
    m.tick()
    expect(m.variableValue('A')).toBe(0) // não deveria ter contado essa resposta
  })

  it('um sinal Z emitido por um processo chega ao gatilho #Z do outro no tick seguinte', () => {
    const text =
      'S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  #Z1: ---> S3\nS3,\n  1": ---> SX\nS.S.2,\nS1,\n  #START: ---> S2\nS2,\n  .01": Z1 ---> S3\nS3,\n  1": ---> SX\n'
    const m = new Machine(parseProgram(text))

    m.tick() // .01" (1 tick) no processo 2: dispara Z1
    expect(m.log.some((e) => e.stateSetIndex === 2 && e.kind === 'sinal')).toBe(true)
    expect(m.snapshot().currentStates.get(1)).toBe(2) // processo 1 ainda não recebeu

    m.tick() // no tick seguinte, o processo 1 recebe o sinal e sai de S2
    expect(m.snapshot().currentStates.get(1)).toBe(3)
  })

  it('nunca lança em nenhuma fixture, mesmo as reais e cheias de construção não modelada', () => {
    for (const fixture of fixtures) {
      const program = parseProgram(fixture.text)
      const m = new Machine(program)
      expect(() => {
        for (let i = 0; i < 200; i++) m.tick()
      }, fixture.name).not.toThrow()
    }
  })

  it('degrada para aviso, não trava, quando um comando não é simulável (ex.: RANDD)', () => {
    const text =
      'S.S.1,\nS1,\n  #START: RANDD B = M ---> S2\nS2,\n  1": ---> SX\n'
    const m = new Machine(parseProgram(text))
    expect(m.log.some((e) => e.kind === 'aviso')).toBe(true)
    expect(m.snapshot().currentStates.get(1)).toBe(2) // mesmo sem simular o RANDD, a transição acontece
  })
})
