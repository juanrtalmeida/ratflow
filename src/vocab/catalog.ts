/**
 * Catálogo de gatilhos e ações que a paleta do canvas oferece.
 *
 * É deliberadamente **só dados**: cada entrada descreve o que aparece na tela e
 * quais campos o nó pede. A tradução para MedState fica no compilador de grafo
 * (`src/graph/`), que lê estes ids. Assim, acrescentar uma ação nova é
 * acrescentar uma linha aqui e um caso lá — sem mexer na interface.
 */

export type ParamType =
  | 'entrada' // dispositivo de entrada do perfil de hardware
  | 'saida' // dispositivo de saída do perfil de hardware
  | 'contador' // variável A–Z, mostrada pelo apelido
  | 'numero'
  | 'duracao' // número + unidade (segundos ou minutos)
  | 'texto'
  | 'sinal' // Z1…Z32
  | 'comparador'

export interface ParamSpec {
  readonly id: string
  readonly label: string
  readonly type: ParamType
  readonly padrao?: string
  readonly ajuda?: string
}

export interface EventSpec {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly resumo: string
  readonly params: readonly ParamSpec[]
}

export type ActionCategory = 'dispositivo' | 'contador' | 'registro' | 'processo'

export interface ActionSpec {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly categoria: ActionCategory
  readonly resumo: string
  readonly params: readonly ParamSpec[]
  /** Ação composta: o compilador precisa gerar um estado auxiliar para ela. */
  readonly macro?: boolean
}

// ------------------------------------------------------------------ gatilhos

export const EVENT_SPECS: readonly EventSpec[] = [
  {
    id: 'inicio',
    label: 'A sessão começar',
    icon: '▶',
    resumo: 'Dispara uma única vez, quando o experimento é iniciado.',
    params: [],
  },
  {
    id: 'resposta',
    label: 'O sujeito responder',
    icon: '🖐',
    resumo: 'Dispara a cada resposta no dispositivo escolhido.',
    params: [
      {
        id: 'dispositivo',
        label: 'Onde',
        type: 'entrada',
        ajuda: 'Alavanca, buraco de focinho ou detector de entrada no comedouro.',
      },
    ],
  },
  {
    id: 'tempo',
    label: 'Passar um tempo',
    icon: '⏱',
    resumo: 'Dispara quando o programa fica no estado pelo tempo indicado.',
    params: [
      { id: 'duracao', label: 'Depois de', type: 'duracao', padrao: '5' },
    ],
  },
  {
    id: 'sinal',
    label: 'Chegar um sinal',
    icon: '📩',
    resumo: 'Dispara quando outro processo manda o sinal escolhido.',
    params: [{ id: 'numero', label: 'Sinal', type: 'sinal', padrao: '1' }],
  },
]

// -------------------------------------------------------------------- ações

export const ACTION_SPECS: readonly ActionSpec[] = [
  {
    id: 'ligar',
    label: 'Ligar dispositivo',
    icon: '🔛',
    categoria: 'dispositivo',
    resumo: 'Liga e deixa ligado até alguém desligar.',
    params: [{ id: 'dispositivo', label: 'O quê', type: 'saida' }],
  },
  {
    id: 'desligar',
    label: 'Desligar dispositivo',
    icon: '⭕',
    categoria: 'dispositivo',
    resumo: 'Desliga o dispositivo escolhido.',
    params: [{ id: 'dispositivo', label: 'O quê', type: 'saida' }],
  },
  {
    id: 'pulsar',
    label: 'Ligar por um tempo',
    icon: '⚡',
    categoria: 'dispositivo',
    resumo:
      'Liga, espera e desliga sozinho. É o jeito de entregar uma pelota ou tocar um som curto.',
    macro: true,
    params: [
      { id: 'dispositivo', label: 'O quê', type: 'saida' },
      { id: 'duracao', label: 'Por quanto tempo', type: 'duracao', padrao: '0.05' },
    ],
  },
  {
    id: 'somar',
    label: 'Somar 1 a um contador',
    icon: '➕',
    categoria: 'contador',
    resumo: 'Usado para contar respostas, reforços, tentativas.',
    params: [{ id: 'contador', label: 'Contador', type: 'contador' }],
  },
  {
    id: 'subtrair',
    label: 'Subtrair 1 de um contador',
    icon: '➖',
    categoria: 'contador',
    resumo: 'Útil para contagens regressivas.',
    params: [{ id: 'contador', label: 'Contador', type: 'contador' }],
  },
  {
    id: 'definir',
    label: 'Definir valor',
    icon: '🎯',
    categoria: 'contador',
    resumo: 'Coloca um valor fixo no contador — normalmente para zerar.',
    params: [
      { id: 'contador', label: 'Contador', type: 'contador' },
      { id: 'valor', label: 'Valor', type: 'numero', padrao: '0' },
    ],
  },
  {
    id: 'registrar',
    label: 'Registrar no painel',
    icon: '📝',
    categoria: 'registro',
    resumo: 'Mostra o valor durante a sessão e o guarda no arquivo de dados.',
    params: [
      { id: 'posicao', label: 'Posição no painel', type: 'numero', padrao: '1' },
      { id: 'rotulo', label: 'Nome que aparece', type: 'texto' },
      { id: 'contador', label: 'Valor', type: 'contador' },
    ],
  },
  {
    id: 'avisar',
    label: 'Avisar outro processo',
    icon: '📤',
    categoria: 'processo',
    resumo:
      'Manda um sinal que outro processo pode esperar. É como os processos paralelos conversam.',
    params: [{ id: 'numero', label: 'Sinal', type: 'sinal', padrao: '1' }],
  },
]

const EVENTS_BY_ID = new Map(EVENT_SPECS.map((e) => [e.id, e]))
const ACTIONS_BY_ID = new Map(ACTION_SPECS.map((a) => [a.id, a]))

export function eventSpec(id: string): EventSpec | undefined {
  return EVENTS_BY_ID.get(id)
}

export function actionSpec(id: string): ActionSpec | undefined {
  return ACTIONS_BY_ID.get(id)
}

export function actionsByCategory(categoria: ActionCategory): ActionSpec[] {
  return ACTION_SPECS.filter((a) => a.categoria === categoria)
}

export const CATEGORY_LABELS: Readonly<Record<ActionCategory, string>> = {
  dispositivo: 'Dispositivos da caixa',
  contador: 'Contadores',
  registro: 'Registro de dados',
  processo: 'Conversa entre processos',
}

export const COMPARADORES: readonly { readonly id: string; readonly label: string }[] = [
  { id: '>=', label: 'for pelo menos' },
  { id: '>', label: 'for maior que' },
  { id: '=', label: 'for igual a' },
  { id: '<=', label: 'for no máximo' },
  { id: '<', label: 'for menor que' },
  { id: '<>', label: 'for diferente de' },
]
