import { SECOES } from './guias.ts'
import type { ManualSecao } from './manual-conteudo.ts'
import { GUIAS, type RotaGuia } from './rota.ts'

/**
 * Busca em todas as páginas de documentação de uma vez.
 *
 * Atravessa os guias de propósito: quem procura "TIMEZ" não sabe — nem tem que
 * saber — se a resposta está no manual, na página da linguagem ou no glossário.
 * O resultado diz de qual guia veio e leva direto à seção.
 *
 * O índice é um array percorrido inteiro a cada tecla. São algumas dezenas de
 * seções e o texto todo cabe em poucos KB; um índice invertido seria mais
 * código para um `for` que já roda em fração de milissegundo.
 */

export interface ResultadoBusca {
  readonly rota: RotaGuia
  /** Rótulo curto do guia, para o resultado dizer de onde veio. */
  readonly guia: string
  readonly icone: string
  readonly secaoId: string
  readonly titulo: string
  /** Um pedaço do texto em volta da primeira ocorrência. */
  readonly trecho: string
}

const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüçñ'
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn'

/**
 * Minúsculas e sem acento, **preservando o comprimento**: um índice achado no
 * texto normalizado vale no texto original, e é isso que faz o trecho sair
 * recortado no lugar certo. `normalize('NFD')` não serve — ele muda o tamanho
 * da string e desalinha os índices.
 */
export function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/[\u0080-\uffff]/g, (c) => {
    const i = ACENTOS.indexOf(c)
    return i < 0 ? c : SEM_ACENTO[i]!
  })
}

/** Todo o texto de uma seção, de qualquer tipo de bloco, sem a marcação. */
function textoDaSecao(secao: ManualSecao): string {
  const partes: string[] = []
  for (const bloco of secao.blocos) {
    switch (bloco.kind) {
      case 'texto':
      case 'nota':
      case 'codigo':
        partes.push(bloco.texto)
        break
      case 'passos':
      case 'lista':
        partes.push(...bloco.itens)
        break
      case 'tabela':
        partes.push(...bloco.cabecalho, ...bloco.linhas.flat())
        break
    }
  }
  // Backtick e asterisco são marcação, não texto: quem procura `S.S.1` não
  // digita as crases, e elas atrapalhariam o recorte do trecho.
  return partes.join(' · ').replace(/[`*]/g, '')
}

interface Entrada extends Omit<ResultadoBusca, 'trecho'> {
  readonly texto: string
  readonly normTitulo: string
  readonly normTexto: string
}

const INDICE: readonly Entrada[] = GUIAS.flatMap((g) =>
  SECOES[g.rota].map((secao) => {
    const texto = textoDaSecao(secao)
    return {
      rota: g.rota,
      guia: g.rotulo,
      icone: secao.icone ?? g.icone,
      secaoId: secao.id,
      titulo: secao.titulo,
      texto,
      normTitulo: normalizar(secao.titulo),
      normTexto: normalizar(texto),
    }
  }),
)

/** Recorta o texto em volta de `pos`, sem partir palavra na ponta esquerda. */
function recortar(texto: string, pos: number, raio = 70): string {
  if (pos < 0) return texto.length > raio * 2 ? `${texto.slice(0, raio * 2)}…` : texto
  let ini = Math.max(0, pos - raio)
  if (ini > 0) {
    const espaco = texto.indexOf(' ', ini)
    if (espaco >= 0 && espaco < pos) ini = espaco + 1
  }
  const fim = Math.min(texto.length, ini + raio * 2 + 30)
  return `${ini > 0 ? '…' : ''}${texto.slice(ini, fim).trimEnd()}${fim < texto.length ? '…' : ''}`
}

/**
 * Seções que contêm **todos** os termos da consulta, título primeiro. Termo
 * casa como pedaço de palavra — "cont" acha "contador" —, o que para uma caixa
 * que busca a cada tecla vale mais do que casar palavra inteira.
 */
export function buscar(consulta: string, limite = 12): readonly ResultadoBusca[] {
  const termos = normalizar(consulta.trim()).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return []

  const achados: { entrada: Entrada; peso: number; pos: number }[] = []
  for (const entrada of INDICE) {
    let peso = 0
    let pos = -1
    let completa = true
    for (const termo of termos) {
      const noTitulo = entrada.normTitulo.indexOf(termo)
      const noTexto = entrada.normTexto.indexOf(termo)
      if (noTitulo < 0 && noTexto < 0) {
        completa = false
        break
      }
      if (noTitulo >= 0) peso += entrada.normTitulo === termo ? 6 : 3
      if (pos < 0) pos = noTexto
    }
    if (completa) achados.push({ entrada, peso, pos })
  }

  // `sort` é estável: empate mantém a ordem do índice, que é a ordem de
  // leitura dos guias — manual, linguagem, glossário.
  achados.sort((a, b) => b.peso - a.peso)

  return achados.slice(0, limite).map(({ entrada, pos }) => ({
    rota: entrada.rota,
    guia: entrada.guia,
    icone: entrada.icone,
    secaoId: entrada.secaoId,
    titulo: entrada.titulo,
    trecho: recortar(entrada.texto, pos),
  }))
}

/**
 * Onde a consulta casa no texto: pares `[início, fim)` em ordem e sem
 * sobreposição — dois termos que se encavalam ("cont" e "contador") viram uma
 * faixa só.
 *
 * É a peça compartilhada entre os dois realces: a lista de resultados quebra o
 * texto em `<mark>` (`realcar`), e a página inteira pinta as mesmas faixas com
 * `Range`s na Custom Highlight API (`Manual.tsx`).
 */
export function faixasQueCasam(texto: string, consulta: string): [number, number][] {
  const termos = normalizar(consulta.trim()).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return []

  const alvo = normalizar(texto)
  const cruas: [number, number][] = []
  for (const termo of termos) {
    for (let i = alvo.indexOf(termo); i >= 0; i = alvo.indexOf(termo, i + termo.length)) {
      cruas.push([i, i + termo.length])
    }
  }
  cruas.sort((a, b) => a[0] - b[0])

  const juntas: [number, number][] = []
  for (const [ini, fim] of cruas) {
    const ultima = juntas.at(-1)
    if (ultima && ini <= ultima[1]) ultima[1] = Math.max(ultima[1], fim)
    else juntas.push([ini, fim])
  }
  return juntas
}

/** Quebra o texto nos pedaços que casam com a consulta, para grifá-los. */
export function realcar(texto: string, consulta: string): { texto: string; marca: boolean }[] {
  const partes: { texto: string; marca: boolean }[] = []
  let cursor = 0
  for (const [ini, fim] of faixasQueCasam(texto, consulta)) {
    if (ini > cursor) partes.push({ texto: texto.slice(cursor, ini), marca: false })
    partes.push({ texto: texto.slice(ini, fim), marca: true })
    cursor = fim
  }
  if (cursor < texto.length) partes.push({ texto: texto.slice(cursor), marca: false })
  return partes
}
