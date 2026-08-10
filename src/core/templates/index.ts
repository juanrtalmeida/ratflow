import { autoshaping } from './autoshaping.ts'
import { concorrente } from './concorrente.ts'
import { drl } from './drl.ts'
import { extincao } from './extincao.ts'
import { fr } from './fr.ts'
import { pr } from './pr.ts'
import type { Template } from './types.ts'
import { vi } from './vi.ts'
import { vr } from './vr.ts'
import { vt } from './vt.ts'

export type { Template, TemplateParam, TemplateParamType } from './types.ts'
export { defaultValues } from './types.ts'

/**
 * A biblioteca inteira. Ordenada da mais simples (razão fixa) para a mais
 * elaborada — é também a ordem que faz sentido para quem está aprendendo.
 */
export const ALL_TEMPLATES: readonly Template[] = [
  fr,
  vr,
  vi,
  vt,
  pr,
  drl,
  extincao,
  autoshaping,
  concorrente,
]

export function templateById(id: string): Template | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id)
}
