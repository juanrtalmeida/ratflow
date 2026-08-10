/**
 * Catálogo de dispositivos de uma caixa operante.
 *
 * É uma tabela de dados, não código espalhado: acrescentar um dispositivo novo
 * é acrescentar uma linha aqui, e ele passa a aparecer na paleta, no narrador,
 * no perfil de hardware e na caixa virtual do simulador.
 */

export type DeviceKind = 'entrada' | 'saida'

export interface DeviceType {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly kind: DeviceKind
  /**
   * Verbo usado pelo narrador para descrever o evento, na forma
   * "o sujeito <verbo>". Só faz sentido para entradas.
   */
  readonly verbo?: string
  /** Nome sugerido para a constante `^` gerada no arquivo. */
  readonly constante: string
  /** Palavras que ajudam a adivinhar o dispositivo a partir de um `.MPC` legado. */
  readonly pistas: readonly string[]
}

export const DEVICE_TYPES: readonly DeviceType[] = [
  // ---------------------------------------------------------- entradas
  {
    id: 'alavanca-esq',
    label: 'Alavanca esquerda',
    icon: '🖐',
    kind: 'entrada',
    verbo: 'pressionar a Alavanca esquerda',
    constante: 'AlavancaEsq',
    pistas: ['alavancaesq', 'leftlever', 'llever', 'alavanca_e', 'lev_esq'],
  },
  {
    id: 'alavanca-dir',
    label: 'Alavanca direita',
    icon: '🖐',
    kind: 'entrada',
    verbo: 'pressionar a Alavanca direita',
    constante: 'AlavancaDir',
    pistas: ['alavancadir', 'rightlever', 'rlever', 'alavanca_d', 'lev_dir'],
  },
  {
    id: 'poke-esq',
    label: 'Nose-poke esquerdo',
    icon: '👃',
    kind: 'entrada',
    verbo: 'enfiar o focinho no buraco esquerdo',
    constante: 'PokeEsq',
    pistas: ['pokeesq', 'leftpoke', 'lpoke', 'nosepokel'],
  },
  {
    id: 'poke-central',
    label: 'Nose-poke central',
    icon: '👃',
    kind: 'entrada',
    verbo: 'enfiar o focinho no buraco central',
    constante: 'PokeCentral',
    pistas: ['pokecentral', 'centerpoke', 'cpoke', 'nosepokec'],
  },
  {
    id: 'poke-dir',
    label: 'Nose-poke direito',
    icon: '👃',
    kind: 'entrada',
    verbo: 'enfiar o focinho no buraco direito',
    constante: 'PokeDir',
    pistas: ['pokedir', 'rightpoke', 'rpoke', 'nosepoker'],
  },
  {
    id: 'bebedouro',
    label: 'Entrada no comedouro',
    icon: '🍽',
    kind: 'entrada',
    verbo: 'entrar no comedouro',
    constante: 'Comedouro',
    pistas: ['comedouro', 'bebedouro', 'headentry', 'magazine', 'trough'],
  },

  // ------------------------------------------------------------ saídas
  {
    id: 'pelota',
    label: 'Dispensador de pelota',
    icon: '🍬',
    kind: 'saida',
    constante: 'Pelota',
    pistas: ['pelota', 'pellet', 'feeder', 'dispenser'],
  },
  {
    id: 'bomba',
    label: 'Bomba de infusão',
    icon: '💉',
    kind: 'saida',
    constante: 'Bomba',
    pistas: ['bomba', 'pump', 'infusion', 'syringe'],
  },
  {
    id: 'luz-casa',
    label: 'Luz da casa',
    icon: '💡',
    kind: 'saida',
    constante: 'LuzCasa',
    pistas: ['luzcasa', 'houselight', 'hlight', 'luz_casa'],
  },
  {
    id: 'luz-estimulo',
    label: 'Luz de estímulo',
    icon: '🔆',
    kind: 'saida',
    constante: 'LuzEstimulo',
    pistas: ['luzestimulo', 'stimlight', 'cuelight', 'signallight'],
  },
  {
    id: 'tom',
    label: 'Tom',
    icon: '🔊',
    kind: 'saida',
    constante: 'Tom',
    pistas: ['tom', 'tone', 'som'],
  },
  {
    id: 'ruido',
    label: 'Ruído branco',
    icon: '🔉',
    kind: 'saida',
    constante: 'Ruido',
    pistas: ['ruido', 'noise', 'whitenoise'],
  },
  {
    id: 'alavanca-retratil',
    label: 'Alavanca retrátil',
    icon: '↔️',
    kind: 'saida',
    constante: 'AlavancaRetratil',
    pistas: ['retratil', 'retract', 'leverout', 'extend'],
  },
  {
    id: 'ventilador',
    label: 'Ventilador',
    icon: '🌀',
    kind: 'saida',
    constante: 'Ventilador',
    pistas: ['ventilador', 'fan'],
  },
  {
    id: 'choque',
    label: 'Gerador de choque',
    icon: '⚡',
    kind: 'saida',
    constante: 'Choque',
    pistas: ['choque', 'shock', 'shocker'],
  },
]

const BY_ID = new Map(DEVICE_TYPES.map((d) => [d.id, d]))

export function deviceType(id: string): DeviceType | undefined {
  return BY_ID.get(id)
}

export function deviceTypesOfKind(kind: DeviceKind): DeviceType[] {
  return DEVICE_TYPES.filter((d) => d.kind === kind)
}

/**
 * Adivinha o tipo de dispositivo a partir do nome de uma constante de um `.MPC`
 * legado. Só sugere: quem confirma é o usuário, na tela de perfil de hardware.
 */
export function guessDeviceType(
  constantName: string,
  kind?: DeviceKind,
): DeviceType | undefined {
  const normalized = constantName.toLowerCase().replaceAll(/[^a-z]/g, '')
  const candidatos = kind ? deviceTypesOfKind(kind) : DEVICE_TYPES

  // Pista mais longa primeiro, para que `leftlever` não caia em `lever`.
  let melhor: { device: DeviceType; length: number } | undefined
  for (const device of candidatos) {
    for (const pista of device.pistas) {
      if (!normalized.includes(pista)) continue
      if (!melhor || pista.length > melhor.length) {
        melhor = { device, length: pista.length }
      }
    }
  }
  return melhor?.device
}
