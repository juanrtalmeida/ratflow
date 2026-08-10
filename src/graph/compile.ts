import {
  nodeAt,
  RAW_SPEC,
  unreachableNodes,
  type ActionNode,
  type DecisionNode,
  type NodeId,
  type RuleGraph,
  type TriggerNode,
} from './model.ts'

/**
 * Compilador: grafo de regra → uma linha de transição MedState.
 *
 * O percurso começa no gatilho. Ações em sequência viram comandos separados por
 * `;`; uma decisão vira o `IF … [@a, @b]` nativo com segmentos rotulados; cada
 * folha vira um `--->`.
 */

export class CompileError extends Error {
  readonly nodeId: NodeId | null
  constructor(message: string, nodeId: NodeId | null = null) {
    super(message)
    this.name = 'CompileError'
    this.nodeId = nodeId
  }
}

export interface CompileOptions {
  readonly indent?: string
  readonly labelIndent?: string
  readonly newline?: string
}

// --------------------------------------------------------------- gatilhos

export function compileTrigger(node: TriggerNode): string {
  const p = node.params
  switch (node.spec) {
    case 'inicio':
      return '#START'
    case 'resposta':
      return `#R${exigir(p.dispositivo, node.id, 'dispositivo')}`
    case 'tempo': {
      const unidade = p.unidade === 'min' ? "'" : '"'
      return `${exigir(p.duracao, node.id, 'duracao')}${unidade}`
    }
    case 'sinal':
      return `#Z${exigir(p.numero, node.id, 'numero')}`
    case RAW_SPEC:
      return exigir(node.raw, node.id, 'texto original')
    default:
      throw new CompileError(`Gatilho desconhecido: ${node.spec}`, node.id)
  }
}

// ------------------------------------------------------------------ ações

export function compileAction(node: ActionNode): string {
  const p = node.params
  switch (node.spec) {
    case 'ligar':
      return `ON ${exigir(p.dispositivo, node.id, 'dispositivo')}`
    case 'desligar':
      return `OFF ${exigir(p.dispositivo, node.id, 'dispositivo')}`
    // O nó "ligar por um tempo" liga aqui; o desligamento vive no estado
    // auxiliar que `macros.ts` cria. Ver a discussão em src/graph/macros.ts.
    case 'pulsar':
      return `ON ${exigir(p.dispositivo, node.id, 'dispositivo')}`
    case 'somar':
      return `ADD ${exigir(p.contador, node.id, 'contador')}`
    case 'subtrair':
      return `SUB ${exigir(p.contador, node.id, 'contador')}`
    case 'definir':
      return `SET ${exigir(p.contador, node.id, 'contador')} = ${exigir(p.valor, node.id, 'valor')}`
    case 'registrar':
      return `SHOW ${exigir(p.posicao, node.id, 'posicao')}, ${exigir(p.rotulo, node.id, 'rotulo')}, ${exigir(p.contador, node.id, 'contador')}`
    case 'avisar':
      return `Z${exigir(p.numero, node.id, 'numero')}`
    case RAW_SPEC:
      return exigir(node.raw, node.id, 'texto original')
    default:
      throw new CompileError(`Ação desconhecida: ${node.spec}`, node.id)
  }
}

function exigir(
  valor: string | undefined,
  nodeId: NodeId,
  campo: string,
): string {
  if (valor === undefined || valor === '') {
    throw new CompileError(`Falta preencher "${campo}" neste nó.`, nodeId)
  }
  return valor
}

// -------------------------------------------------------------- segmentos

interface Segmento {
  readonly label: string | null
  readonly corpo: string
}

/** Nome de rótulo determinístico para decisões criadas no canvas. */
function labelsDe(node: DecisionNode, ordem: number): {
  whenTrue: string
  whenFalse: string
} {
  return {
    whenTrue: node.labels?.whenTrue ?? `Sim${ordem}`,
    whenFalse: node.labels?.whenFalse ?? `Nao${ordem}`,
  }
}

/**
 * Segue a corrente a partir de `start`, acumulando ações até chegar a uma
 * decisão (que vira `IF` mais dois segmentos rotulados) ou a um destino.
 */
function compilarCorrente(
  graph: RuleGraph,
  start: NodeId | null,
  label: string | null,
  saida: Segmento[],
  contadorDeRotulos: { valor: number },
  visitados: Set<NodeId>,
): void {
  const comandos: string[] = []
  let atual = nodeAt(graph, start)

  while (atual) {
    if (visitados.has(atual.id)) {
      throw new CompileError(
        'Esta regra tem um caminho que volta para trás. Dentro de uma regra o ' +
          'fluxo só pode seguir em frente — use um estado para voltar.',
        atual.id,
      )
    }
    visitados.add(atual.id)

    if (atual.kind === 'action') {
      comandos.push(compileAction(atual))
      atual = nodeAt(graph, atual.next)
      continue
    }

    if (atual.kind === 'target') {
      const destino =
        atual.state === 'SX'
          ? 'SX'
          : atual.state === null
            ? exigir(atual.raw, atual.id, 'texto original')
            : `S${atual.state}`
      const seta = `---> ${destino}`
      saida.push({
        label,
        corpo: comandos.length > 0 ? `${comandos.join('; ')} ${seta}` : seta,
      })
      return
    }

    if (atual.kind === 'decision') {
      const ordem = contadorDeRotulos.valor++
      const rotulos = labelsDe(atual, ordem)
      comandos.push(
        `IF ${atual.left} ${atual.operator} ${atual.right} [@${rotulos.whenTrue}, @${rotulos.whenFalse}]`,
      )
      saida.push({ label, corpo: comandos.join('; ') })

      compilarCorrente(
        graph,
        atual.whenTrue,
        rotulos.whenTrue,
        saida,
        contadorDeRotulos,
        visitados,
      )
      compilarCorrente(
        graph,
        atual.whenFalse,
        rotulos.whenFalse,
        saida,
        contadorDeRotulos,
        visitados,
      )
      return
    }

    throw new CompileError(
      'Um gatilho não pode aparecer no meio de uma regra — ele é sempre o começo.',
      atual.id,
    )
  }

  // Corrente que termina sem destino: o programa fica no estado atual, o que em
  // MedState é a ausência de seta. Sem comandos e sem destino não há o que
  // escrever, e a regra estaria incompleta.
  if (comandos.length === 0) {
    throw new CompileError(
      'Este caminho não termina em lugar nenhum. Ligue-o a "ir para" ou a "fica aqui".',
      start,
    )
  }
  saida.push({ label, corpo: comandos.join('; ') })
}

/**
 * Compila a regra inteira. Devolve o texto da linha de transição, pronto para
 * ser colado no arquivo por uma edição cirúrgica.
 */
export function compileRule(
  graph: RuleGraph,
  options: CompileOptions = {},
): string {
  const indent = options.indent ?? '  '
  const labelIndent = options.labelIndent ?? indent + '     '
  const newline = options.newline ?? '\n'

  // Regra que não coube no modelo de nós: devolve-se o texto original tal e
  // qual, apenas reaplicando o recuo pedido à primeira linha.
  if (graph.rawStatement !== undefined) {
    return graph.rawStatement
      .split(/\r?\n/)
      .map((linha, i) => (i === 0 ? indent + linha : linha))
      .join(newline)
  }

  const raiz = nodeAt(graph, graph.root)
  if (!raiz || raiz.kind !== 'trigger') {
    throw new CompileError('Toda regra começa por um gatilho.', graph.root)
  }

  // Nó solto não tem como ser escrito: o texto de uma regra é o caminho a
  // partir do gatilho, então compilar em silêncio jogaria o nó fora no próximo
  // reparse. Recusar é o que faz o canvas segurá-lo como rascunho até ser
  // ligado. (`decompileStatement` nunca produz nó solto — os casos difíceis
  // caem em `rawStatement`, que retorna acima.)
  const soltos = unreachableNodes(graph)
  if (soltos.length > 0) {
    throw new CompileError(
      'Há um nó solto nesta regra — ligue-o ao fluxo ou apague-o.',
      soltos[0]!,
    )
  }

  const segmentos: Segmento[] = []
  compilarCorrente(
    graph,
    raiz.next,
    null,
    segmentos,
    { valor: 1 },
    new Set([raiz.id]),
  )

  const linhas = segmentos.map((segmento) =>
    segmento.label === null
      ? `${indent}${compileTrigger(raiz)}:${segmento.corpo ? ` ${segmento.corpo}` : ''}`
      : `${labelIndent}@${segmento.label}: ${segmento.corpo}`,
  )

  return linhas.join(newline)
}
