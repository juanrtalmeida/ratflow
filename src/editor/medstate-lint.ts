import { linter, type Diagnostic as CMDiagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import { parseProgram } from '../core/parser.ts'
import { validate, type DialectId } from '../core/validate/index.ts'

/**
 * Linter do CodeMirror alimentado por `core/validate` — a mesma validação
 * que pinta os badges do canvas. Uma lista única de problemas, duas telas.
 */
export function medstateLinter(getDialect: () => DialectId) {
  return linter((view: EditorView): CMDiagnostic[] => {
    const text = view.state.doc.toString()
    const program = parseProgram(text)
    const diagnostics = validate(program, { dialect: getDialect() })
    const max = text.length

    return diagnostics.map((d) => ({
      from: Math.min(Math.max(d.span[0], 0), max),
      to: Math.min(Math.max(d.span[1], d.span[0]), max),
      severity: d.severity,
      message: [d.plain, d.why, d.fix ? `Sugestão: ${d.fix}` : null].filter(Boolean).join('\n\n'),
    }))
  })
}
