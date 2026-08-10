import {
  findState,
  type Command,
  type Condition,
  type Operand,
  type Program,
  type Segment,
  type StateSet,
  type Statement,
  type Target,
} from '../ast.ts'
import { buildIndex } from '../validate/index.ts'
import { evalExpression, type Ref } from './expr.ts'

/**
 * Interpretador da AST — o núcleo do simulador. Todos os processos avançam
 * em paralelo, um passo (`tick`) de cada vez. É uma **aproximação para
 * depurar lógica**, não um emulador fiel de timing: um tick vale 0,01 s
 * simulado, não 0,01 s de relógio real (isso é trabalho do `clock.ts`, que
 * fica em cima desta classe).
 *
 * Construção não reconhecida pelo parser (gatilho ou comando com
 * `parsed: null`, `RANDD`/`RANDI` não modelados) não trava a simulação —
 * vira um evento de aviso no log e é simplesmente pulada. O mesmo princípio
 * de "nunca quebra" do resto do projeto, aplicado à execução.
 */

export const TICK_SECONDS = 0.01

export type SimEventKind = 'transicao' | 'porta' | 'registro' | 'sinal' | 'aviso'

export interface SimEvent {
  readonly tick: number
  readonly stateSetIndex: number
  readonly kind: SimEventKind
  readonly message: string
}

export interface Snapshot {
  readonly tick: number
  readonly timeSeconds: number
  /** Processo → índice do estado atual. */
  readonly currentStates: ReadonlyMap<number, number>
  /** Nomes de constante (dispositivo) atualmente ligados. */
  readonly ports: ReadonlySet<string>
  readonly variables: ReadonlyMap<string, ReadonlyMap<number, number>>
  readonly log: readonly SimEvent[]
  /** Processos que pararam de avançar (alvo inexistente/não simulável). */
  readonly ended: ReadonlySet<number>
}

export interface MachineOptions {
  /** Semente do gerador pseudoaleatório — mesma semente, mesma sessão. */
  readonly seed?: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Machine {
  readonly program: Program
  readonly rng: () => number

  private tickCount = 0
  private currentState = new Map<number, number>()
  private ticksInState = new Map<number, number>()
  private vars = new Map<string, Map<number, number>>()
  private constants = new Map<string, number>()
  private ports = new Set<string>()
  private lockedOn = new Set<string>()
  private lockedOff = new Set<string>()
  private pendingResponses = new Set<string>()
  private signalsThisTick = new Set<number>()
  private signalsEmitted = new Set<number>()
  private ended = new Set<number>()
  private events: SimEvent[] = []

  constructor(program: Program, opts: MachineOptions = {}) {
    this.program = program
    this.rng = mulberry32(opts.seed ?? 1)

    const index = buildIndex(program)
    for (const [name, def] of index.constants) {
      const n = Number(def.value)
      if (Number.isFinite(n)) this.constants.set(name, n)
    }

    for (const stateSet of program.stateSets) {
      const first = stateSet.states[0]
      this.currentState.set(stateSet.index, first?.index ?? 1)
      this.ticksInState.set(stateSet.index, 0)
    }

    this.runStartTriggers()
  }

  // -------------------------------------------------------------- consulta

  get log(): readonly SimEvent[] {
    return this.events
  }

  snapshot(): Snapshot {
    return {
      tick: this.tickCount,
      timeSeconds: this.tickCount * TICK_SECONDS,
      currentStates: new Map(this.currentState),
      ports: new Set(this.ports),
      variables: new Map([...this.vars].map(([k, v]) => [k, new Map(v)])),
      log: this.events,
      ended: new Set(this.ended),
    }
  }

  isPortOn(constante: string): boolean {
    return this.ports.has(constante)
  }

  variableValue(name: string, index = 0): number {
    return this.vars.get(name)?.get(index) ?? 0
  }

  // -------------------------------------------------------------- entrada

  /** Uma resposta do "sujeito" (clique na caixa virtual) — considerada no próximo `tick()`. */
  respond(deviceConstante: string): void {
    this.pendingResponses.add(deviceConstante)
  }

  /** Avança a simulação em um tick (0,01 s simulado). */
  tick(): void {
    this.tickCount++
    this.signalsThisTick = this.signalsEmitted
    this.signalsEmitted = new Set()

    for (const stateSet of this.program.stateSets) {
      this.stepProcess(stateSet)
    }

    this.pendingResponses.clear()
  }

  // --------------------------------------------------------------- núcleo

  /** Função estável (não recriada a cada chamada) — é o que `evalExpression` recebe como resolvedor. */
  private resolve = (ref: Ref): number => {
    if (ref.type === 'constant') return this.constants.get(ref.name) ?? 0
    return this.vars.get(ref.name)?.get(ref.index) ?? 0
  }

  private runStartTriggers(): void {
    for (const stateSet of this.program.stateSets) {
      const state = findState(stateSet, this.currentState.get(stateSet.index)!)
      if (!state) continue
      const statement = state.statements.find((s) => s.trigger.parsed?.kind === 'start')
      if (statement) this.executeStatement(stateSet, statement)
    }
  }

  private stepProcess(stateSet: StateSet): void {
    if (this.ended.has(stateSet.index)) return
    const state = findState(stateSet, this.currentState.get(stateSet.index)!)
    if (!state) {
      this.warn(stateSet.index, `O estado atual não existe mais no arquivo — processo parado.`)
      this.ended.add(stateSet.index)
      return
    }

    // Conta o tick atual como tempo decorrido neste estado ANTES de checar os
    // gatilhos de tempo — senão um temporizador de N ticks só dispara no
    // tick N+1 (o tempo "decorrido" só existiria depois do teste, não nele).
    const elapsed = (this.ticksInState.get(stateSet.index) ?? 0) + 1
    this.ticksInState.set(stateSet.index, elapsed)

    for (const statement of state.statements) {
      if (this.checkTrigger(statement, elapsed)) {
        this.executeStatement(stateSet, statement)
        return
      }
    }
  }

  private checkTrigger(statement: Statement, elapsedTicks: number): boolean {
    const detail = statement.trigger.parsed
    if (!detail) return false

    switch (detail.kind) {
      case 'start':
        return false // já disparado na construção
      case 'response':
        return this.pendingResponses.has(this.portKey(detail.port))
      case 'signal':
        return this.signalsThisTick.has(detail.number)
      case 'time': {
        const amount = this.resolveOperand(detail.amount)
        if (amount === null) return false
        const seconds = detail.unit === 's' ? amount : amount * 60
        const thresholdTicks = Math.round(seconds / TICK_SECONDS)
        return elapsedTicks >= thresholdTicks
      }
    }
  }

  private executeStatement(stateSet: StateSet, statement: Statement): void {
    const first = statement.segments[0]
    if (first) this.executeSegment(stateSet, statement, first)
  }

  private executeSegment(stateSet: StateSet, statement: Statement, segment: Segment): void {
    for (const command of segment.commands) {
      if (command.parsed?.kind === 'if') {
        const { condition, thenLabel, elseLabel } = command.parsed
        const label = this.evalCondition(condition) ? thenLabel : elseLabel
        if (label === null) return
        const alvo = statement.segments.find((s) => s.label === label)
        if (!alvo) {
          this.warn(stateSet.index, `O caminho "@${label}" não existe — parado aqui.`)
          return
        }
        this.executeSegment(stateSet, statement, alvo)
        return
      }
      this.executeCommand(stateSet, command)
    }
    if (segment.target) this.applyTarget(stateSet, segment.target)
  }

  private applyTarget(stateSet: StateSet, target: Target): void {
    if (target.state === 'SX') return // fica no mesmo estado; não reseta o tempo

    if (target.state === null || !findState(stateSet, target.state)) {
      this.warn(
        stateSet.index,
        `O destino "${target.raw}" não é um estado deste processo — parado aqui.`,
      )
      this.ended.add(stateSet.index)
      return
    }

    this.currentState.set(stateSet.index, target.state)
    this.ticksInState.set(stateSet.index, 0)
    this.emit(stateSet.index, 'transicao', `foi para S${target.state}`)
  }

  private executeCommand(stateSet: StateSet, command: Command): void {
    const detail = command.parsed
    if (!detail) {
      this.warn(stateSet.index, `Comando não simulado: "${command.raw}"`)
      return
    }

    switch (detail.kind) {
      case 'port': {
        const nomes: string[] = []
        for (const portOperand of detail.ports) {
          const key = this.portKey(portOperand)
          nomes.push(key)
          if (detail.op === 'ON') {
            this.ports.add(key)
          } else if (detail.op === 'OFF') {
            if (!this.lockedOn.has(key)) this.ports.delete(key)
          } else if (detail.op === 'LOCKON') {
            this.ports.add(key)
            this.lockedOn.add(key)
            this.lockedOff.delete(key)
          } else {
            this.ports.delete(key)
            this.lockedOff.add(key)
            this.lockedOn.delete(key)
          }
        }
        this.emit(stateSet.index, 'porta', `${detail.op} ${nomes.join(', ')}`)
        break
      }
      case 'counter': {
        const atual = this.resolveOperand(detail.target) ?? 0
        this.setVar(detail.target, atual + (detail.op === 'ADD' ? 1 : -1))
        break
      }
      case 'set': {
        for (const assignment of detail.assignments) {
          const valor = evalExpression(assignment.value, this.resolve)
          if (valor === null) {
            this.warn(stateSet.index, `Valor não simulado em SET: "${assignment.value}"`)
            continue
          }
          this.setVar(assignment.target, valor)
        }
        break
      }
      case 'show': {
        for (const item of detail.items) {
          const valor = this.resolveOperand(item.value)
          this.emit(stateSet.index, 'registro', `${item.label} = ${valor ?? '?'}`)
        }
        break
      }
      case 'signal': {
        this.signalsEmitted.add(detail.number)
        this.emit(stateSet.index, 'sinal', `avisou o sinal ${detail.number}`)
        break
      }
      case 'if':
        break // tratado em executeSegment
    }
  }

  private evalCondition(condition: Condition): boolean {
    if (!condition.left || !condition.operator || !condition.right) return false
    const left = this.resolveOperand(condition.left)
    const right = this.resolveOperand(condition.right)
    if (left === null || right === null) return false

    switch (condition.operator) {
      case '=':
        return left === right
      case '<>':
        return left !== right
      case '<':
        return left < right
      case '>':
        return left > right
      case '<=':
        return left <= right
      case '>=':
        return left >= right
      default:
        return false
    }
  }

  private resolveOperand(operand: Operand): number | null {
    switch (operand.type) {
      case 'number':
        return Number(operand.name)
      case 'variable':
        return this.resolve({ type: 'variable', name: operand.name, index: 0 })
      case 'constant':
        return this.resolve({ type: 'constant', name: operand.name, index: 0 })
      case 'element': {
        const idx = evalExpression(operand.index ?? '0', this.resolve)
        if (idx === null) return null
        return this.resolve({ type: 'variable', name: operand.name, index: Math.trunc(idx) })
      }
      default:
        return null
    }
  }

  private setVar(target: Operand, value: number): void {
    let index = 0
    if (target.type === 'element') {
      const idx = evalExpression(target.index ?? '0', this.resolve)
      index = idx === null ? 0 : Math.trunc(idx)
    }
    const map = this.vars.get(target.name) ?? new Map<number, number>()
    map.set(index, value)
    this.vars.set(target.name, map)
  }

  /** Chave estável para "esta porta": nome da constante, ou o número cru quando não há uma. */
  private portKey(operand: Operand): string {
    return operand.type === 'constant' ? operand.name : `#${operand.name}`
  }

  private emit(stateSetIndex: number, kind: SimEventKind, message: string): void {
    this.events.push({ tick: this.tickCount, stateSetIndex, kind, message })
  }

  private warn(stateSetIndex: number, message: string): void {
    this.emit(stateSetIndex, 'aviso', message)
  }
}
