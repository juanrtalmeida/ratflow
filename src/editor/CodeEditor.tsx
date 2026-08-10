import { defaultKeymap, historyKeymap, history } from '@codemirror/commands'
import { lintGutter } from '@codemirror/lint'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Span } from '../core/tokens.ts'
import type { TextEdit } from '../core/edit.ts'
import type { DialectId } from '../core/validate/index.ts'
import { medstateComplete } from './medstate-complete.ts'
import { medstateHighlight } from './medstate-highlight.ts'
import { medstateHover } from './medstate-hover.ts'
import { medstateLinter } from './medstate-lint.ts'
import './CodeEditor.css'

export interface CodeEditorHandle {
  /** Aplica `TextEdit[]` como uma transação do CodeMirror — entra no histórico de desfazer. */
  applyEdits: (edits: readonly TextEdit[]) => void
  /** Troca o documento inteiro (abrir um arquivo) — ainda uma transação normal, desfazível. */
  setText: (text: string) => void
  /** Seleciona e rola até um trecho — o lado "canvas → código" do espelhamento. */
  revealSpan: (span: Span) => void
  getText: () => string
}

export interface CodeEditorProps {
  /** Só lido na montagem: depois disso o documento do CodeMirror é que manda. */
  initialText: string
  dialect: DialectId
  onChange: (text: string) => void
  /** Cursor moveu — o lado "código → canvas" do espelhamento. */
  onCursorOffset?: (offset: number) => void
}

/**
 * A segunda visão: o `.MPC` como texto, editável. O CodeMirror é quem
 * possui o documento — mutações do canvas entram por `applyEdits` (uma
 * transação normal, com desfazer), não por trocar a prop `initialText`. É
 * isso que faz canvas e código dividirem uma única pilha de desfazer.
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { initialText, dialect, onChange, onCursorOffset },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const dialectRef = useRef(dialect)
  dialectRef.current = dialect
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onCursorRef = useRef(onCursorOffset)
  onCursorRef.current = onCursorOffset

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current(update.state.doc.toString())
      if (update.selectionSet) onCursorRef.current?.(update.state.selection.main.head)
    })

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        search(),
        // Antes do keymap padrão: quem vem primeiro tem precedência, e o popup
        // precisa das setas e do Enter antes de `defaultKeymap` movê-los.
        medstateComplete(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        lintGutter(),
        medstateLinter(() => dialectRef.current),
        medstateHighlight(),
        medstateHover(),
        updateListener,
        EditorView.theme({ '&': { height: '100%', fontSize: '13px' } }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Monta uma vez só — ver o comentário da interface acima.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      applyEdits(edits) {
        const view = viewRef.current
        if (!view || edits.length === 0) return
        view.dispatch({
          changes: edits.map((e) => ({ from: e.span[0], to: e.span[1], insert: e.newText })),
        })
      },
      setText(text) {
        const view = viewRef.current
        if (!view) return
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        })
      },
      revealSpan(span) {
        const view = viewRef.current
        if (!view) return
        const max = view.state.doc.length
        const from = Math.min(Math.max(span[0], 0), max)
        const to = Math.min(Math.max(span[1], from), max)
        view.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from, { y: 'center' }),
        })
        view.focus()
      },
      getText() {
        return viewRef.current?.state.doc.toString() ?? ''
      },
    }),
    [],
  )

  return <div ref={containerRef} className="code-editor" />
})
