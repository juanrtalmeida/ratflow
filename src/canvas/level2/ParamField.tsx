import type { ParamSpec } from '../../vocab/catalog.ts'
import { COMPARADORES } from '../../vocab/catalog.ts'
import { devicesOfKind } from '../../vocab/profile.ts'
import type { EditableContext } from './editable-context.ts'
import './ParamField.css'

interface Option {
  readonly value: string
  readonly label: string
}

/**
 * `nodrag` é o que faz o React Flow soltar o `mousedown`: sem ela, arrastar
 * para selecionar o texto de um campo move o nó inteiro. O filtro olha o
 * elemento do evento e seus ancestrais, então a classe tem que estar no
 * próprio controle.
 */
const INPUT_CLASS = 'param-field-input nodrag'

/** Opções da lista suspensa, sempre incluindo o valor atual mesmo quando ele não é uma opção conhecida. */
function optionsWithCurrent(options: readonly Option[], value: string): Option[] {
  if (value === '' || options.some((o) => o.value === value)) return [...options]
  return [...options, { value, label: value }]
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
}) {
  return (
    <select
      className={INPUT_CLASS}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        escolher…
      </option>
      {optionsWithCurrent(options, value).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const SINAIS: Option[] = Array.from({ length: 32 }, (_, i) => ({
  value: String(i + 1),
  label: `Sinal ${i + 1}`,
}))

const COMPARADOR_OPTIONS: Option[] = COMPARADORES.map((c) => ({ value: c.id, label: c.label }))

/** Constantes declaradas que a inferência de perfil ainda não classificou. */
function constantesNaoClassificadas(context: EditableContext): Option[] {
  return [...context.index.constants.entries()]
    .filter(([nome]) => !context.profile.devices.some((d) => d.constante === nome))
    .map(([nome, def]) => ({ value: `^${nome}`, label: `⚙ ${nome} (porta ${def.value})` }))
}

export interface ParamFieldProps {
  readonly spec: Pick<ParamSpec, 'id' | 'label' | 'type'>
  readonly value: string
  readonly onChange: (value: string) => void
  readonly context: EditableContext
}

/**
 * Um campo do formulário de um nó, escolhido pelo `type` do `ParamSpec`.
 * Nunca texto livre para o que tem uma lista fechada de opções — dispositivo,
 * contador, comparador e sinal vêm sempre de uma lista suspensa. Só número e
 * texto (rótulo de `SHOW`, valor de `SET`) são campos livres.
 */
export function ParamField({ spec, value, onChange, context }: ParamFieldProps) {
  switch (spec.type) {
    case 'entrada':
    case 'saida': {
      const devices = devicesOfKind(context.profile, spec.type === 'entrada' ? 'entrada' : 'saida')
      const options = [
        ...devices.map((d) => ({
          value: `^${d.constante}`,
          label: `${d.icon} ${d.label}`,
        })),
        // O perfil é inferido do **uso** (`#R^X` é entrada, `ON ^X` é saída),
        // então uma constante recém-declarada não está nele ainda: sem isto, o
        // dispositivo que o usuário acabou de cadastrar na paleta não apareceria
        // aqui, e ele nunca conseguiria escrever o primeiro `ON` que faria a
        // inferência classificá-lo.
        ...constantesNaoClassificadas(context),
      ]
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <Select value={value} options={options} onChange={onChange} />
        </label>
      )
    }
    case 'contador': {
      // Todos os contadores que o arquivo revela, com o nome que o autor deu —
      // `VAR_ALIAS` para a variável inteira, comentário `\ B(5) = …` para uma
      // posição de array. Sem isto, um programa que usa arrays (o caso da
      // maioria dos reais) mostrava uma lista vazia.
      const options = context.counters.map((c) => ({
        value: c.operando,
        label: c.nome === null ? c.operando : `${c.nome} · ${c.operando}`,
      }))
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <Select value={value} options={options} onChange={onChange} />
        </label>
      )
    }
    case 'sinal':
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <Select value={value} options={SINAIS} onChange={onChange} />
        </label>
      )
    case 'comparador':
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <Select value={value} options={COMPARADOR_OPTIONS} onChange={onChange} />
        </label>
      )
    case 'numero':
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <input
            className={INPUT_CLASS}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )
    case 'texto':
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <input
            className={INPUT_CLASS}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )
    case 'duracao':
      // Composto (número + unidade) — ver `DurationField`, usado direto pelos
      // nós que têm um parâmetro desse tipo.
      return null
  }
}

export function DurationField({
  amountLabel,
  amount,
  unit,
  onChangeAmount,
  onChangeUnit,
}: {
  amountLabel: string
  amount: string
  unit: string
  onChangeAmount: (value: string) => void
  onChangeUnit: (value: string) => void
}) {
  return (
    <div className="param-field param-field--duracao">
      <span className="param-field-label">{amountLabel}</span>
      <div className="param-field-duracao-row">
        {/* `type="text"`, não "number": o valor pode ser uma referência a
            constante (`^Timeout`), comum nas fixtures reais — um input
            numérico nativo simplesmente fica em branco quando o valor não é
            um número, escondendo o que já estava lá. */}
        <input
          className={INPUT_CLASS}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChangeAmount(e.target.value)}
        />
        <select
          className={INPUT_CLASS}
          value={unit || 's'}
          onChange={(e) => onChangeUnit(e.target.value)}
        >
          <option value="s">segundos</option>
          <option value="min">minutos</option>
        </select>
      </div>
    </div>
  )
}
