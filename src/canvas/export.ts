import {
  getNodesBounds,
  getViewportForBounds,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'

/**
 * Exporta o canvas atual como imagem — enquadra todos os nós (não só o que
 * está visível na tela agora), então rasteriza só o `.react-flow__viewport`
 * pelo tamanho e zoom calculados. Funciona offline: nada disto busca fonte
 * ou asset externo, `html-to-image` embute o que precisa via `data:` URIs.
 */

const PADDING = 0.15
const MIN_ZOOM = 0.1
const MAX_ZOOM = 2

interface Enquadramento {
  readonly width: number
  readonly height: number
  readonly transform: string
}

function calcularEnquadramento<NodeType extends Node, EdgeType extends Edge>(
  instance: ReactFlowInstance<NodeType, EdgeType>,
  escala: number,
): Enquadramento {
  const bounds = getNodesBounds(instance.getNodes())
  const width = Math.max(bounds.width, 1) * (1 + PADDING) * escala
  const height = Math.max(bounds.height, 1) * (1 + PADDING) * escala
  const viewport = getViewportForBounds(bounds, width, height, MIN_ZOOM, MAX_ZOOM, PADDING * 100)
  return {
    width,
    height,
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
  }
}

function encontrarViewport(container: HTMLElement): HTMLElement {
  const viewport = container.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) throw new Error('Canvas não encontrado para exportar.')
  return viewport
}

function baixar(dataUrl: string, nomeArquivo: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = nomeArquivo
  a.click()
}

export interface ExportOptions {
  /** Multiplicador de resolução — 2 dá uma imagem nítida em telas de alta densidade. */
  readonly escala?: number
  readonly corFundo?: string
}

/**
 * O rodapé do card é interface — "Abrir lógica", renomear, excluir. Aparece na
 * tela, não na figura que vai para o caderno ou para o artigo.
 */
const semControles = (el: HTMLElement) => !el.classList?.contains('state-node-rodape')

export async function exportarCanvasPng<NodeType extends Node, EdgeType extends Edge>(
  instance: ReactFlowInstance<NodeType, EdgeType>,
  container: HTMLElement,
  nomeArquivo: string,
  opcoes: ExportOptions = {},
): Promise<void> {
  const escala = opcoes.escala ?? 2
  const { width, height, transform } = calcularEnquadramento(instance, 1)
  const viewport = encontrarViewport(container)

  const dataUrl = await toPng(viewport, {
    width,
    height,
    pixelRatio: escala,
    filter: semControles,
    backgroundColor: opcoes.corFundo ?? '#ffffff',
    style: { width: `${width}px`, height: `${height}px`, transform },
  })
  baixar(dataUrl, nomeArquivo)
}

export async function exportarCanvasSvg<NodeType extends Node, EdgeType extends Edge>(
  instance: ReactFlowInstance<NodeType, EdgeType>,
  container: HTMLElement,
  nomeArquivo: string,
  opcoes: ExportOptions = {},
): Promise<void> {
  const { width, height, transform } = calcularEnquadramento(instance, 1)
  const viewport = encontrarViewport(container)

  const dataUrl = await toSvg(viewport, {
    width,
    height,
    filter: semControles,
    backgroundColor: opcoes.corFundo ?? '#ffffff',
    style: { width: `${width}px`, height: `${height}px`, transform },
  })
  baixar(dataUrl, nomeArquivo)
}
