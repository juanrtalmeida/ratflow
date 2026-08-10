import { describe, expect, it } from 'vitest'
import { parseProgram } from '../parser.ts'
import { Clock } from './clock.ts'
import { Machine } from './machine.ts'

describe('Clock.step', () => {
  it('avança a máquina o número de ticks pedido e notifica uma vez', () => {
    const program = parseProgram('S.S.1,\nS1,\n  #START: ---> S2\nS2,\n  .05": ---> SX\n')
    const machine = new Machine(program)
    const clock = new Clock(machine)

    let notificacoes = 0
    clock.onTick = () => notificacoes++

    clock.step(5)

    expect(machine.snapshot().tick).toBe(5)
    expect(notificacoes).toBe(1)
  })

  it('chama onBeforeTick antes de cada tick, não só uma vez', () => {
    const program = parseProgram('S.S.1,\nS1,\n  #R^X: ---> SX\n')
    const machine = new Machine(program)
    const clock = new Clock(machine)

    let chamadas = 0
    clock.onBeforeTick = () => chamadas++

    clock.step(3)
    expect(chamadas).toBe(3)
  })

  it('não está "rodando" antes de play() nem depois de pause()', () => {
    const program = parseProgram('S.S.1,\nS1,\n  #START: ---> SX\n')
    const clock = new Clock(new Machine(program))
    expect(clock.running).toBe(false)
    clock.pause() // idempotente mesmo sem estar rodando
    expect(clock.running).toBe(false)
  })
})
