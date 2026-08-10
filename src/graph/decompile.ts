import type { Command, Segment, Statement, Trigger } from '../core/ast.ts'
import { printOperand } from '../core/printer.ts'
import {
  createIdFactory,
  RAW_SPEC,
  type NodeId,
  type RuleGraph,
  type RuleNode,
} from './model.ts'

/**
 * Descompilador: linha de transição MedState → grafo de regra.
 *
 * É o caminho mais delicado do projeto, e por isso segue uma regra rígida:
 * **na dúvida, preserve o texto**. Toda construção que o catálogo não modela
 * vira um nó cru, que exibe o código original e volta a compilar idêntica.
 *
 * O contrato de fidelidade — `compileRule(decompileStatement(s))` reproduz a
 * forma canônica de `s` — é verificado contra todas as fixtures.
 */

export interface DecompileResult {
  readonly graph: RuleGraph
  /** Partes que caíram no caminho cru, para a UI poder sinalizar. */
  readonly rawNodes: readonly NodeId[]
}

function triggerNodeFrom(
  trigger: Trigger,
  id: NodeId,
  next: NodeId | null,
): RuleNode {
  const detail = trigger.parsed

  if (detail?.kind === 'start') {
    return { kind: 'trigger', id, spec: 'inicio', params: {}, next }
  }
  if (detail?.kind === 'response' && detail.channel === 'R') {
    return {
      kind: 'trigger',
      id,
      spec: 'resposta',
      params: { dispositivo: printOperand(detail.port) },
      next,
    }
  }
  if (detail?.kind === 'signal') {
    return {
      kind: 'trigger',
      id,
      spec: 'sinal',
      params: { numero: String(detail.number) },
      next,
    }
  }
  if (detail?.kind === 'time') {
    return {
      kind: 'trigger',
      id,
      spec: 'tempo',
      params: {
        duracao: printOperand(detail.amount),
        unidade: detail.unit === 'min' ? 'min' : 's',
      },
      next,
    }
  }

  return {
    kind: 'trigger',
    id,
    spec: RAW_SPEC,
    params: {},
    raw: trigger.raw,
    next,
  }
}

/**
 * Traduz um comando para um nó de ação.
 *
 * Comandos com mais de um alvo (`ON ^A, ^B`, `SET A = 0, B = 1`) viram nós
 * crus: quebrá-los em vários nós mudaria o texto ao recompilar, e fidelidade
 * vale mais do que granularidade.
 */
function actionNodeFrom(
  command: Command,
  id: NodeId,
  next: NodeId | null,
): RuleNode {
  const detail = command.parsed
  const cru: RuleNode = {
    kind: 'action',
    id,
    spec: RAW_SPEC,
    params: {},
    raw: command.raw,
    next,
  }
  if (!detail) return cru

  const acao = (spec: string, params: Record<string, string>): RuleNode => ({
    kind: 'action',
    id,
    spec,
    params,
    next,
  })

  switch (detail.kind) {
    case 'port': {
      if (detail.ports.length !== 1) return cru
      if (detail.op !== 'ON' && detail.op !== 'OFF') return cru
      return acao(detail.op === 'ON' ? 'ligar' : 'desligar', {
        dispositivo: printOperand(detail.ports[0]!),
      })
    }
    case 'counter':
      return acao(detail.op === 'ADD' ? 'somar' : 'subtrair', {
        contador: printOperand(detail.target),
      })
    case 'set': {
      if (detail.assignments.length !== 1) return cru
      const atribuicao = detail.assignments[0]!
      return acao('definir', {
        contador: printOperand(atribuicao.target),
        valor: atribuicao.value,
      })
    }
    case 'show': {
      if (detail.items.length !== 1) return cru
      const item = detail.items[0]!
      return acao('registrar', {
        posicao: item.slot,
        rotulo: item.label,
        contador: printOperand(item.value),
      })
    }
    case 'signal':
      return acao('avisar', { numero: String(detail.number) })
    case 'if':
      // Tratado na montagem do segmento, não aqui.
      return cru
  }
}

/**
 * Monta a corrente de um segmento e devolve o id do seu primeiro nó.
 *
 * `IF` só é modelado como decisão quando é o **último** comando do segmento —
 * que é como o MedState o usa. Se houver comandos depois dele, o segmento
 * inteiro vira cru, porque qualquer outra interpretação seria um chute.
 *
 * Um jeito de falhar é registrado em `naoResolvidos` (nome do rótulo) em vez
 * de virar um nó incompleto ou uma suposição: um ramo do `IF` aponta para um
 * `@rótulo` que não foi definido em lugar nenhum — arquivos reais têm isso
 * por erro de digitação (`@DURRING…` vs `@DURING…`), e sem ele o ramo não
 * tem para onde ir. Isso poisona a regra inteira (vira cru), porque não há
 * como saber para onde aquele ramo deveria seguir.
 *
 * Já o alvo depois de `--->` não ser `Sn` nem `SX` — os destinos especiais do
 * MedState (`STOP`, `ABORT`, `FLUSH`, `KILL`… combinados, como
 * `STOPABORTFLUSH`) que este catálogo não modela — **não** poisona a regra:
 * vira só aquele nó de destino em modo cru (`state: null` + `raw`), do jeito
 * que ações e gatilhos não reconhecidos já funcionam. Tratá-lo como `SX`
 * mudaria o sentido do programa ("fica aqui" não é o mesmo que "encerra a
 * sessão"), mas forçar a regra toda para cru só porque uma folha é especial
 * jogaria fora decisões e ações que estão perfeitamente editáveis.
 */
function buildSegment(
  segment: Segment,
  indice: number,
  segmentos: readonly Segment[],
  nodes: Record<NodeId, RuleNode>,
  nextId: (kind: RuleNode['kind']) => NodeId,
  rawNodes: NodeId[],
  emUso: Set<number>,
  naoResolvidos: string[],
): NodeId | null {
  const comandos = [...segment.commands]
  const ultimo = comandos[comandos.length - 1]
  const decisao =
    ultimo?.parsed?.kind === 'if' &&
    comandos.every((c, i) => i === comandos.length - 1 || c.parsed?.kind !== 'if')
      ? ultimo
      : null

  // Constrói de trás para frente: o fim da corrente é conhecido primeiro.
  let proximo: NodeId | null = null

  if (decisao && decisao.parsed?.kind === 'if') {
    const { thenLabel, elseLabel, condition } = decisao.parsed
    const id = nextId('decision')

    const ramo = (label: string | null): NodeId | null => {
      if (label === null) return null
      // O primeiro segmento com esse rótulo **depois** deste — não o único num
      // mapa por nome. Arquivos reais repetem o mesmo rótulo em `IF`s
      // aninhados (`@STOP` duas vezes na mesma regra, uma por nível), e é a
      // ordem no arquivo que diz qual pertence a qual, exatamente como a
      // indentação do autor sugere. Resolver para frente também garante que a
      // recursão sempre avança, então não há como girar em falso.
      const alvo = segmentos.findIndex((s, i) => i > indice && s.label === label)
      if (alvo === -1) {
        naoResolvidos.push(label)
        return null
      }
      emUso.add(alvo)
      return buildSegment(
        segmentos[alvo]!,
        alvo,
        segmentos,
        nodes,
        nextId,
        rawNodes,
        emUso,
        naoResolvidos,
      )
    }

    nodes[id] = {
      kind: 'decision',
      id,
      left: condition.left ? printOperand(condition.left) : condition.raw,
      operator: condition.operator ?? '=',
      right: condition.right ? printOperand(condition.right) : '',
      whenTrue: ramo(thenLabel),
      whenFalse: ramo(elseLabel),
      labels: { whenTrue: thenLabel, whenFalse: elseLabel },
    }
    proximo = id
    comandos.pop()
  } else if (segment.target) {
    const id = nextId('target')
    nodes[id] = {
      kind: 'target',
      id,
      state: segment.target.state,
      raw: segment.target.state === null ? segment.target.raw : undefined,
    }
    if (segment.target.state === null) rawNodes.push(id)
    proximo = id
  }

  for (let i = comandos.length - 1; i >= 0; i--) {
    const id = nextId('action')
    const node = actionNodeFrom(comandos[i]!, id, proximo)
    nodes[id] = node
    if (node.kind === 'action' && node.spec === RAW_SPEC) rawNodes.push(id)
    proximo = id
  }

  return proximo
}

/** Regra inteira preservada como texto — o escape hatch de quando algo não fecha. */
function rawFallback(
  statement: Statement,
  nextId: (kind: RuleNode['kind']) => NodeId,
): DecompileResult {
  const id = nextId('trigger')
  return {
    graph: {
      root: id,
      nodes: {
        [id]: {
          kind: 'trigger',
          id,
          spec: RAW_SPEC,
          params: {},
          raw: statement.trigger.raw,
          next: null,
        },
      },
      rawStatement: statement.raw,
    },
    rawNodes: [id],
  }
}

export function decompileStatement(statement: Statement): DecompileResult {
  const nextId = createIdFactory()
  const nodes: Record<NodeId, RuleNode> = {}
  const rawNodes: NodeId[] = []

  const primeiro = statement.segments[0]
  // Índices dos segmentos já encaixados no grafo. Índice, e não nome: com o
  // mesmo rótulo repetido na regra, marcar por nome daria os dois como usados e
  // esconderia um segmento de fato órfão.
  const emUso = new Set<number>()
  const naoResolvidos: string[] = []

  const corpo = primeiro
    ? buildSegment(primeiro, 0, statement.segments, nodes, nextId, rawNodes, emUso, naoResolvidos)
    : null

  if (naoResolvidos.length > 0) return rawFallback(statement, nextId)

  // Segmento rotulado que nenhum `IF` alcança não tem lugar no grafo. Em vez de
  // deixá-lo cair fora, a regra inteira vira texto preservado.
  const orfaos = statement.segments.some((s, i) => s.label !== null && !emUso.has(i))
  if (orfaos) return rawFallback(statement, nextId)

  const raizId = nextId('trigger')
  const raiz = triggerNodeFrom(statement.trigger, raizId, corpo)
  nodes[raizId] = raiz
  if (raiz.kind === 'trigger' && raiz.spec === RAW_SPEC) rawNodes.push(raizId)

  return { graph: { root: raizId, nodes }, rawNodes }
}
