import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface Fixture {
  readonly name: string
  readonly text: string
}

const FIXTURES_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url))

/**
 * Carrega todos os `.MPC` de `fixtures/`. Eles são a especificação executável
 * do parser: a suíte exige que abrir e reescrever devolva o arquivo idêntico.
 */
export function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.toLowerCase().endsWith('.mpc'))
    .sort()
    .map((name) => ({
      name,
      text: readFileSync(FIXTURES_DIR + name, 'utf8'),
    }))
}
