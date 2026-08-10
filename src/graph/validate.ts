import { actionSpec, eventSpec } from '../vocab/catalog.ts'
import {
  inDegrees,
  nodeAt,
  RAW_SPEC,
  successorsOf,
  unreachableNodes,
  walkGraph,
  type NodeId,
  type RuleGraph,
} from './model.ts'

/**
 * Validação do grafo — a barreira que impede o usuário de montar algo que não
 * compile. O canvas consulta `canConnect` antes de aceitar um fio, de modo que
 * a maior parte dos erros nunca chega a existir.
 */

export interface GraphProblem {
  readonly nodeId: NodeId | null
  readonly code: string
  readonly plain: string
  readonly why?: string
  readonly fix?: string
}

export interface ConnectionCheck {
  readonly ok: boolean
  readonly reason?: string
}

/** Existe caminho de `from` até `to` seguindo as setas? */
function alcanca(graph: RuleGraph, from: NodeId, to: NodeId): boolean {
  const vistos = new Set<NodeId>()
  const pilha = [from]
  while (pilha.length > 0) {
    const id = pilha.pop()!
    if (id === to) return true
    if (vistos.has(id)) continue
    vistos.add(id)
    const node = graph.nodes[id]
    if (node) pilha.push(...successorsOf(node))
  }
  return false
}

/**
 * Pode ligar um fio de `from` para `to`? A resposta negativa vem com o motivo
 * em linguagem simples, para virar tooltip no canvas.
 */
export function canConnect(
  graph: RuleGraph,
  from: NodeId,
  to: NodeId,
): ConnectionCheck {
  if (from === to) {
    return { ok: false, reason: 'Um nó não pode se ligar a si mesmo.' }
  }

  const origem = nodeAt(graph, from)
  const destino = nodeAt(graph, to)
  if (!origem || !destino) {
    return { ok: false, reason: 'Um dos nós não existe mais.' }
  }

  if (origem.kind === 'target') {
    return {
      ok: false,
      reason: 'Um destino encerra o caminho — depois dele não vem mais nada.',
    }
  }

  if (destino.kind === 'trigger') {
    return {
      ok: false,
      reason: 'Um gatilho não pode receber uma seta: ele é sempre o começo da regra.',
    }
  }

  if (alcanca(graph, to, from)) {
    return {
      ok: false,
      reason:
        'Isso criaria um caminho que volta para trás. Dentro de uma regra o fluxo ' +
        'só segue em frente — para repetir, mande o programa a um estado.',
    }
  }

  const grau = inDegrees(graph).get(to) ?? 0
  if (grau > 0) {
    return {
      ok: false,
      reason:
        'Este nó já recebe uma seta. No MedState cada caminho é independente: ' +
        'duplique o nó para usá-lo nos dois caminhos.',
    }
  }

  return { ok: true }
}

/** Problemas do grafo inteiro, para os badges do canvas. */
export function validateGraph(graph: RuleGraph): GraphProblem[] {
  const problemas: GraphProblem[] = []

  // Regra preservada em texto: não há grafo a validar.
  if (graph.rawStatement !== undefined) return problemas

  const raiz = nodeAt(graph, graph.root)
  if (!raiz || raiz.kind !== 'trigger') {
    return [
      {
        nodeId: graph.root,
        code: 'sem-gatilho',
        plain: 'Esta regra não começa por um gatilho.',
        why: 'Sem um gatilho, nada faz a regra acontecer.',
        fix: 'Arraste um gatilho da paleta — uma resposta, um tempo ou o início da sessão.',
      },
    ]
  }

  const graus = inDegrees(graph)

  for (const node of walkGraph(graph)) {
    if (node.kind === 'trigger' && node.id !== graph.root) {
      problemas.push({
        nodeId: node.id,
        code: 'gatilho-no-meio',
        plain: 'Há um gatilho no meio da regra.',
        why: 'Cada regra tem um único começo.',
        fix: 'Apague este gatilho ou comece uma regra nova a partir dele.',
      })
    }

    if ((graus.get(node.id) ?? 0) > 1) {
      problemas.push({
        nodeId: node.id,
        code: 'juncao-nao-suportada',
        plain: 'Dois caminhos chegam a este nó.',
        why:
          'O MedState escreve cada caminho por inteiro; não existe forma de dois ' +
          'ramos voltarem a se encontrar.',
        fix: 'Duplique este trecho, um para cada caminho.',
      })
    }

    // Toda corrente precisa terminar em um destino.
    if (node.kind !== 'target' && successorsOf(node).length === 0) {
      problemas.push({
        nodeId: node.id,
        code: 'caminho-sem-fim',
        plain: 'Este caminho não termina em lugar nenhum.',
        why: 'O programa não saberia o que fazer depois desta ação.',
        fix: 'Ligue-o a "ir para um estado" ou a "fica aqui".',
      })
    }

    if (node.kind === 'decision') {
      if (node.whenTrue === null || node.whenFalse === null) {
        problemas.push({
          nodeId: node.id,
          code: 'decisao-incompleta',
          plain: 'Esta decisão tem uma saída solta.',
          why: 'Se a condição cair no ramo vazio, o programa fica sem instrução.',
          fix: 'Ligue as duas saídas, "sim" e "não".',
        })
      }
      if (node.left === '' || node.right === '' || node.operator === '') {
        problemas.push({
          nodeId: node.id,
          code: 'decisao-sem-comparacao',
          plain: 'Falta preencher a comparação desta decisão.',
          fix: 'Escolha o contador, o operador e o valor a comparar.',
        })
      }
    }

    // Campos obrigatórios do catálogo.
    if (node.kind === 'action' && node.spec !== RAW_SPEC) {
      const spec = actionSpec(node.spec)
      for (const param of spec?.params ?? []) {
        if (node.params[param.id]) continue
        problemas.push({
          nodeId: node.id,
          code: 'campo-vazio',
          plain: `Falta preencher "${param.label}" em «${spec?.label ?? node.spec}».`,
          fix: 'Escolha um valor na lista do nó.',
        })
      }
    }

    if (node.kind === 'trigger' && node.spec !== RAW_SPEC) {
      const spec = eventSpec(node.spec)
      for (const param of spec?.params ?? []) {
        if (node.params[param.id]) continue
        problemas.push({
          nodeId: node.id,
          code: 'campo-vazio',
          plain: `Falta preencher "${param.label}" em «${spec?.label ?? node.spec}».`,
          fix: 'Escolha um valor na lista do nó.',
        })
      }
    }
  }

  for (const id of unreachableNodes(graph)) {
    problemas.push({
      nodeId: id,
      code: 'no-solto',
      plain: 'Este nó está solto: nenhuma seta chega até ele.',
      why: 'Ele não faz parte da regra e será ignorado.',
      fix: 'Ligue-o ao fluxo ou apague-o.',
    })
  }

  return problemas
}
