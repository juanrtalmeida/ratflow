import { GLOSSARY } from './glossary-terms.ts'
import type { ManualSecao } from './manual-conteudo.ts'

/**
 * O glossário como **página** (`#/glossario`), ao lado do manual e da página
 * da linguagem — mesma casca, mesmo sumário, URL própria e botão voltar.
 *
 * Os termos não são copiados: vêm de `glossary-terms.ts`, os mesmos que o
 * balãozinho "?" do canvas e do simulador mostram. O modal continua existindo
 * porque serve a outra coisa — espiar um termo sem sair do meio de uma edição;
 * a página serve para ler a lista inteira.
 *
 * Um termo por seção: com 13 entradas curtas, o sumário da esquerda vira o
 * índice alfabético da página, e clicar num termo rola até ele.
 */
export const GLOSSARIO: readonly ManualSecao[] = GLOSSARY.map((entrada) => ({
  id: entrada.id,
  titulo: entrada.termo,
  blocos: [{ kind: 'texto', texto: entrada.definicao }],
}))
