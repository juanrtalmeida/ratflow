import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import fr5 from '../../fixtures/fr5-sintetico.MPC?raw'
import { Paleta } from '../canvas/Paleta.tsx'
import { ProtocolCanvas, type ProtocolCanvasHandle } from '../canvas/level1/ProtocolCanvas.tsx'
import type { ProtocolEdgeData } from '../canvas/level1/protocol-graph.ts'
import { LogicCanvas } from '../canvas/level2/LogicCanvas.tsx'
import {
  findState,
  findStateAtOffset,
  findStateSet,
  findStatementIndexAtOffset,
  stateLabel,
  stateSetLabel,
  type Target,
} from '../core/ast.ts'
import type { TextEdit } from '../core/edit.ts'
import {
  createDevice,
  createProcess,
  createState,
  createTransition,
  deleteState,
  deleteStatement,
  insertStateInTransition,
  renameState,
  retargetTransition,
  setCounterAlias,
  setStatePosition,
} from '../core/mutations.ts'
import { parseProgram } from '../core/parser.ts'
import type { Snapshot } from '../core/simulate/machine.ts'
import { defaultValues, templateById } from '../core/templates/index.ts'
import { buildIndex, validate } from '../core/validate/index.ts'
import { CodeEditor, type CodeEditorHandle } from '../editor/CodeEditor.tsx'
import { loadSession, saveSession } from '../project/db.ts'
import { openMpcFile, saveMpcFile } from '../project/files.ts'
import { suggestCounters } from '../vocab/counters.ts'
import { profileFromSuggestions, suggestDevices } from '../vocab/profile.ts'
import { ActionsDrawer } from './ActionsDrawer.tsx'
import { Glossary } from './Glossary.tsx'
import { OnboardingTour } from './OnboardingTour.tsx'
import { ProtocolSheet } from './ProtocolSheet.tsx'
import { SimulatorPanel } from './SimulatorPanel.tsx'
import { TemplateGallery } from './TemplateGallery.tsx'
import './App.css'

const DIALECT = 'V' as const
const AUTOSAVE_DEBOUNCE_MS = 800

/**
 * Ações escondidas da paleta. Vazio hoje: "ligar por um tempo" já escreve o
 * estado auxiliar com o `OFF` (ver `expandPulse`). Fica como o lugar óbvio
 * para tirar do ar uma ação cujo caminho de escrita não esteja pronto.
 */
const ACOES_SEM_PALETA: readonly string[] = []

type SidePanel = 'none' | 'code' | 'simulator'

/**
 * Casca da aplicação. Sem backend, sem service worker: o projeto sobrevive a
 * fechar a aba pelo IndexedDB (autosave) e vai para o disco pela File System
 * Access API (com fallback de `<input>`/download onde ela não existe). O que
 * já funciona de ponta a ponta: abrir/criar/salvar um arquivo, montar e
 * editar o protocolo nos dois níveis do canvas ou direto no código, com um
 * único histórico de desfazer e espelhamento nos dois sentidos entre as telas.
 */
export function App() {
  const codeEditorRef = useRef<CodeEditorHandle>(null)
  const protocolCanvasRef = useRef<ProtocolCanvasHandle>(null)
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null)

  // `null` = ainda recuperando a última sessão do IndexedDB.
  const [text, setText] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const [activeStateSet, setActiveStateSet] = useState(1)
  const [openState, setOpenState] = useState<number | null>(null)
  const [sidePanel, setSidePanel] = useState<SidePanel>('none')
  const [cursorOffset, setCursorOffset] = useState<number | null>(null)
  const [simSnapshot, setSimSnapshot] = useState<Snapshot | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showProtocolSheet, setShowProtocolSheet] = useState(false)
  const [glossaryFocus, setGlossaryFocus] = useState<string | null>(null)
  const [showGlossary, setShowGlossary] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)

  useEffect(() => {
    let cancelado = false
    loadSession()
      .then((sessao) => {
        if (cancelado) return
        setText(sessao?.text ?? fr5)
        setFileName(sessao?.fileName ?? null)
      })
      .catch(() => {
        if (!cancelado) setText(fr5)
      })
    return () => {
      cancelado = true
    }
  }, [])

  // Autosave: debounced, para não gravar a cada tecla.
  useEffect(() => {
    if (text === null) return
    const timer = setTimeout(() => {
      saveSession(text, fileName)
        .then(() => setLastSavedAt(Date.now()))
        .catch(() => {
          /* autosave é conveniência, não crítico — uma falha aqui não deve incomodar o usuário */
        })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, fileName])

  const program = useMemo(() => parseProgram(text ?? ''), [text])
  const diagnostics = useMemo(() => validate(program, { dialect: DIALECT }), [program])
  const profile = useMemo(
    () => profileFromSuggestions(suggestDevices(program)),
    [program],
  )
  const index = useMemo(() => buildIndex(program), [program])
  const counters = useMemo(() => suggestCounters(program), [program])

  const stateSet = findStateSet(program, activeStateSet) ?? program.stateSets[0]
  const state = stateSet && openState !== null ? findState(stateSet, openState) : undefined

  // Espelhamento código → canvas: em qual estado (e, se o nível 2 está
  // aberto, em qual regra) o cursor do editor está agora.
  const highlightedState =
    stateSet && cursorOffset !== null ? (findStateAtOffset(stateSet, cursorOffset)?.index ?? null) : null
  const highlightedStatement =
    state && cursorOffset !== null ? findStatementIndexAtOffset(state, cursorOffset) : null

  // Toda mutação do canvas entra como uma transação do CodeMirror — é isso
  // que faz canvas e código dividirem uma única pilha de desfazer.
  //
  // Os handlers abaixo (até `handleSelectStatement`) são `useCallback` por um
  // motivo concreto, não por hábito: `ProtocolCanvas` usa `onRenameState`/
  // `onDeleteState` na dependência do `useMemo` que monta os nós do React
  // Flow. Sem memoização, essas funções nascem de novo a cada render — e o
  // simulador rodando dispara um render por quadro (`setSimSnapshot` no
  // `requestAnimationFrame` do `Clock`). Cada nó "novo" (mesmo com o mesmo
  // conteúdo) faz o React Flow marcá-lo como não medido (`measured` some) até
  // o `ResizeObserver` medir de novo — e como o próximo quadro já reseta tudo
  // antes disso terminar, os nós (e as arestas, que dependem deles) ficam
  // presos em `visibility: hidden` para sempre. É o bug "o grafo some ao
  // clicar em Rodar" relatado pelo usuário.
  const applyToText = useCallback(
    (edits: readonly TextEdit[]) => codeEditorRef.current?.applyEdits(edits),
    [],
  )

  const handleMoveState = useCallback(
    (stateIndex: number, pos: { x: number; y: number }) => {
      const alvo = stateSet && findState(stateSet, stateIndex)
      if (alvo) applyToText(setStatePosition(alvo, pos))
    },
    [stateSet, applyToText],
  )

  const handleCreateState = useCallback(
    (pos: { x: number; y: number }, papel?: string) => {
      if (!stateSet) return
      const { edits } = createState(stateSet, text ?? '', { pos, papel })
      applyToText(edits)
    },
    [stateSet, text, applyToText],
  )

  const handleRenameState = useCallback(
    (stateIndex: number) => {
      const alvo = stateSet && findState(stateSet, stateIndex)
      if (!alvo) return
      const nome = window.prompt('Novo nome para o estado:', stateLabel(alvo))
      if (nome !== null && nome.trim() !== '') applyToText(renameState(alvo, nome.trim()))
    },
    [stateSet, applyToText],
  )

  const handleDeleteState = useCallback(
    (stateIndex: number) => {
      const alvo = stateSet && findState(stateSet, stateIndex)
      if (!alvo) return
      const confirmado = window.confirm(
        `Excluir o estado «${stateLabel(alvo)}»? Transições de outros estados que apontam para ele ` +
          'ficam sinalizadas como problema, não corrigidas sozinhas.',
      )
      if (confirmado) applyToText(deleteState(alvo))
    },
    [stateSet, applyToText],
  )

  const handleRetargetTransition = useCallback(
    (target: Target, newState: number | 'SX') => {
      applyToText(retargetTransition(target, newState))
    },
    [applyToText],
  )

  const handleCreateTransition = useCallback(
    (from: number, to: number | 'SX') => {
      const alvo = stateSet && findState(stateSet, from)
      if (alvo) applyToText(createTransition(text ?? '', alvo, to))
    },
    [stateSet, text, applyToText],
  )

  const handleInsertStateInTransition = useCallback(
    (edge: ProtocolEdgeData, papel?: string) => {
      if (!stateSet) return
      const { edits } = insertStateInTransition(text ?? '', stateSet, edge.astTarget, { papel })
      applyToText(edits)
    },
    [stateSet, text, applyToText],
  )

  const handleDeleteTransition = useCallback(
    (edge: ProtocolEdgeData) => {
      const alvo = stateSet && findState(stateSet, edge.stateIndex)
      const statement = alvo?.statements[edge.statementIndex]
      if (!statement) return

      // Uma seta que é um ramo de `Se…` não pode ser apagada sozinha: o `IF`
      // ficaria apontando para um rótulo que não existe mais, e a regra inteira
      // cairia no caminho cru. Quem quer mexer nisso mexe no nível 2, onde os
      // dois ramos estão à vista.
      if (edge.segmentCount > 1) {
        window.alert(
          'Esta seta é um ramo de um "Se…". Abra o estado (duplo clique) para mexer nos ramos.',
        )
        return
      }

      if (window.confirm(`Excluir a transição «${edge.label}»? A regra inteira sai do arquivo.`)) {
        applyToText(deleteStatement(text ?? '', statement))
      }
    },
    [stateSet, text, applyToText],
  )

  // Declarar hardware é escrever no preâmbulo e deixar a inferência achar: o
  // perfil não é um banco à parte, é lido do próprio arquivo a cada parse.
  const handleCreateDevice = useCallback(
    (nome: string, porta: number) => applyToText(createDevice(program, text ?? '', nome, porta)),
    [program, text, applyToText],
  )

  const handleCounterAlias = useCallback(
    (variable: string, alias: string) =>
      applyToText(setCounterAlias(program, text ?? '', variable, alias)),
    [program, text, applyToText],
  )

  const handleCreateProcess = () => {
    const { edits, index } = createProcess(program, text ?? '')
    applyToText(edits)
    setActiveStateSet(index)
  }

  // Espelhamento canvas → código: selecionar um estado ou uma regra revela
  // o trecho correspondente no editor (abrindo-o se estiver escondido).
  const revealAndShowCode = useCallback((span: readonly [number, number]) => {
    setSidePanel('code')
    codeEditorRef.current?.revealSpan(span)
  }, [])
  const handleSelectState = useCallback(
    (stateIndex: number) => {
      const alvo = stateSet && findState(stateSet, stateIndex)
      if (alvo) revealAndShowCode(alvo.span)
    },
    [stateSet, revealAndShowCode],
  )
  const handleSelectStatement = (statementIndex: number) => {
    const statement = state?.statements[statementIndex]
    if (statement) revealAndShowCode(statement.span)
  }

  const resetNavigation = () => {
    setOpenState(null)
    setActiveStateSet(1)
  }

  const handleNew = () => {
    if (
      !window.confirm(
        'Começar um arquivo em branco? O que está na tela continua guardado automaticamente, ' +
          'mas se ainda não salvou num arquivo do disco, é só o autosave que lembra dele.',
      )
    ) {
      return
    }
    fileHandleRef.current = null
    setFileName(null)
    resetNavigation()
    codeEditorRef.current?.setText('')
  }

  const handleUseTemplate = (gerado: string) => {
    fileHandleRef.current = null
    setFileName(null)
    resetNavigation()
    codeEditorRef.current?.setText(gerado)
    setShowTemplates(false)
  }

  const handleExportPng = () => {
    protocolCanvasRef.current?.exportarPng(`${fileName ?? 'protocolo'}.png`)
  }
  const handleExportSvg = () => {
    protocolCanvasRef.current?.exportarSvg(`${fileName ?? 'protocolo'}.svg`)
  }

  const handleOpenGlossary = (id: string) => {
    setGlossaryFocus(id)
    setShowGlossary(true)
  }

  // O tour avança em resposta a ações reais do app, não a uma simulação
  // própria — passo 1 abre de verdade o modelo de razão fixa, passo 2 abre
  // de verdade o simulador; o passo 3 fica esperando um `useEffect` notar
  // que o simulador reforçou uma resposta.
  const handleTourAction = () => {
    if (tourStep === 0) {
      setTourStep(1)
    } else if (tourStep === 1) {
      const fr = templateById('fr')!
      handleUseTemplate(fr.gerar(defaultValues(fr)))
      setTourStep(2)
    } else if (tourStep === 2) {
      setSidePanel('simulator')
      setTourStep(3)
    } else if (tourStep === 4) {
      setTourStep(null)
    }
  }
  const handleTourSkip = () => setTourStep(null)

  // Avança quando o processo "Tarefa" (S.S.1) chega no estado "Reforço"
  // (S3 no template de razão fixa) — não por um contador específico, porque
  // `ADD Reforcos` só roda no tick seguinte ao entrar no estado (o gatilho
  // de entrada é um tique quase instantâneo, `.01"`, não instantâneo de
  // verdade); observar a transição em si é o que a mensagem do passo promete.
  useEffect(() => {
    if (tourStep !== 3) return
    if (simSnapshot?.currentStates.get(1) === 3) setTourStep(4)
  }, [tourStep, simSnapshot])

  const handleOpen = async () => {
    const opened = await openMpcFile()
    if (!opened) return
    fileHandleRef.current = opened.handle
    setFileName(opened.fileName)
    resetNavigation()
    codeEditorRef.current?.setText(opened.text)
  }

  const handleSave = async () => {
    const currentText = codeEditorRef.current?.getText() ?? text ?? ''
    const saved = await saveMpcFile(currentText, fileHandleRef.current, fileName ?? 'programa.mpc')
    if (saved) {
      fileHandleRef.current = saved.handle
      setFileName(saved.fileName)
    }
  }

  const handleSaveAs = async () => {
    const currentText = codeEditorRef.current?.getText() ?? text ?? ''
    const saved = await saveMpcFile(currentText, null, fileName ?? 'programa.mpc')
    if (saved) {
      fileHandleRef.current = saved.handle
      setFileName(saved.fileName)
    }
  }

  if (text === null) {
    return (
      <div className="app">
        <p className="app-placeholder">Recuperando a última sessão…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-bar">
        <button
          type="button"
          className="app-bar-menu"
          onClick={() => setShowDrawer(true)}
          title="Abrir menu de ações"
          aria-label="Abrir menu de ações"
        >
          ☰
        </button>
        <span className="app-bar-brand">
          <img src="/favicon.svg" alt="" className="app-bar-logo" width={22} height={22} />
          <span className="app-bar-wordmark">RatFlow</span>
        </span>
        {state && stateSet ? (
          <span className="app-bar-sub app-breadcrumb">
            <button type="button" className="app-breadcrumb-back" onClick={() => setOpenState(null)}>
              ← {stateSetLabel(stateSet)}
            </button>
            <span aria-hidden="true"> › </span>
            <span>{stateLabel(state)}</span>
          </span>
        ) : (
          // O "+" aparece mesmo num arquivo sem nenhum processo: é o único
          // caminho para criar o primeiro.
          <span className="app-bar-sub app-bar-processo">
            {stateSet && (
              <select
                className="app-bar-processo-select"
                value={stateSet.index}
                onChange={(e) => setActiveStateSet(Number(e.target.value))}
                aria-label="Processo"
                title="Processo paralelo (S.S.n)"
              >
                {program.stateSets.map((s) => (
                  <option key={s.index} value={s.index}>
                    {stateSetLabel(s)} · {s.states.length}{' '}
                    {s.states.length === 1 ? 'estado' : 'estados'}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="app-bar-processo-novo"
              title="Novo processo"
              aria-label="Novo processo"
              onClick={handleCreateProcess}
            >
              +
            </button>
          </span>
        )}
        <span className="app-bar-sub">{fileName ?? 'sem título'}</span>
        <button
          type="button"
          className="app-bar-toggle-code"
          aria-pressed={sidePanel === 'simulator'}
          onClick={() => setSidePanel((p) => (p === 'simulator' ? 'none' : 'simulator'))}
        >
          ▶ simular
        </button>
        <button
          type="button"
          className="app-bar-toggle-code"
          aria-pressed={sidePanel === 'code'}
          onClick={() => setSidePanel((p) => (p === 'code' ? 'none' : 'code'))}
        >
          {'</>'} código
        </button>
      </header>

      <ActionsDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        fileName={fileName}
        lastSavedAt={lastSavedAt}
        canExport={!state && !!stateSet}
        onNew={handleNew}
        onOpen={handleOpen}
        onTemplates={() => setShowTemplates(true)}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onProtocolSheet={() => setShowProtocolSheet(true)}
        onGlossary={() => {
          setGlossaryFocus(null)
          setShowGlossary(true)
        }}
        onTour={() => setTourStep(0)}
      />

      <main className="app-body">
        <div className="app-canvas-area">
          {stateSet && (
            <Paleta
              nivel={state ? 2 : 1}
              program={program}
              profile={profile}
              index={index}
              counters={counters}
              onCriarDispositivo={handleCreateDevice}
              onApelidarContador={handleCounterAlias}
              onSelecionarProcesso={setActiveStateSet}
              onOpenGlossary={handleOpenGlossary}
              ocultarAcoes={ACOES_SEM_PALETA}
            />
          )}
          {state && stateSet ? (
            <LogicCanvas
              key={`${stateSet.index}.${state.index}`}
              text={text}
              program={program}
              stateSet={stateSet}
              state={state}
              profile={profile}
              onApplyEdits={applyToText}
              onSelectStatement={handleSelectStatement}
              highlightedStatement={highlightedStatement}
            />
          ) : stateSet ? (
            <ProtocolCanvas
              ref={protocolCanvasRef}
              key={stateSet.index}
              stateSet={stateSet}
              program={program}
              profile={profile}
              diagnostics={diagnostics}
              onMoveState={handleMoveState}
              onOpenState={setOpenState}
              onCreateState={handleCreateState}
              onRenameState={handleRenameState}
              onDeleteState={handleDeleteState}
              onRetargetTransition={handleRetargetTransition}
              onCreateTransition={handleCreateTransition}
              onInsertStateInTransition={handleInsertStateInTransition}
              onDeleteTransition={handleDeleteTransition}
              onSelectState={handleSelectState}
              highlightedState={highlightedState}
              activeState={
                sidePanel === 'simulator' ? (simSnapshot?.currentStates.get(stateSet.index) ?? null) : null
              }
            />
          ) : (
            <p className="app-placeholder">
              Este arquivo não tem nenhum processo (S.S.n) ainda — clique em "+" na barra do topo
              para criar o primeiro.
            </p>
          )}
        </div>

        <div className={`app-code-area${sidePanel === 'code' ? '' : ' app-code-area--escondida'}`}>
          <CodeEditor
            ref={codeEditorRef}
            initialText={text}
            dialect={DIALECT}
            onChange={setText}
            onCursorOffset={setCursorOffset}
          />
        </div>

        {sidePanel === 'simulator' && (
          <div className="app-code-area">
            <SimulatorPanel
              program={program}
              profile={profile}
              onSnapshot={setSimSnapshot}
              onOpenGlossary={handleOpenGlossary}
            />
          </div>
        )}
      </main>

      {showTemplates && (
        <TemplateGallery onUse={handleUseTemplate} onClose={() => setShowTemplates(false)} />
      )}

      {showProtocolSheet && (
        <ProtocolSheet
          program={program}
          profile={profile}
          fileName={fileName}
          onClose={() => setShowProtocolSheet(false)}
        />
      )}

      {showGlossary && (
        <Glossary focusId={glossaryFocus} onClose={() => setShowGlossary(false)} />
      )}

      {tourStep !== null && (
        <OnboardingTour step={tourStep} onAction={handleTourAction} onSkip={handleTourSkip} />
      )}
    </div>
  )
}
