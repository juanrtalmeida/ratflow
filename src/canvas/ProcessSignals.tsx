import type { Program } from '../core/ast.ts'
import { stateSetLabel } from '../core/ast.ts'
import { GlossaryHint } from '../ui/Glossary.tsx'
import { collectSignals } from './signals.ts'
import './ProcessSignals.css'

export interface ProcessSignalsProps {
  readonly program: Program
  /** Clicar no nome de um processo pula para ele. */
  readonly onSelect: (stateSetIndex: number) => void
  readonly onOpenGlossary?: (id: string) => void
}

/**
 * Como os processos paralelos conversam por sinal `Z` — cada sinal é um
 * broadcast, não uma seta de um processo para outro só.
 *
 * Mora na paleta, não numa faixa sobre o canvas: é informação de leitura, e a
 * troca de processo em si virou o seletor da barra do topo.
 */
export function ProcessSignals({ program, onSelect, onOpenGlossary }: ProcessSignalsProps) {
  const signals = collectSignals(program)
  if (signals.length === 0) return null

  return (
    <details className="process-signals">
      <summary>
        Como os processos conversam
        {onOpenGlossary && <GlossaryHint id="sinal-z" onOpen={onOpenGlossary} />}
      </summary>
      <ul className="process-signals-lista">
        {signals.map((signal) => (
          <li key={signal.number}>
            <span className="process-signals-numero">📩 sinal {signal.number}</span>
            <SignalUses label="avisa" uses={signal.emits} program={program} onJump={onSelect} />
            <SignalUses label="espera" uses={signal.waits} program={program} onJump={onSelect} />
          </li>
        ))}
      </ul>
    </details>
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
