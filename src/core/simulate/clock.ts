import { Machine, TICK_SECONDS } from './machine.ts'

/**
 * Toca a `Machine` em tempo real, num laço de `requestAnimationFrame` — não
 * um `setInterval` por tick (100/s a 1×, inviável de re-renderizar a essa
 * taxa). Acumula o tempo real decorrido e roda quantos ticks forem
 * necessários por quadro, notificando uma vez por quadro, não uma vez por
 * tick.
 */
export class Clock {
  readonly machine: Machine
  speed = 1
  /** Chamado antes de cada tick — é onde o "sujeito virtual" injeta respostas. */
  onBeforeTick?: () => void
  /** Chamado depois de rodar um ou mais ticks num quadro (ou num passo manual). */
  onTick?: () => void

  private rafId: number | null = null
  private lastTimestamp: number | null = null
  private accumulator = 0

  constructor(machine: Machine) {
    this.machine = machine
  }

  get running(): boolean {
    return this.rafId !== null
  }

  play(): void {
    if (this.running) return
    this.lastTimestamp = null
    const loop = (timestamp: number) => {
      if (this.lastTimestamp !== null) {
        const dtSeconds = (timestamp - this.lastTimestamp) / 1000
        this.accumulator += dtSeconds * this.speed
        // Trava um salto gigante (aba voltou do segundo plano) para não
        // travar a página tentando "recuperar o tempo perdido".
        const ticksToRun = Math.min(Math.floor(this.accumulator / TICK_SECONDS), 4000)
        if (ticksToRun > 0) {
          for (let i = 0; i < ticksToRun; i++) {
            this.onBeforeTick?.()
            this.machine.tick()
          }
          this.accumulator -= ticksToRun * TICK_SECONDS
          this.onTick?.()
        }
      }
      this.lastTimestamp = timestamp
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  pause(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.accumulator = 0
  }

  /** Avança manualmente, com o relógio pausado. */
  step(ticks = 1): void {
    for (let i = 0; i < ticks; i++) {
      this.onBeforeTick?.()
      this.machine.tick()
    }
    this.onTick?.()
  }
}
