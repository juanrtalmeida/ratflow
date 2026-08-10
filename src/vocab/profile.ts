import type { Program } from '../core/ast.ts'
import { eachCommand, eachStatement, portOperandsOf } from '../core/walk.ts'
import {
  deviceType,
  guessDeviceType,
  type DeviceKind,
  type DeviceType,
} from './devices.ts'

/**
 * Perfil de hardware: o mapa entre "porta 4" e "luz da casa". É definido uma vez
 * por projeto e é o que permite a interface inteira falar em nomes de
 * dispositivo em vez de números.
 *
 * No arquivo `.MPC`, cada vínculo vira uma constante nativa (`^LuzCasa = 4`),
 * de modo que o programa continua legível fora do editor.
 */

export interface DeviceBinding {
  /** A constante é a identidade do vínculo: é ela que aparece no `.MPC`. */
  readonly constante: string
  readonly typeId: string
  readonly label: string
  readonly icon: string
  readonly kind: DeviceKind
  readonly porta: number
}

export interface HardwareProfile {
  readonly id: string
  readonly label: string
  readonly descricao: string
  readonly devices: readonly DeviceBinding[]
}

function bind(typeId: string, porta: number, label?: string): DeviceBinding {
  const tipo = deviceType(typeId)
  if (!tipo) throw new Error(`Dispositivo desconhecido no preset: ${typeId}`)
  return {
    constante: tipo.constante,
    typeId: tipo.id,
    label: label ?? tipo.label,
    icon: tipo.icon,
    kind: tipo.kind,
    porta,
  }
}

export const PRESETS: readonly HardwareProfile[] = [
  {
    id: 'rato-2-alavancas',
    label: 'Câmara de rato · 2 alavancas',
    descricao:
      'Montagem clássica: duas alavancas, comedouro com detector de entrada, ' +
      'dispensador de pelota, luz da casa e alto-falante.',
    devices: [
      bind('alavanca-esq', 1),
      bind('alavanca-dir', 2),
      bind('bebedouro', 3),
      bind('pelota', 1),
      bind('luz-casa', 4),
      bind('tom', 5),
    ],
  },
  {
    id: 'camundongo-nose-poke',
    label: 'Câmara de camundongo · nose-poke',
    descricao:
      'Três buracos de focinho, comedouro, dispensador, luz da casa e luz de estímulo.',
    devices: [
      bind('poke-esq', 1),
      bind('poke-central', 2),
      bind('poke-dir', 3),
      bind('bebedouro', 4),
      bind('pelota', 1),
      bind('luz-casa', 4),
      bind('luz-estimulo', 5),
    ],
  },
  {
    id: 'cinco-csrtt',
    label: '5-CSRTT · atenção sustentada',
    descricao:
      'Cinco buracos com luz própria, comedouro atrás, para tarefa de tempo de reação serial.',
    devices: [
      bind('poke-esq', 1, 'Buraco 1'),
      bind('poke-central', 2, 'Buraco 2'),
      bind('poke-dir', 3, 'Buraco 3'),
      bind('bebedouro', 6),
      bind('luz-estimulo', 1, 'Luz do buraco 1'),
      bind('pelota', 6),
      bind('luz-casa', 7),
    ],
  },
]

export const EMPTY_PROFILE: HardwareProfile = {
  id: 'vazio',
  label: 'Sem dispositivos',
  descricao: 'Comece do zero e nomeie cada porta conforme for precisando.',
  devices: [],
}

export function deviceByConstant(
  profile: HardwareProfile,
  constante: string,
): DeviceBinding | undefined {
  return profile.devices.find((d) => d.constante === constante)
}

export function devicesOfKind(
  profile: HardwareProfile,
  kind: DeviceKind,
): DeviceBinding[] {
  return profile.devices.filter((d) => d.kind === kind)
}

// ------------------------------------------------- inferência a partir do MPC

export interface DeviceSuggestion {
  readonly constante: string
  /** `null` quando a constante não parece ser uma porta. */
  readonly porta: number | null
  /** Deduzido do uso: `#R^X` é entrada, `ON ^X` é saída. */
  readonly kind: DeviceKind | null
  /** Palpite do catálogo a partir do nome, para pré-preencher o formulário. */
  readonly palpite: DeviceType | undefined
}

/**
 * Lê um `.MPC` existente e propõe um perfil de hardware.
 *
 * O truque é não adivinhar pelo nome: o **uso** diz o papel. Uma constante que
 * aparece em `#R^X` é uma entrada; uma que aparece em `ON ^X` é uma saída. O
 * nome só serve para sugerir qual dispositivo é, e a palavra final é do usuário.
 */
export function suggestDevices(program: Program): DeviceSuggestion[] {
  const entradas = new Set<string>()
  const saidas = new Set<string>()

  for (const { statement } of eachStatement(program)) {
    const trigger = statement.trigger.parsed
    if (trigger?.kind === 'response' && trigger.port.type === 'constant') {
      entradas.add(trigger.port.name)
    }
  }

  for (const { command } of eachCommand(program)) {
    for (const operand of portOperandsOf(command)) {
      if (operand.type === 'constant') saidas.add(operand.name)
    }
  }

  const sugestoes: DeviceSuggestion[] = []
  for (const item of program.preamble) {
    if (item.kind !== 'ConstantDef') continue

    const valor = Number(item.value)
    const porta = Number.isInteger(valor) && valor > 0 ? valor : null

    const kind: DeviceKind | null = entradas.has(item.name)
      ? 'entrada'
      : saidas.has(item.name)
        ? 'saida'
        : null

    // Só entra no perfil o que o programa realmente usa como porta. Constantes
    // de parâmetro (^Razao, ^DuracaoSessao) têm valor numérico mas nunca
    // aparecem em `#R^X` nem em `ON ^X` — e seriam ruído na tela de hardware.
    if (kind === null) continue

    sugestoes.push({
      constante: item.name,
      porta,
      kind,
      palpite: guessDeviceType(item.name, kind ?? undefined),
    })
  }

  return sugestoes
}

/** Monta um perfil a partir das sugestões que puderam ser resolvidas sozinhas. */
export function profileFromSuggestions(
  suggestions: readonly DeviceSuggestion[],
  label = 'Perfil detectado',
): HardwareProfile {
  const devices: DeviceBinding[] = []
  for (const s of suggestions) {
    if (s.porta === null || s.kind === null) continue
    devices.push({
      constante: s.constante,
      typeId: s.palpite?.id ?? 'desconhecido',
      label: s.palpite?.label ?? s.constante,
      icon: s.palpite?.icon ?? (s.kind === 'entrada' ? '🎚' : '⚙️'),
      kind: s.kind,
      porta: s.porta,
    })
  }
  return {
    id: 'detectado',
    label,
    descricao: 'Deduzido do próprio arquivo. Confira cada dispositivo antes de usar.',
    devices,
  }
}
