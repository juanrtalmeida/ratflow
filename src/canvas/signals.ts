import type { Program } from '../core/ast.ts'
import { eachCommand, eachStatement } from '../core/walk.ts'

/**
 * Onde um sinal `Z` é usado. Um sinal é broadcast — qualquer processo com um
 * gatilho `#Zn` recebe, não só um destino escolhido — então o que se pode
 * mostrar é "quem avisa" e "quem espera", não uma seta 1-para-1.
 */
export interface SignalUse {
  readonly stateSetIndex: number
  readonly stateIndex: number
}

export interface SignalMap {
  readonly number: number
  readonly emits: readonly SignalUse[]
  readonly waits: readonly SignalUse[]
}

/** Lista, por número de sinal, quem avisa (`Z1`) e quem espera (`#Z1`) — para o painel "como os processos conversam". */
export function collectSignals(program: Program): SignalMap[] {
  const emits = new Map<number, SignalUse[]>()
  const waits = new Map<number, SignalUse[]>()

  const push = (map: Map<number, SignalUse[]>, n: number, use: SignalUse) => {
    const list = map.get(n)
    if (list) list.push(use)
    else map.set(n, [use])
  }

  for (const { stateSet, state, command } of eachCommand(program)) {
    if (command.parsed?.kind === 'signal') {
      push(emits, command.parsed.number, {
        stateSetIndex: stateSet.index,
        stateIndex: state.index,
      })
    }
  }

  for (const { stateSet, state, statement } of eachStatement(program)) {
    const trigger = statement.trigger.parsed
    if (trigger?.kind === 'signal') {
      push(waits, trigger.number, {
        stateSetIndex: stateSet.index,
        stateIndex: state.index,
      })
    }
  }

  const numbers = new Set([...emits.keys(), ...waits.keys()])
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => ({
      number,
      emits: emits.get(number) ?? [],
      waits: waits.get(number) ?? [],
    }))
}
