import { ESTILO } from './estilo-conteudo.ts'
import { GLOSSARIO } from './glossario-conteudo.ts'
import { LINGUAGEM } from './linguagem-conteudo.ts'
import { MANUAL, type ManualSecao } from './manual-conteudo.ts'
import type { RotaGuia } from './rota.ts'

/**
 * O texto de cada guia. Os rótulos e a ordem vivem em `GUIAS` (`rota.ts`).
 *
 * Mora aqui, e não em `Raiz.tsx`, porque a busca (`manual-busca.ts`) precisa
 * das três páginas para indexar — e importá-las da raiz do app faria um ciclo.
 */
export const SECOES: Record<RotaGuia, readonly ManualSecao[]> = {
  manual: MANUAL,
  linguagem: LINGUAGEM,
  estilo: ESTILO,
  glossario: GLOSSARIO,
}
