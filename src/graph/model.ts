/**
 * Modelo do grafo de uma **regra** — o que o canvas de nível 2 desenha.
 *
 * Uma regra é uma árvore enraizada num gatilho: gatilho → ações → decisões →
 * destinos. Ela corresponde a exatamente uma linha de transição do MedState.
 *
 * Duas decisões de projeto valem ser ditas em voz alta:
 *
 * 1. **Os fios carregam fluxo, nunca valores.** Dispositivos, contadores e
 *    números são escolhidos dentro do nó, em listas suspensas. Um fio significa
 *    sempre "depois disto, aquilo" — é o que mantém o canvas legível.
 *
 * 2. **Os parâmetros guardam o texto MedState do operando** (`^Pelota`, `A`,
 *    `5`). Isso torna compilar e descompilar simétricos e evita uma segunda
 *    representação de operandos que poderia divergir da AST.
 */

export type NodeId = string

/** Nó cru: construção que o catálogo ainda não modela. Nunca se perde. */
export const RAW_SPEC = 'bruto'

export interface TriggerNode {
  readonly kind: 'trigger'
  readonly id: NodeId
  /** Id de `EventSpec`, ou `RAW_SPEC`. */
  readonly spec: string
  readonly params: Readonly<Record<string, string>>
  /** Texto original, obrigatório quando `spec === RAW_SPEC`. */
  readonly raw?: string
  readonly next: NodeId | null
}

export interface ActionNode {
  readonly kind: 'action'
  readonly id: NodeId
  /** Id de `ActionSpec`, ou `RAW_SPEC`. */
  readonly spec: string
  readonly params: Readonly<Record<string, string>>
  readonly raw?: string
  readonly next: NodeId | null
}

export interface DecisionNode {
  readonly kind: 'decision'
  readonly id: NodeId
  /** Operandos em texto MedState: `A`, `^Razao`, `5`. */
  readonly left: string
  readonly operator: string
  readonly right: string
  readonly whenTrue: NodeId | null
  readonly whenFalse: NodeId | null
  /**
   * Nomes dos rótulos `@` no arquivo. Preservados na descompilação para que
   * recompilar devolva o texto original; gerados quando a decisão é nova.
   */
  readonly labels?: {
    readonly whenTrue: string
    readonly whenFalse: string | null
  }
}

export interface TargetNode {
  readonly kind: 'target'
  readonly id: NodeId
  /**
   * Número do estado de destino, `'SX'` para "fica aqui", ou `null` para um
   * destino especial que este catálogo não modela (`STOP`, `ABORT`, `FLUSH`,
   * `KILL`… combinados) — nesse caso `raw` traz o texto original.
   */
  readonly state: number | 'SX' | null
  readonly raw?: string
}

export type RuleNode = TriggerNode | ActionNode | DecisionNode | TargetNode

export interface RuleGraph {
  readonly root: NodeId
  readonly nodes: Readonly<Record<NodeId, RuleNode>>
  /**
   * Escape hatch de regra inteira. Quando a linha de transição não cabe no
   * modelo de nós — por exemplo, um segmento rotulado que nenhum `IF` alcança —
   * guarda-se o texto original aqui e o compilador o devolve intacto.
   *
   * O canvas desenha essas regras como um único nó "avançado", com o código à
   * mostra. Nada se perde e nada quebra; só não dá para editar visualmente.
   */
  readonly rawStatement?: string
}

// ------------------------------------------------------------------ criação

/** Gerador de ids estáveis dentro de uma regra. */
export function createIdFactory(prefixo = ''): (kind: RuleNode['kind']) => NodeId {
  let contador = 0
  const inicial: Record<RuleNode['kind'], string> = {
    trigger: 'g',
    action: 'a',
    decision: 'd',
    target: 'x',
  }
  return (kind) => `${prefixo}${inicial[kind]}${contador++}`
}

// ------------------------------------------------------------------ percurso

export function nodeAt(graph: RuleGraph, id: NodeId | null): RuleNode | null {
  return id === null ? null : (graph.nodes[id] ?? null)
}

/** Ids para onde um nó aponta. */
export function successorsOf(node: RuleNode): NodeId[] {
  switch (node.kind) {
    case 'trigger':
    case 'action':
      return node.next === null ? [] : [node.next]
    case 'decision':
      return [node.whenTrue, node.whenFalse].filter((id) => id !== null)
    case 'target':
      return []
  }
}

/** Percorre em profundidade a partir da raiz, sem repetir nós. */
export function* walkGraph(graph: RuleGraph): Generator<RuleNode> {
  const vistos = new Set<NodeId>()
  const pilha: NodeId[] = [graph.root]

  while (pilha.length > 0) {
    const id = pilha.pop()!
    if (vistos.has(id)) continue
    vistos.add(id)
    const node = graph.nodes[id]
    if (!node) continue
    yield node
    pilha.push(...successorsOf(node))
  }
}

/** Quantas setas chegam em cada nó — usado para detectar junções e órfãos. */
export function inDegrees(graph: RuleGraph): Map<NodeId, number> {
  const graus = new Map<NodeId, number>()
  for (const id of Object.keys(graph.nodes)) graus.set(id, 0)
  for (const node of Object.values(graph.nodes)) {
    for (const alvo of successorsOf(node)) {
      graus.set(alvo, (graus.get(alvo) ?? 0) + 1)
    }
  }
  return graus
}

/** Nós que a raiz não alcança. */
export function unreachableNodes(graph: RuleGraph): NodeId[] {
  const alcancados = new Set([...walkGraph(graph)].map((n) => n.id))
  return Object.keys(graph.nodes).filter((id) => !alcancados.has(id))
}

// -------------------------------------------------------------- construção

export interface GraphBuilder {
  add(node: RuleNode): NodeId
  build(root: NodeId): RuleGraph
}

export function createBuilder(): GraphBuilder {
  const nodes: Record<NodeId, RuleNode> = {}
  return {
    add(node) {
      nodes[node.id] = node
      return node.id
    },
    build(root) {
      return { root, nodes }
    },
  }
}
