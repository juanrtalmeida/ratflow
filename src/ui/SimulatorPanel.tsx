import { useEffect, useMemo, useRef, useState } from 'react'
import { findStateSet, stateSetLabel, type Program } from '../core/ast.ts'
import { Clock } from '../core/simulate/clock.ts'
import { Machine, type Snapshot } from '../core/simulate/machine.ts'
import { buildIndex } from '../core/validate/index.ts'
import type { HardwareProfile } from '../vocab/profile.ts'
import { GlossaryHint } from './Glossary.tsx'
import { VirtualBox } from './VirtualBox.tsx'
import './SimulatorPanel.css'

const SPEEDS = [1, 10, 40] as const

/** ~15 respostas por minuto em média, por dispositivo de entrada, quando o "sujeito virtual" está ligado. */
const VIRTUAL_SUBJECT_RATE_PER_TICK = 15 / 60 / 100

export interface SimulatorPanelProps {
  readonly program: Program
  readonly profile: HardwareProfile
  /** Reportado a cada quadro — é o que acende o estado ativo no canvas de nível 1. */
  readonly onSnapshot?: (snapshot: Snapshot) => void
  readonly onOpenGlossary?: (id: string) => void
}

/**
 * Roda o protocolo de verdade: um interpretador (`core/simulate/machine.ts`)
 * avançando por trás da caixa virtual. **Aproximação para depurar lógica**,
 * não um emulador fiel de timing — a UI diz isso explicitamente, para não
 * prometer mais do que entrega.
 */
export function SimulatorPanel({ program, profile, onSnapshot, onOpenGlossary }: SimulatorPanelProps) {
  const machineRef = useRef<Machine | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [virtualSubject, setVirtualSubject] = useState(false)

  const rebuild = () => {
    clockRef.current?.pause()
    const machine = new Machine(program)
    const clock = new Clock(machine)
    clock.onTick = () => {
      const s = machine.snapshot()
      setSnapshot(s)
      onSnapshot?.(s)
    }
    machineRef.current = machine
    clockRef.current = clock
    setRunning(false)
    const s = machine.snapshot()
    setSnapshot(s)
    onSnapshot?.(s)
  }

  useEffect(() => {
    rebuild()
    return () => clockRef.current?.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program])

  useEffect(() => {
    if (clockRef.current) clockRef.current.speed = speed
  }, [speed])

  useEffect(() => {
    const clock = clockRef.current
    if (!clock) return
    clock.onBeforeTick = virtualSubject
      ? () => {
          const machine = machineRef.current!
          for (const device of profile.devices) {
            if (device.kind !== 'entrada') continue
            if (machine.rng() < VIRTUAL_SUBJECT_RATE_PER_TICK) machine.respond(device.constante)
          }
        }
      : undefined
  }, [virtualSubject, profile])

  const index = useMemo(() => buildIndex(program), [program])

  if (!snapshot) return null

  const play = () => {
    clockRef.current?.play()
    setRunning(true)
  }
  const pause = () => {
    clockRef.current?.pause()
    setRunning(false)
  }

  return (
    <div className="simulator-panel">
      <div className="simulator-controls">
        {running ? (
          <button type="button" onClick={pause}>
            ⏸ Pausar
          </button>
        ) : (
          <button type="button" onClick={play}>
            ▶ Rodar
          </button>
        )}
        <button type="button" disabled={running} onClick={() => clockRef.current?.step(1)}>
          Passo
        </button>
        <button type="button" onClick={rebuild}>
          ↺ Reiniciar
        </button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}× {s === Math.max(...SPEEDS) ? '(máx.)' : ''}
            </option>
          ))}
        </select>
        <label className="simulator-virtual-subject">
          <input
            type="checkbox"
            checked={virtualSubject}
            onChange={(e) => setVirtualSubject(e.target.checked)}
          />
          sujeito virtual
        </label>
        <span className="simulator-tempo">{snapshot.timeSeconds.toFixed(2)} s</span>
      </div>

      <VirtualBox
        profile={profile}
        snapshot={snapshot}
        onRespond={(constante) => {
          machineRef.current?.respond(constante)
          // Com o relógio pausado, um clique só vira efeito no próximo tick —
          // que, pausado, nunca viria. Dá um passo na hora para o clique
          // parecer instantâneo; rodando, o próximo tick agendado já resolve.
          if (!clockRef.current?.running) clockRef.current?.step(1)
        }}
      />

      <div className="simulator-counters">
        <h3>Contadores</h3>
        {index.aliasOf.size === 0 ? (
          <p className="simulator-vazio">Nenhum contador com apelido (VAR_ALIAS) neste arquivo.</p>
        ) : (
          <ul>
            {[...index.aliasOf].map(([variable, alias]) => (
              <li key={variable}>
                «{alias}»: <strong>{snapshot.variables.get(variable)?.get(0) ?? 0}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="simulator-timeline">
        <h3>
          Linha do tempo
          {onOpenGlossary && <GlossaryHint id="reforco" onOpen={onOpenGlossary} />}
        </h3>
        {snapshot.log.length === 0 ? (
          <p className="simulator-vazio">Nada aconteceu ainda.</p>
        ) : (
          <ol>
            {[...snapshot.log]
              .slice(-40)
              .reverse()
              .map((e, i) => {
                const stateSet = findStateSet(program, e.stateSetIndex)
                return (
                  <li key={i} className={`simulator-evento simulator-evento--${e.kind}`}>
                    <span className="simulator-evento-tempo">{(e.tick * 0.01).toFixed(2)}s</span>
                    <span>
                      {stateSet ? stateSetLabel(stateSet) : `Processo ${e.stateSetIndex}`}: {e.message}
                    </span>
                  </li>
                )
              })}
          </ol>
        )}
      </div>

      <p className="simulator-aviso-escopo">
        Aproximação para depurar a lógica do protocolo — não é um emulador fiel de timing do MED-PC.
      </p>
    </div>
  )
}
