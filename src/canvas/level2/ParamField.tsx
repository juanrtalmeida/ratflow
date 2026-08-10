import type { ParamSpec } from '../../vocab/catalog.ts'
import { COMPARADORES } from '../../vocab/catalog.ts'
import { devicesOfKind } from '../../vocab/profile.ts'
import type { EditableContext } from './editable-context.ts'
import './ParamField.css'

interface Option {
  readonly value: string
  readonly label: string
}

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
      className="param-field-input"
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
      const options = devices.map((d) => ({
        value: `^${d.constante}`,
        label: `${d.icon} ${d.label}`,
      }))
      return (
        <label className="param-field">
          <span className="param-field-label">{spec.label}</span>
          <Select value={value} options={options} onChange={onChange} />
        </label>
      )
    }
    case 'contador': {
      const options = [...context.index.aliasOf.entries()].map(([variable, alias]) => ({
        value: variable,
        label: `«${alias}»`,
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
            className="param-field-input"
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
            className="param-field-input"
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
          className="param-field-input"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChangeAmount(e.target.value)}
        />
        <select
          className="param-field-input"
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
