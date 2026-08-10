/**
 * Um template é um `.MPC` parametrizado: gera texto a partir de valores
 * escolhidos num formulário. Cada um é testado para passar pelo parser e
 * pelo validador **sem nenhum diagnóstico**, nos valores padrão — é a
 * garantia de que abrir um template nunca mostra um erro antes mesmo de
 * mexer em nada.
 */

export type TemplateParamType = 'numero' | 'texto'

export interface TemplateParam {
  readonly id: string
  readonly label: string
  readonly type: TemplateParamType
  readonly default: string
  readonly ajuda?: string
}

export interface Template {
  readonly id: string
  readonly label: string
  readonly icone: string
  /** Uma frase — o que este esquema ensina. */
  readonly resumo: string
  /** Um parágrafo — como funciona, em linguagem de laboratório. */
  readonly explicacao: string
  readonly params: readonly TemplateParam[]
  readonly gerar: (valores: Readonly<Record<string, string>>) => string
}

export function defaultValues(template: Template): Record<string, string> {
  return Object.fromEntries(template.params.map((p) => [p.id, p.default]))
}
