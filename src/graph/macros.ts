import type { State } from '../core/ast.ts'

/**
 * Ações compostas.
 *
 * "Ligar o dispensador por 0,05 s" é natural para quem monta o protocolo, mas
 * não existe como comando único no MedState: é preciso um `ON` aqui e um estado
 * auxiliar que faça `OFF` depois do tempo. O compilador expande a macro e marca
 * o estado gerado com `\@macro:`, para que o descompilador consiga dobrá-lo de
 * volta em um único nó.
 *
 * Se alguém editar o arquivo fora do editor e a marca sumir, a degradação é
 * suave: o estado auxiliar aparece como um estado comum no canvas. Fica mais
 * verboso, mas nada quebra — que é o comportamento certo para um formato que
 * circula entre laboratórios.
 */

export interface PulseMacro {
  /** Operando MedState do dispositivo: `^Pelota`. */
  readonly dispositivo: string
  /** Duração em segundos, como texto: `0.05`. */
  readonly duracao: string
}

const PULSE_PREFIX = 'pulso'

export function pulseMacroMeta(macro: PulseMacro): string {
  return `${PULSE_PREFIX} ${macro.dispositivo} ${macro.duracao}`
}

export function parsePulseMacro(meta: string | undefined): PulseMacro | null {
  if (!meta) return null
  const match = new RegExp(`^${PULSE_PREFIX}\\s+(\\S+)\\s+([\\d.]+)$`).exec(
    meta.trim(),
  )
  if (!match) return null
  return { dispositivo: match[1]!, duracao: match[2]! }
}

/** O estado é um auxiliar gerado por "ligar por um tempo"? */
export function pulseMacroOf(state: State): PulseMacro | null {
  return parsePulseMacro(state.meta.macro)
}

export interface PulseStateSpec {
  readonly index: number
  readonly macro: PulseMacro
  /** Para onde o programa vai depois de desligar o dispositivo. */
  readonly destino: number | 'SX'
}

/**
 * Escreve o estado auxiliar de um pulso. O nome amigável e a marca de macro vão
 * no mesmo comentário do cabeçalho, para que o arquivo continue autoexplicativo.
 */
export function printPulseState(
  spec: PulseStateSpec,
  indent = '  ',
  newline = '\n',
): string {
  const destino = spec.destino === 'SX' ? 'SX' : `S${spec.destino}`
  const cabecalho =
    `S${spec.index}, \\@nome: Pulso de ${spec.macro.dispositivo} ` +
    `\\@papel: reforco \\@macro: ${pulseMacroMeta(spec.macro)}`
  const regra = `${indent}${spec.macro.duracao}": OFF ${spec.macro.dispositivo} ---> ${destino}`
  return `${cabecalho}${newline}${regra}`
}

/**
 * Confere que o estado auxiliar continua tendo a forma que a macro promete —
 * um único gatilho de tempo que desliga o dispositivo e segue adiante.
 *
 * Se alguém editou o estado à mão, a macro deixa de valer e o canvas volta a
 * mostrá-lo como estado comum, em vez de esconder uma edição do usuário.
 */
export function pulseStateIsIntact(state: State, macro: PulseMacro): boolean {
  if (state.statements.length !== 1) return false
  const statement = state.statements[0]!

  const trigger = statement.trigger.parsed
  if (trigger?.kind !== 'time' || trigger.unit !== 's') return false
  if (Number(trigger.amount.name) !== Number(macro.duracao)) return false

  if (statement.segments.length !== 1) return false
  const segmento = statement.segments[0]!
  if (segmento.commands.length !== 1) return false

  const comando = segmento.commands[0]!.parsed
  if (comando?.kind !== 'port' || comando.op !== 'OFF') return false
  if (comando.ports.length !== 1) return false

  const porta = comando.ports[0]!
  const escrito = porta.type === 'constant' ? `^${porta.name}` : porta.name
  return escrito === macro.dispositivo
}

/** Estado auxiliar que pode ser dobrado de volta em um único nó "pulsar". */
export function foldablePulse(state: State): PulseMacro | null {
  const macro = pulseMacroOf(state)
  if (!macro) return null
  return pulseStateIsIntact(state, macro) ? macro : null
}
