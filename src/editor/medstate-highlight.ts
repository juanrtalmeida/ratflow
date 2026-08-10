import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { tokenize } from '../core/lexer.ts'
import type { TokenKind } from '../core/tokens.ts'

/**
 * Realce de sintaxe que reaproveita `core/lexer.ts` direto — sem gramática
 * Lezer própria, sem StreamLanguage reimplementando o que o lexer já faz.
 * Percorre o token stream (barato: um só passe sequencial) e produz uma
 * decoração por token relevante. Nunca diverge do que o parser realmente vê,
 * porque é literalmente a mesma função.
 */

const KEYWORDS = new Set([
  'ON',
  'OFF',
  'LOCKON',
  'LOCKOFF',
  'ADD',
  'SUB',
  'SET',
  'SHOW',
  'IF',
  'START',
  'SX',
  'VAR_ALIAS',
  'END',
  'DIM',
  'LIST',
  'DISKVARS',
  'DISKCOLUMNS',
  'DISKFORMAT',
  'RANDD',
  'RANDI',
])

const CLASS_BY_KIND: Partial<Record<TokenKind, string>> = {
  comment: 'cm-medstate-comment',
  number: 'cm-medstate-number',
  caret: 'cm-medstate-sigil',
  hash: 'cm-medstate-sigil',
  at: 'cm-medstate-sigil',
  arrow: 'cm-medstate-arrow',
  quote: 'cm-medstate-time',
  apostrophe: 'cm-medstate-time',
  unknown: 'cm-medstate-unknown',
}

function decorationsFor(text: string): DecorationSet {
  const marks = []
  for (const token of tokenize(text)) {
    if (token.start === token.end) continue

    let cls = CLASS_BY_KIND[token.kind]
    if (token.kind === 'ident' && KEYWORDS.has(token.text.toUpperCase())) {
      cls = 'cm-medstate-keyword'
    }
    if (!cls) continue

    marks.push(Decoration.mark({ class: cls }).range(token.start, token.end))
  }
  return Decoration.set(marks, true)
}

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = decorationsFor(view.state.doc.toString())
    }

    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = decorationsFor(update.state.doc.toString())
      }
    }
  },
  { decorations: (v) => v.decorations },
)

const highlightTheme = EditorView.baseTheme({
  '.cm-medstate-comment': { color: 'var(--text-muted)', fontStyle: 'italic' },
  '.cm-medstate-keyword': { color: 'var(--node-action)', fontWeight: '600' },
  '.cm-medstate-number': { color: 'var(--role-timeout)' },
  '.cm-medstate-sigil': { color: 'var(--accent)', fontWeight: '600' },
  '.cm-medstate-arrow': { color: 'var(--role-wait)', fontWeight: '600' },
  '.cm-medstate-time': { color: 'var(--role-timeout)' },
  '.cm-medstate-unknown': { color: 'var(--error)', textDecoration: 'underline wavy' },
})

export function medstateHighlight() {
  return [highlightPlugin, highlightTheme]
}
