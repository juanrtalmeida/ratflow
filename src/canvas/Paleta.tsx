import { useState } from 'react'
import type { Program } from '../core/ast.ts'
import type { ProgramIndex } from '../core/validate/types.ts'
import { CATEGORY_LABELS, EVENT_SPECS, actionsByCategory, type ActionCategory } from '../vocab/catalog.ts'
import { counterLabel, type CounterInfo } from '../vocab/counters.ts'
import { DEVICE_TYPES } from '../vocab/devices.ts'
import type { HardwareProfile } from '../vocab/profile.ts'
import { iniciarArrasto, type BlocoArrastado } from './bloco-arrastado.ts'
import { PAPEL_ICON } from './level1/protocol-graph.ts'
import { ProcessSignals } from './ProcessSignals.tsx'
import './Paleta.css'

/**
 * Paleta de blocos arrastáveis. Um componente para os dois níveis: o que muda
 * é a lista de itens, não o comportamento.
 *
 * A paleta **não conhece os canvases**. Todo o acoplamento é o `dataTransfer`:
 * ela escreve um `BlocoArrastado` em `MIME_BLOCO` e quem recebe decide o que
 * fazer com ele. É por isso que não há callback de inserção aqui.
 */

/** Papéis oferecidos no nível 1 — os mesmos que o card do estado sabe desenhar. */
const PAPEIS: readonly { readonly papel: string | null; readonly label: string }[] = [
  { papel: null, label: 'Estado novo' },
  { papel: 'espera', label: 'Espera' },
  { papel: 'reforco', label: 'Reforço' },
  { papel: 'timeout', label: 'Intervalo' },
  { papel: 'fim', label: 'Fim' },
]

const CATEGORIAS: readonly ActionCategory[] = ['dispositivo', 'contador', 'registro', 'processo']

/** As 26 variáveis do MedState. */
const LETRAS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

export interface PaletaProps {
  readonly nivel: 1 | 2
  readonly program: Program
  readonly profile: HardwareProfile
  readonly index: ProgramIndex
  readonly counters: readonly CounterInfo[]
  readonly onCriarDispositivo: (nome: string, porta: number) => void
  readonly onApelidarContador: (variable: string, alias: string) => void
  readonly onSelecionarProcesso: (stateSetIndex: number) => void
  readonly onOpenGlossary?: (id: string) => void
  /**
   * Ações que ainda não têm caminho de escrita completo ficam de fora — hoje
   * `pulsar`, que precisa do estado auxiliar com o `OFF`.
   */
  readonly ocultarAcoes?: readonly string[]
}

export function Paleta({
  nivel,
  program,
  profile,
  index,
  counters,
  onCriarDispositivo,
  onApelidarContador,
  onSelecionarProcesso,
  onOpenGlossary,
  ocultarAcoes = [],
}: PaletaProps) {
  const [aberta, setAberta] = useState(true)

  // Recolhida vira uma faixa fina: o canvas fica limpo e a paleta continua a um
  // clique. Estado local porque nada fora daqui depende dele.
  if (!aberta) {
    return (
      <aside className="paleta paleta--fechada">
        <button
          type="button"
          className="paleta-alternar"
          title="Mostrar blocos"
          aria-label="Mostrar blocos"
          aria-expanded={false}
          onClick={() => setAberta(true)}
        >
          ▸
        </button>
      </aside>
    )
  }

  return (
    <aside className="paleta" aria-label="Blocos para arrastar">
      <div className="paleta-topo">
        <p className="paleta-dica">
          Arraste para o canvas — solte sobre uma seta para entrar no meio do fluxo.
        </p>
        <button
          type="button"
          className="paleta-alternar"
          title="Esconder blocos"
          aria-label="Esconder blocos"
          aria-expanded
          onClick={() => setAberta(false)}
        >
          ◂
        </button>
      </div>

      {nivel === 1 ? (
        <Grupo titulo="Estados">
          {PAPEIS.map(({ papel, label }) => (
            <Item
              key={papel ?? 'neutro'}
              bloco={{ kind: 'estado', papel }}
              icon={papel ? (PAPEL_ICON[papel] ?? '⬤') : '⬤'}
              label={label}
            />
          ))}
        </Grupo>
      ) : (
        <>
          <Grupo titulo="Quando…">
            {EVENT_SPECS.map((spec) => (
              <Item
                key={spec.id}
                bloco={{ kind: 'trigger', spec: spec.id }}
                icon={spec.icon}
                label={spec.label}
                ajuda={spec.resumo}
              />
            ))}
          </Grupo>

          {CATEGORIAS.map((categoria) => {
            const acoes = actionsByCategory(categoria).filter((a) => !ocultarAcoes.includes(a.id))
            if (acoes.length === 0) return null
            return (
              <Grupo key={categoria} titulo={CATEGORY_LABELS[categoria]}>
                {acoes.map((spec) => (
                  <Item
                    key={spec.id}
                    bloco={{ kind: 'action', spec: spec.id }}
                    icon={spec.icon}
                    label={spec.label}
                    ajuda={spec.resumo}
                  />
                ))}
              </Grupo>
            )
          })}

          <Grupo titulo="Caminho">
            <Item
              bloco={{ kind: 'decision' }}
              icon="◆"
              label="Se…"
              ajuda="Compara dois valores e separa o caminho em sim e não."
            />
            <Item
              bloco={{ kind: 'target' }}
              icon="▶"
              label="Ir para / ficar aqui"
              ajuda="Encerra o caminho mandando o programa a um estado — ou deixando-o onde está."
            />
          </Grupo>
        </>
      )}

      <div className="paleta-rodape">
        <SuaCaixa
          profile={profile}
          index={index}
          counters={counters}
          onCriarDispositivo={onCriarDispositivo}
          onApelidarContador={onApelidarContador}
        />
        <ProcessSignals
          program={program}
          onSelect={onSelecionarProcesso}
          onOpenGlossary={onOpenGlossary}
        />
      </div>
    </aside>
  )
}

/**
 * O que a caixa tem: dispositivos (`^Nome = porta`) e contadores com apelido
 * (`VAR_ALIAS`). Num arquivo novo essas listas estão vazias, e sem elas os
 * campos de dispositivo do nível 2 são listas suspensas sem nenhuma opção —
 * por isso as seções abrem sozinhas justamente quando não há nada declarado.
 */
function SuaCaixa({
  profile,
  index,
  counters,
  onCriarDispositivo,
  onApelidarContador,
}: Pick<
  PaletaProps,
  'profile' | 'index' | 'counters' | 'onCriarDispositivo' | 'onApelidarContador'
>) {
  const [tipoId, setTipoId] = useState(DEVICE_TYPES[0]!.id)
  const [nome, setNome] = useState(DEVICE_TYPES[0]!.constante)
  const [porta, setPorta] = useState('1')
  const [letra, setLetra] = useState('')
  const [apelido, setApelido] = useState('')

  const trocarTipo = (id: string) => {
    setTipoId(id)
    // O nome sugerido acompanha o tipo — mas o usuário pode reescrever.
    setNome(DEVICE_TYPES.find((t) => t.id === id)?.constante ?? '')
  }

  const livres = LETRAS.filter((l) => !index.aliasOf.has(l))

  return (
    <section className="paleta-grupo paleta-caixa">
      <h3 className="paleta-grupo-titulo">Sua caixa</h3>

      <details open={profile.devices.length === 0}>
        <summary>Dispositivos ({profile.devices.length})</summary>
        <ul className="paleta-lista">
          {profile.devices.map((d) => (
            <li key={d.constante}>
              {d.icon} {d.label} · porta {d.porta}
            </li>
          ))}
        </ul>
        <select
          className="paleta-campo"
          value={tipoId}
          onChange={(e) => trocarTipo(e.target.value)}
          aria-label="Tipo de dispositivo"
        >
          {(['entrada', 'saida'] as const).map((kind) => (
            <optgroup key={kind} label={kind === 'entrada' ? 'Entradas' : 'Saídas'}>
              {DEVICE_TYPES.filter((t) => t.kind === kind).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          className="paleta-campo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="nome no arquivo"
          aria-label="Nome da constante"
        />
        <input
          className="paleta-campo"
          type="number"
          min={1}
          value={porta}
          onChange={(e) => setPorta(e.target.value)}
          aria-label="Porta"
        />
        <button
          type="button"
          className="paleta-botao"
          disabled={nome.trim() === '' || Number(porta) < 1}
          onClick={() => onCriarDispositivo(nome.trim(), Number(porta))}
        >
          adicionar dispositivo
        </button>
      </details>

      <details open={counters.length === 0}>
        <summary>Contadores ({counters.length})</summary>
        <ul className="paleta-lista">
          {counters.map((c) => (
            <li key={c.operando} title={c.escrito ? 'o programa escreve neste' : 'só leitura'}>
              <span className="paleta-contador-nome">{counterLabel(c)}</span>
              {c.nome !== null && <span className="paleta-contador-op">{c.operando}</span>}
            </li>
          ))}
        </ul>
        <input
          className="paleta-campo"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          placeholder="nome do contador"
          aria-label="Nome do contador"
        />
        <select
          className="paleta-campo"
          value={letra}
          onChange={(e) => setLetra(e.target.value)}
          aria-label="Variável"
        >
          <option value="" disabled>
            letra…
          </option>
          {livres.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="paleta-botao"
          disabled={apelido.trim() === '' || letra === ''}
          onClick={() => {
            onApelidarContador(letra, apelido.trim())
            setApelido('')
            setLetra('')
          }}
        >
          adicionar contador
        </button>
      </details>
    </section>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="paleta-grupo">
      <h3 className="paleta-grupo-titulo">{titulo}</h3>
      {children}
    </section>
  )
}

function Item({
  bloco,
  icon,
  label,
  ajuda,
}: {
  bloco: BlocoArrastado
  icon: string
  label: string
  ajuda?: string
}) {
  return (
    <div
      className="paleta-item"
      draggable
      title={ajuda}
      onDragStart={(e) => iniciarArrasto(e, bloco)}
    >
      <span className="paleta-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="paleta-item-label">{label}</span>
    </div>
  )
}
