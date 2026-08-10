import { useEffect, useRef } from 'react'
import { GLOSSARY } from './glossary-terms.ts'
import './Glossary.css'

export interface GlossaryProps {
  /** Rola até este termo e o destaca, quando aberto por um "?" específico. */
  readonly focusId?: string | null
  readonly onClose: () => void
}

export function Glossary({ focusId, onClose }: GlossaryProps) {
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    if (focusId) itemRefs.current[focusId]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusId])

  return (
    <div className="glossary-overlay" onClick={onClose}>
      <div className="glossary" onClick={(e) => e.stopPropagation()}>
        <header className="glossary-header">
          <h2>Glossário</h2>
          <button type="button" onClick={onClose} title="Fechar">
            ✕
          </button>
        </header>
        <dl className="glossary-lista">
          {GLOSSARY.map((entrada) => (
            <div
              key={entrada.id}
              ref={(el) => {
                itemRefs.current[entrada.id] = el
              }}
              className={`glossary-item${entrada.id === focusId ? ' glossary-item--destacado' : ''}`}
            >
              <dt>{entrada.termo}</dt>
              <dd>{entrada.definicao}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

/** O "?" que aparece ao lado de um termo em qualquer tela do app. */
export function GlossaryHint({
  id,
  onOpen,
}: {
  readonly id: string
  readonly onOpen: (id: string) => void
}) {
  return (
    <button
      type="button"
      className="glossary-hint"
      onClick={() => onOpen(id)}
      title="O que é isso?"
      aria-label="O que é isso?"
    >
      ?
    </button>
  )
}
