import { stateLabel, stateSetLabel, type Program } from '../core/ast.ts'
import { buildIndex } from '../core/validate/index.ts'
import { createNarrator } from '../vocab/narrate.ts'
import type { HardwareProfile } from '../vocab/profile.ts'
import './ProtocolSheet.css'

export interface ProtocolSheetProps {
  readonly program: Program
  readonly profile: HardwareProfile
  readonly fileName: string | null
  readonly onClose: () => void
}

/**
 * A folha de protocolo para a seção de Métodos: monta-se inteira a partir do
 * que já existe — perfil de hardware, `VAR_ALIAS`, `DISKVARS`, e o narrador
 * traduzindo cada regra para prosa. Nada aqui é uma segunda fonte de
 * verdade; é uma leitura do `.MPC`, não um documento à parte para
 * desatualizar.
 */
export function ProtocolSheet({ program, profile, fileName, onClose }: ProtocolSheetProps) {
  const index = buildIndex(program)
  const narrator = createNarrator(program, profile)

  const portas = new Set(profile.devices.map((d) => d.constante))
  const parametros = [...index.constants].filter(([nome]) => !portas.has(nome))

  return (
    <div className="protocol-sheet-overlay" onClick={onClose}>
      <div className="protocol-sheet-shell" onClick={(e) => e.stopPropagation()}>
        <header className="protocol-sheet-toolbar">
          <h2>Folha de protocolo</h2>
          <div className="protocol-sheet-toolbar-acoes">
            <button type="button" onClick={() => window.print()}>
              🖨 Imprimir / salvar PDF
            </button>
            <button type="button" onClick={onClose} title="Fechar">
              ✕
            </button>
          </div>
        </header>

        <article className="protocol-sheet">
          <h1>{fileName ?? 'Protocolo MedState'}</h1>
          <p className="protocol-sheet-gerado">
            Gerado pelo RatFlow a partir do arquivo `.MPC` — {program.stateSets.length}{' '}
            {program.stateSets.length === 1 ? 'processo' : 'processos'} paralelos.
          </p>

          <section>
            <h2>Dispositivos</h2>
            {profile.devices.length === 0 ? (
              <p className="protocol-sheet-vazio">Nenhum dispositivo reconhecido neste perfil.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Dispositivo</th>
                    <th>Função</th>
                    <th>Porta</th>
                    <th>Constante</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.devices.map((d) => (
                    <tr key={d.constante}>
                      <td>
                        {d.icon} {d.label}
                      </td>
                      <td>{d.kind === 'entrada' ? 'Entrada (resposta)' : 'Saída (estímulo/reforço)'}</td>
                      <td>{d.porta}</td>
                      <td>^{d.constante}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Variáveis</h2>
            {index.aliasOf.size === 0 ? (
              <p className="protocol-sheet-vazio">Nenhuma variável com apelido (VAR_ALIAS) neste arquivo.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Variável</th>
                    <th>Vai para o arquivo de dados</th>
                  </tr>
                </thead>
                <tbody>
                  {[...index.aliasOf].map(([variavel, apelido]) => (
                    <tr key={variavel}>
                      <td>«{apelido}»</td>
                      <td>{variavel}</td>
                      <td>{index.diskVars.includes(apelido) ? 'Sim' : 'Não'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Parâmetros</h2>
            {parametros.length === 0 ? (
              <p className="protocol-sheet-vazio">Nenhum parâmetro (constante que não é porta) definido.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {parametros.map(([nome, def]) => (
                    <tr key={nome}>
                      <td>^{nome}</td>
                      <td>{def.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h2>Processos</h2>
            {program.stateSets.map((stateSet) => (
              <div key={stateSet.index} className="protocol-sheet-processo">
                <h3>
                  {stateSet.index}. {stateSetLabel(stateSet)}
                </h3>
                {stateSet.states.map((state) => (
                  <div key={state.index} className="protocol-sheet-estado">
                    <h4>{stateLabel(state)}</h4>
                    <ul>
                      {state.statements.map((statement, i) => (
                        <li key={i}>{narrator.statement(statement, stateSet)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </article>
      </div>
    </div>
  )
}
