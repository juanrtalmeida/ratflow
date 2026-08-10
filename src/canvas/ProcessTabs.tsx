import type { Program } from '../core/ast.ts'
import { stateSetLabel } from '../core/ast.ts'
import { GlossaryHint } from '../ui/Glossary.tsx'
import { collectSignals } from './signals.ts'
import './ProcessTabs.css'

export interface ProcessTabsProps {
  readonly program: Program
  readonly activeIndex: number
  readonly onSelect: (stateSetIndex: number) => void
  readonly onCreateProcess?: () => void
  readonly onOpenGlossary?: (id: string) => void
}

/**
 * Uma aba por processo paralelo (`S.S.n`) e, quando há mais de um, um resumo
 * de como eles conversam por sinal `Z` — cada sinal é um broadcast, não uma
 * seta de um processo para outro só.
 */
export function ProcessTabs({
  program,
  activeIndex,
  onSelect,
  onCreateProcess,
  onOpenGlossary,
}: ProcessTabsProps) {
  const signals = collectSignals(program)

  return (
    <div className="process-tabs">
      <div className="process-tabs-row" role="tablist">
        {program.stateSets.map((stateSet) => (
          <button
            key={stateSet.index}
            type="button"
            role="tab"
            aria-selected={stateSet.index === activeIndex}
            className={`process-tab${stateSet.index === activeIndex ? ' process-tab--active' : ''}`}
            onClick={() => onSelect(stateSet.index)}
          >
            <span className="process-tab-indice">{stateSet.index}</span>
            <span className="process-tab-nome">{stateSetLabel(stateSet)}</span>
            <span className="process-tab-conta">
              {stateSet.states.length}{' '}
              {stateSet.states.length === 1 ? 'estado' : 'estados'}
            </span>
          </button>
        ))}
        {onCreateProcess && (
          <button
            type="button"
            className="process-tab process-tab--novo"
            title="Novo processo"
            onClick={onCreateProcess}
          >
            +
          </button>
        )}
      </div>

      {signals.length > 0 && (
        <div className="process-signals">
          <span className="process-signals-titulo">
            Como os processos conversam
            {onOpenGlossary && <GlossaryHint id="sinal-z" onOpen={onOpenGlossary} />}
          </span>
          <ul className="process-signals-lista">
            {signals.map((signal) => (
              <li key={signal.number}>
                <span className="process-signals-icone">📩</span>
                <SignalUses
                  label="avisa"
                  uses={signal.emits}
                  program={program}
                  onJump={onSelect}
                />
                <span className="process-signals-numero">sinal {signal.number}</span>
                <SignalUses
                  label="espera"
                  uses={signal.waits}
                  program={program}
                  onJump={onSelect}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SignalUses({
  label,
  uses,
  program,
  onJump,
}: {
  label: string
  uses: readonly { stateSetIndex: number; stateIndex: number }[]
  program: Program
  onJump: (stateSetIndex: number) => void
}) {
  if (uses.length === 0) return <span className="process-signals-vazio">ninguém {label}</span>

  return (
    <span>
      {label}{' '}
      {uses.map((use, i) => {
        const stateSet = program.stateSets.find((s) => s.index === use.stateSetIndex)
        return (
          <span key={`${use.stateSetIndex}.${use.stateIndex}`}>
            {i > 0 && ', '}
            <button
              type="button"
              className="process-signals-link"
              onClick={() => onJump(use.stateSetIndex)}
            >
              {stateSet ? stateSetLabel(stateSet) : `Processo ${use.stateSetIndex}`}
            </button>
          </span>
        )
      })}
    </span>
  )
}
