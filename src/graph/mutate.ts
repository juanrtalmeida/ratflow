import { actionSpec, eventSpec } from '../vocab/catalog.ts'
import {
  nodeAt,
  successorsOf,
  type NodeId,
  type RuleGraph,
  type RuleNode,
} from './model.ts'
import { canConnect } from './validate.ts'

/**
 * Edição estrutural de um grafo de regra: inserir, ligar, cortar e remover nós.
 * Tudo puro — recebe um `RuleGraph`, devolve outro. Quem escreve no arquivo é
 * `setRule`/`insertStatement`, que recompilam a regra a partir do grafo novo.
 *
 * Arquivo separado de `model.ts` porque precisa de `canConnect`, e `validate.ts`
 * já importa `model.ts`: juntar os dois fecharia um ciclo de imports.
 *
 * As regras de "pode ligar?" moram **só** em `canConnect`. As funções daqui
 * devolvem `null` quando ela recusa, e a interface chama a mesma função para
 * mostrar o motivo — nunca duplicando a regra.
 */

/** Qual saída de um nó: `next` em gatilho e ação, os dois ramos numa decisão. */
export type Porta = 'next' | 'whenTrue' | 'whenFalse'

/** Um bloco da paleta, antes de virar nó. O `estado` do nível 1 não entra aqui. */
export type BlocoNovo =
  | { readonly kind: 'trigger'; readonly spec: string }
  | { readonly kind: 'action'; readonly spec: string }
  | { readonly kind: 'decision' }
  | { readonly kind: 'target' }

const PREFIXO: Record<RuleNode['kind'], string> = {
  trigger: 'g',
  action: 'a',
  decision: 'd',
  target: 'x',
}

/**
 * Primeiro id livre para um nó novo. Não dá para usar `createIdFactory`: ela é
 * um contador que reinicia em zero e sobrescreveria um nó existente em silêncio.
 */
export function nextNodeId(graph: RuleGraph, kind: RuleNode['kind']): NodeId {
  const prefixo = PREFIXO[kind]
  for (let n = 0; ; n++) {
    const id = `${prefixo}${n}`
    if (!(id in graph.nodes)) return id
  }
}

/** Nó novo a partir de um bloco da paleta, com os valores padrão do catálogo. */
export function nodeFromCatalog(bloco: BlocoNovo, graph: RuleGraph): RuleNode {
  const id = nextNodeId(graph, bloco.kind)

  switch (bloco.kind) {
    case 'trigger':
      return { kind: 'trigger', id, spec: bloco.spec, params: padroes(eventSpec(bloco.spec)?.params), next: null }
    case 'action':
      return { kind: 'action', id, spec: bloco.spec, params: padroes(actionSpec(bloco.spec)?.params), next: null }
    case 'decision':
      // Comparador já escolhido, operandos vazios: é o mínimo que deixa o nó
      // com cara de comparação sem inventar contador nenhum.
      return { kind: 'decision', id, left: '', operator: '>=', right: '', whenTrue: null, whenFalse: null }
    case 'target':
      // "Fica aqui" é o único destino que compila sem o usuário escolher nada.
      return { kind: 'target', id, state: 'SX' }
  }
}

function padroes(params: readonly { id: string; padrao?: string }[] | undefined) {
  const valores: Record<string, string> = {}
  for (const param of params ?? []) {
    if (param.padrao !== undefined) valores[param.id] = param.padrao
  }
  return valores
}

// ------------------------------------------------------------------- portas

/** As saídas que este nó tem. Um destino não tem nenhuma: ele encerra o caminho. */
export function portasDe(node: RuleNode): Porta[] {
  switch (node.kind) {
    case 'trigger':
    case 'action':
      return ['next']
    case 'decision':
      return ['whenTrue', 'whenFalse']
    case 'target':
      return []
  }
}

/** Traduz a porta pedida para uma que o nó realmente tem (`next` → ramo "sim"). */
function portaReal(node: RuleNode, porta: Porta): Porta | null {
  const portas = portasDe(node)
  if (portas.includes(porta)) return porta
  return portas[0] ?? null
}

function sucessorEm(node: RuleNode, porta: Porta): NodeId | null {
  switch (node.kind) {
    case 'trigger':
    case 'action':
      return node.next
    case 'decision':
      return porta === 'whenFalse' ? node.whenFalse : node.whenTrue
    case 'target':
      return null
  }
}

function comSucessor(node: RuleNode, porta: Porta, to: NodeId | null): RuleNode {
  switch (node.kind) {
    case 'trigger':
    case 'action':
      return { ...node, next: to }
    case 'decision':
      return porta === 'whenFalse' ? { ...node, whenFalse: to } : { ...node, whenTrue: to }
    case 'target':
      return node
  }
}

function comNos(graph: RuleGraph, ...nodes: RuleNode[]): RuleGraph {
  const atualizados = { ...graph.nodes }
  for (const node of nodes) atualizados[node.id] = node
  return { ...graph, nodes: atualizados }
}

// ---------------------------------------------------------------- mutações

/** Põe um nó no grafo sem fio nenhum — o bloco solto no vazio, esperando ligação. */
export function addNode(graph: RuleGraph, node: RuleNode): RuleGraph {
  return comNos(graph, node)
}

/**
 * Encaixa um nó novo na saída `porta` de `from`. Se aquela saída já apontava
 * para alguém, o antigo sucessor passa a vir depois do nó novo — é o que faz
 * "soltar o bloco sobre um fio" e "soltar numa saída livre" serem o mesmo
 * gesto. `null` quando a ligação é inválida.
 *
 * Soltar um **destino** no meio de um fio corta ali: destino não tem saída,
 * então a cauda fica solta e a regra deixa de compilar até o usuário resolver.
 */
export function insertNode(
  graph: RuleGraph,
  from: NodeId,
  node: RuleNode,
  porta: Porta = 'next',
): RuleGraph | null {
  const origem = nodeAt(graph, from)
  if (!origem) return null
  const alvo = portaReal(origem, porta)
  if (alvo === null) return null

  const comNovo = addNode(graph, node)
  if (!canConnect(comNovo, from, node.id).ok) return null

  const antigo = sucessorEm(origem, alvo)
  const novoPorta = portaReal(node, 'next')
  const novoLigado = novoPorta === null ? node : comSucessor(node, novoPorta, antigo)

  return comNos(comNovo, novoLigado, comSucessor(origem, alvo, node.id))
}

/** Liga um fio de `from` a um nó que já existe. `null` quando `canConnect` recusa. */
export function connect(
  graph: RuleGraph,
  from: NodeId,
  to: NodeId,
  porta: Porta = 'next',
): RuleGraph | null {
  const origem = nodeAt(graph, from)
  if (!origem || !nodeAt(graph, to)) return null
  const alvo = portaReal(origem, porta)
  if (alvo === null) return null
  if (!canConnect(graph, from, to).ok) return null

  return comNos(graph, comSucessor(origem, alvo, to))
}

/** Corta o fio que sai de `from`. A cauda fica solta, visível e religável. */
export function disconnect(graph: RuleGraph, from: NodeId, porta: Porta = 'next'): RuleGraph {
  const origem = nodeAt(graph, from)
  if (!origem) return graph
  const alvo = portaReal(origem, porta)
  if (alvo === null) return graph

  return comNos(graph, comSucessor(origem, alvo, null))
}

/**
 * Tira um nó do meio da corrente, religando quem apontava para ele ao que ele
 * apontava. Numa decisão sobra o ramo "sim" e o "não" fica solto: o editor não
 * apaga trabalho do usuário por conta própria.
 *
 * Remover o gatilho é remover a regra inteira — isso é `deleteStatement`, no
 * texto, não aqui; então a raiz é devolvida intacta.
 */
export function removeNode(graph: RuleGraph, id: NodeId): RuleGraph {
  if (id === graph.root || !(id in graph.nodes)) return graph

  const removido = graph.nodes[id]!
  const herdeiro = successorsOf(removido)[0] ?? null

  const nodes: Record<NodeId, RuleNode> = {}
  for (const node of Object.values(graph.nodes)) {
    if (node.id === id) continue
    let atual = node
    for (const porta of portasDe(node)) {
      if (sucessorEm(node, porta) === id) atual = comSucessor(atual, porta, herdeiro)
    }
    nodes[node.id] = atual
  }

  return { ...graph, nodes }
}

/**
 * A regra mínima que só manda o programa a outro estado — o que um fio novo do
 * nível 1 escreve. O gatilho é de tempo porque é o único que sempre compila:
 * `#START` só cabe uma vez por processo e quase sempre já está tomado, e
 * `#R` depende de um dispositivo declarado que o arquivo pode não ter.
 */
export function transitionRule(destino: number | 'SX', duracao = '5'): RuleGraph {
  return {
    root: 'g0',
    nodes: {
      g0: { kind: 'trigger', id: 'g0', spec: 'tempo', params: { duracao }, next: 'x1' },
      x1: { kind: 'target', id: 'x1', state: destino },
    },
  }
}
