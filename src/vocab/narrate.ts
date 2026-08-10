import type {
  Command,
  Operand,
  Program,
  Segment,
  State,
  StateSet,
  Statement,
  Target,
  Trigger,
} from '../core/ast.ts'
import { stateLabel } from '../core/ast.ts'
import { buildIndex } from '../core/validate/index.ts'
import { deviceByConstant, type HardwareProfile } from './profile.ts'
import { EMPTY_PROFILE } from './profile.ts'

/**
 * Narrador: transforma a AST em português.
 *
 * É o motor de toda a camada didática — alimenta os rótulos das arestas, os
 * cartões dos nós, os tooltips, o gutter do editor de código e a folha de
 * protocolo. Manter a tradução num só lugar garante que as várias telas contem
 * a mesma história.
 */

const OPERADORES: Record<string, string> = {
  '>=': 'for pelo menos',
  '>': 'for maior que',
  '<=': 'for no máximo',
  '<': 'for menor que',
  '=': 'for igual a',
  '<>': 'for diferente de',
}

function numero(valor: string): string {
  // ".01" sem zero à esquerda (comum em arquivos reais) vira "0,01", não ",01".
  const normalizado = valor.startsWith('.') ? `0${valor}` : valor
  return normalizado.replace('.', ',')
}

function juntar(partes: readonly string[]): string {
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]!
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

export interface Narrator {
  /** "o sujeito pressionar a Alavanca esquerda" */
  trigger(trigger: Trigger): string
  /** Forma curta para rótulo de aresta: "🖐 Alavanca esquerda", "⏱ 30 s". */
  triggerShort(trigger: Trigger): string
  /** "somar 1 a «Respostas»" */
  command(command: Command): string
  /** "ir para «Reforço»" / "ficar aqui" */
  target(target: Target | null, stateSet?: StateSet): string
  /** Frase completa da regra. */
  statement(statement: Statement, stateSet?: StateSet): string
  /** Resumo do estado: o que está ligado e quantas regras existem. */
  state(state: State): string
  /** Nome legível de um operando (dispositivo, contador, número). */
  operand(operand: Operand): string
}

export function createNarrator(
  program: Program,
  profile: HardwareProfile = EMPTY_PROFILE,
): Narrator {
  const index = buildIndex(program)

  /** Nome do contador: apelido do `VAR_ALIAS` quando existir. */
  const variavel = (nome: string): string => {
    const apelido = index.aliasOf.get(nome)
    return apelido ? `«${apelido}»` : `«${nome}»`
  }

  /** Nome do dispositivo, com ícone, quando a constante estiver no perfil. */
  const dispositivo = (nome: string): string => {
    const device = deviceByConstant(profile, nome)
    if (device) return `${device.icon} ${device.label}`
    return `«${nome}»`
  }

  const operand = (operand: Operand): string => {
    switch (operand.type) {
      case 'constant':
        return dispositivo(operand.name)
      case 'variable':
        return variavel(operand.name)
      case 'element':
        return `${variavel(operand.name)} na posição ${operand.index}`
      case 'number':
        return numero(operand.name)
      default:
        return operand.raw
    }
  }

  /** Valor por extenso quando a constante é um parâmetro, não uma porta. */
  const valorDeConstante = (nome: string): string => {
    const definicao = index.constants.get(nome)
    return definicao ? `«${nome}» (${numero(definicao.value)})` : `«${nome}»`
  }

  const tempo = (amount: Operand, unit: 's' | 'min'): string => {
    const singular = unit === 's' ? 'segundo' : 'minuto'
    const plural = unit === 's' ? 'segundos' : 'minutos'

    if (amount.type === 'number') {
      // Em português, quantidades menores que dois vão para o singular:
      // "0,05 segundo", "1 segundo", "1,5 segundo", mas "30 segundos".
      const valor = Number(amount.name)
      const usaSingular = valor > 0 && valor < 2
      return `${numero(amount.name)} ${usaSingular ? singular : plural}`
    }
    if (amount.type === 'constant') {
      return `${valorDeConstante(amount.name)} ${plural}`
    }
    return `${operand(amount)} ${plural}`
  }

  /**
   * Como `tempo`, mas sem repetir o nome da constante ao lado do valor — é o
   * que cabe no rótulo curto de uma aresta do canvas. "60 minutos", não
   * "«DuracaoSessao» (60) minutos".
   */
  const tempoCurto = (amount: Operand, unit: 's' | 'min'): string => {
    if (amount.type !== 'constant') return tempo(amount, unit)
    const definicao = index.constants.get(amount.name)
    if (!definicao) return tempo(amount, unit)
    return tempo({ ...amount, type: 'number', name: definicao.value }, unit)
  }

  const trigger = (trigger: Trigger): string => {
    const detail = trigger.parsed
    if (!detail) return `acontecer \`${trigger.raw}\``

    switch (detail.kind) {
      case 'start':
        return 'a sessão começar'
      case 'response': {
        if (detail.port.type === 'constant') {
          const device = deviceByConstant(profile, detail.port.name)
          if (device?.kind === 'entrada') {
            const tipo = device.label
            return `o sujeito responder em ${device.icon} ${tipo}`
          }
          return `houver resposta em ${dispositivo(detail.port.name)}`
        }
        return `houver resposta na entrada ${detail.channel}${detail.port.name}`
      }
      case 'signal':
        return `chegar o sinal ${detail.number} de outro processo`
      case 'time':
        return `passarem ${tempo(detail.amount, detail.unit)}`
    }
  }

  const triggerShort = (t: Trigger): string => {
    const detail = t.parsed
    if (!detail) return t.raw

    switch (detail.kind) {
      case 'start':
        return '▶ início da sessão'
      case 'response': {
        if (detail.port.type === 'constant') {
          const device = deviceByConstant(profile, detail.port.name)
          if (device) return `${device.icon} ${device.label}`
          return `🎚 ${detail.port.name}`
        }
        return `🎚 entrada ${detail.channel}${detail.port.name}`
      }
      case 'signal':
        return `📩 sinal ${detail.number}`
      case 'time':
        return `⏱ ${tempoCurto(detail.amount, detail.unit)}`
    }
  }

  const condicao = (
    left: Operand | null,
    op: string | null,
    right: Operand | null,
    raw: string,
  ): string => {
    if (!left || !op || !right) return `\`${raw}\``
    const verbo = OPERADORES[op] ?? `for ${op}`
    const direita =
      right.type === 'constant' ? valorDeConstante(right.name) : operand(right)
    return `${operand(left)} ${verbo} ${direita}`
  }

  const command = (command: Command): string => {
    const detail = command.parsed
    if (!detail) return `\`${command.raw}\``

    switch (detail.kind) {
      case 'port': {
        const alvos = juntar(detail.ports.map((p) => dispositivo(p.name)))
        if (detail.op === 'ON') return `ligar ${alvos}`
        if (detail.op === 'OFF') return `desligar ${alvos}`
        if (detail.op === 'LOCKON') return `travar ${alvos} ligado`
        return `travar ${alvos} desligado`
      }
      case 'counter':
        return detail.op === 'ADD'
          ? `somar 1 a ${operand(detail.target)}`
          : `subtrair 1 de ${operand(detail.target)}`
      case 'set':
        return juntar(
          detail.assignments.map(
            (a) => `definir ${operand(a.target)} como ${numero(a.value)}`,
          ),
        )
      case 'show':
        return juntar(
          detail.items.map((i) => `registrar ${operand(i.value)} como "${i.label}"`),
        )
      case 'signal':
        return `avisar os outros processos com o sinal ${detail.number}`
      case 'if': {
        const c = detail.condition
        return `se ${condicao(c.left, c.operator, c.right, c.raw)}`
      }
    }
  }

  const target = (target: Target | null, stateSet?: StateSet): string => {
    if (!target) return 'continuar aqui'
    if (target.state === 'SX') return 'ficar aqui'
    if (typeof target.state === 'number') {
      const destino = stateSet?.states.find((s) => s.index === target.state)
      return destino ? `ir para «${stateLabel(destino)}»` : `ir para S${target.state}`
    }
    return `seguir para \`${target.raw}\``
  }

  /** Ações e destino de um segmento, na ordem em que acontecem. */
  const corpoDoSegmento = (segment: Segment, stateSet?: StateSet): string => {
    const acoes = segment.commands
      .filter((c) => c.parsed?.kind !== 'if')
      .map(command)
    const partes = [...acoes]
    if (segment.target) partes.push(target(segment.target, stateSet))
    return partes.length > 0 ? juntar(partes) : 'não fazer nada'
  }

  const statement = (statement: Statement, stateSet?: StateSet): string => {
    const quando = `Quando ${trigger(statement.trigger)}`
    const primeiro = statement.segments[0]
    if (!primeiro) return `${quando}, nada acontece.`

    const decisao = primeiro.commands.find((c) => c.parsed?.kind === 'if')
    const corpo = corpoDoSegmento(primeiro, stateSet)

    if (!decisao || decisao.parsed?.kind !== 'if') {
      return `${quando}, ${corpo}.`
    }

    const { thenLabel, elseLabel } = decisao.parsed
    const ramo = (label: string | null): string | null => {
      if (label === null) return null
      const segmento = statement.segments.find((s) => s.label === label)
      return segmento ? corpoDoSegmento(segmento, stateSet) : null
    }

    const acoesAntes = primeiro.commands
      .filter((c) => c.parsed?.kind !== 'if')
      .map(command)
    const prefixo =
      acoesAntes.length > 0 ? `${quando}, ${juntar(acoesAntes)}.` : `${quando}.`

    const seVerdadeiro = ramo(thenLabel) ?? 'seguir pelo caminho verdadeiro'
    const seFalso = ramo(elseLabel)
    const teste = command(decisao)

    return seFalso
      ? `${prefixo} Então, ${teste}, ${seVerdadeiro}; senão, ${seFalso}.`
      : `${prefixo} Então, ${teste}, ${seVerdadeiro}.`
  }

  const state = (state: State): string => {
    const ligados = new Set<string>()
    for (const s of state.statements) {
      for (const segment of s.segments) {
        for (const c of segment.commands) {
          if (c.parsed?.kind === 'port' && c.parsed.op === 'ON') {
            for (const porta of c.parsed.ports) ligados.add(dispositivo(porta.name))
          }
        }
      }
    }

    const regras =
      state.statements.length === 1 ? '1 regra' : `${state.statements.length} regras`
    if (ligados.size === 0) return regras
    return `${regras} · liga ${juntar([...ligados])}`
  }

  return { trigger, triggerShort, command, target, statement, state, operand }
}
