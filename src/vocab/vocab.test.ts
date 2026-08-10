import { describe, expect, it } from 'vitest'
import { parseProgram } from '../core/parser.ts'
import { loadFixtures } from '../core/__fixtures.ts'
import { createNarrator } from './narrate.ts'
import { guessDeviceType, DEVICE_TYPES } from './devices.ts'
import {
  PRESETS,
  deviceByConstant,
  profileFromSuggestions,
  suggestDevices,
  type HardwareProfile,
} from './profile.ts'
import { ACTION_SPECS, EVENT_SPECS, actionSpec, eventSpec } from './catalog.ts'

const fixtures = loadFixtures()
const fr5 = fixtures.find((f) => f.name === 'fr5-sintetico.MPC')!

/** Perfil correspondente ao FR5 sintético. */
const PERFIL_FR5: HardwareProfile = {
  id: 'teste',
  label: 'Teste',
  descricao: '',
  devices: [
    {
      constante: 'Alavanca',
      typeId: 'alavanca-esq',
      label: 'Alavanca esquerda',
      icon: '🖐',
      kind: 'entrada',
      porta: 1,
    },
    {
      constante: 'Pelota',
      typeId: 'pelota',
      label: 'Dispensador de pelota',
      icon: '🍬',
      kind: 'saida',
      porta: 1,
    },
    {
      constante: 'LuzCasa',
      typeId: 'luz-casa',
      label: 'Luz da casa',
      icon: '💡',
      kind: 'saida',
      porta: 4,
    },
  ],
}

describe('catálogo de dispositivos', () => {
  it('não tem ids nem constantes repetidos', () => {
    const ids = DEVICE_TYPES.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    const constantes = DEVICE_TYPES.map((d) => d.constante)
    expect(new Set(constantes).size).toBe(constantes.length)
  })

  it('dá verbo a toda entrada, para o narrador ter o que dizer', () => {
    for (const device of DEVICE_TYPES.filter((d) => d.kind === 'entrada')) {
      expect(device.verbo, device.id).toBeTruthy()
    }
  })

  it('adivinha o dispositivo pelo nome da constante', () => {
    expect(guessDeviceType('LeftLever')?.id).toBe('alavanca-esq')
    expect(guessDeviceType('HouseLight')?.id).toBe('luz-casa')
    expect(guessDeviceType('PelletDispenser')?.id).toBe('pelota')
    expect(guessDeviceType('Razao')).toBeUndefined()
  })

  it('prefere a pista mais específica', () => {
    // `leftlever` deve ganhar de qualquer pista curta contida no mesmo nome.
    expect(guessDeviceType('LeftLever')?.id).not.toBe('alavanca-dir')
  })

  it('respeita o papel quando ele já é conhecido', () => {
    expect(guessDeviceType('Tom', 'entrada')).toBeUndefined()
    expect(guessDeviceType('Tom', 'saida')?.id).toBe('tom')
  })
})

describe('presets de hardware', () => {
  it.each(PRESETS)('$label tem entradas e saídas', (preset) => {
    expect(preset.devices.some((d) => d.kind === 'entrada')).toBe(true)
    expect(preset.devices.some((d) => d.kind === 'saida')).toBe(true)
  })

  it('não repete constante dentro do mesmo preset', () => {
    for (const preset of PRESETS) {
      const nomes = preset.devices.map((d) => d.constante)
      expect(new Set(nomes).size, preset.id).toBe(nomes.length)
    }
  })

  it('encontra dispositivo pela constante', () => {
    const preset = PRESETS[0]!
    expect(deviceByConstant(preset, 'LuzCasa')?.porta).toBe(4)
    expect(deviceByConstant(preset, 'Inexistente')).toBeUndefined()
  })
})

describe('inferência do perfil a partir do arquivo', () => {
  const sugestoes = suggestDevices(parseProgram(fr5.text))

  it('deduz o papel pelo uso, não pelo nome', () => {
    const alavanca = sugestoes.find((s) => s.constante === 'Alavanca')!
    const pelota = sugestoes.find((s) => s.constante === 'Pelota')!
    expect(alavanca.kind).toBe('entrada')
    expect(pelota.kind).toBe('saida')
  })

  it('ignora constantes que são parâmetros, não portas', () => {
    // ^Razao e ^DuracaoSessao nunca aparecem como porta.
    expect(sugestoes.map((s) => s.constante)).not.toContain('Razao')
    expect(sugestoes.map((s) => s.constante)).not.toContain('DuracaoSessao')
  })

  it('sugere o tipo de dispositivo pelo nome', () => {
    expect(
      sugestoes.find((s) => s.constante === 'LuzCasa')?.palpite?.id,
    ).toBe('luz-casa')
  })

  it('monta um perfil utilizável com o que conseguiu resolver', () => {
    const perfil = profileFromSuggestions(sugestoes)
    expect(perfil.devices.map((d) => d.constante).sort()).toEqual([
      'Alavanca',
      'LuzCasa',
      'Pelota',
    ])
    expect(deviceByConstant(perfil, 'Alavanca')?.kind).toBe('entrada')
  })

  it('não inventa perfil para arquivo legado sem pistas no nome', () => {
    const legado = fixtures.find((f) => f.name === 'vi30-legado.MPC')!
    const perfil = profileFromSuggestions(suggestDevices(parseProgram(legado.text)))

    // ^H e ^P aparecem em ON/OFF; ^L é declarado mas o programa responde a
    // `#R1` direto, então nada prova que ele seja uma porta.
    expect(perfil.devices.map((d) => d.constante).sort()).toEqual(['H', 'P'])
    // Sem pista no nome, o dispositivo fica genérico em vez de errado.
    expect(deviceByConstant(perfil, 'P')?.typeId).toBe('desconhecido')
    expect(deviceByConstant(perfil, 'P')?.kind).toBe('saida')
  })
})

describe('narrador', () => {
  const program = parseProgram(fr5.text)
  const narrador = createNarrator(program, PERFIL_FR5)
  const tarefa = program.stateSets[0]!
  const esperando = tarefa.states[1]!

  it('descreve a regra de razão fixa como uma frase de laboratório', () => {
    const frase = narrador.statement(esperando.statements[0]!, tarefa)
    expect(frase).toBe(
      'Quando o sujeito responder em 🖐 Alavanca esquerda, somar 1 a «Respostas» e ' +
        'registrar «Respostas» como "Respostas". Então, se «Respostas» for pelo menos ' +
        '«Razao» (5), ligar 🍬 Dispensador de pelota, somar 1 a «Reforcos», definir ' +
        '«Respostas» como 0 e ir para «Reforço»; senão, ficar aqui.',
    )
  })

  it('usa o apelido do VAR_ALIAS em vez da letra', () => {
    expect(narrador.command(esperando.statements[0]!.segments[0]!.commands[0]!)).toBe(
      'somar 1 a «Respostas»',
    )
  })

  it('traduz gatilhos de tempo com a unidade certa', () => {
    expect(narrador.trigger(esperando.statements[1]!.trigger)).toBe(
      'passarem 30 segundos',
    )
    const sessao = program.stateSets[1]!
    expect(narrador.trigger(sessao.states[1]!.statements[0]!.trigger)).toBe(
      'passarem «DuracaoSessao» (60) minutos',
    )
  })

  it('usa singular para um segundo e vírgula decimal', () => {
    const reforco = tarefa.states[2]!.statements[0]!
    expect(narrador.trigger(reforco.trigger)).toBe('passarem 0,05 segundo')
  })

  it('nomeia o estado de destino em vez do número', () => {
    const segmento = esperando.statements[0]!.segments[1]!
    expect(narrador.target(segmento.target, tarefa)).toBe('ir para «Reforço»')
    expect(narrador.target(esperando.statements[0]!.segments[2]!.target, tarefa)).toBe(
      'ficar aqui',
    )
  })

  it('produz rótulo curto para as arestas do canvas', () => {
    expect(narrador.triggerShort(esperando.statements[0]!.trigger)).toBe(
      '🖐 Alavanca esquerda',
    )
    expect(narrador.triggerShort(esperando.statements[1]!.trigger)).toBe(
      '⏱ 30 segundos',
    )
    expect(narrador.triggerShort(tarefa.states[0]!.statements[0]!.trigger)).toBe(
      '▶ início da sessão',
    )
  })

  it('resume o estado pelo que ele liga', () => {
    expect(narrador.state(tarefa.states[0]!)).toBe('1 regra · liga 💡 Luz da casa')
    expect(narrador.state(esperando)).toBe('2 regras · liga 🍬 Dispensador de pelota')
  })

  it('mostra código cru, entre crases, para o que ainda não sabe traduzir', () => {
    const legado = parseProgram(fixtures.find((f) => f.name === 'vi30-legado.MPC')!.text)
    const semPerfil = createNarrator(legado)
    const randd = legado.stateSets[0]!.states[0]!.statements[0]!.segments[0]!
      .commands[2]!
    expect(semPerfil.command(randd)).toBe('`RANDD K = J`')
  })

  it('cai para o nome da constante quando não há perfil de hardware', () => {
    const semPerfil = createNarrator(program)
    expect(semPerfil.trigger(esperando.statements[0]!.trigger)).toBe(
      'houver resposta em «Alavanca»',
    )
  })

  it.each(fixtures)('$name: narra toda regra sem estourar', ({ text }) => {
    const p = parseProgram(text)
    const n = createNarrator(p)
    for (const stateSet of p.stateSets) {
      for (const state of stateSet.states) {
        for (const statement of state.statements) {
          const frase = n.statement(statement, stateSet)
          expect(frase.length).toBeGreaterThan(0)
          expect(frase.endsWith('.')).toBe(true)
        }
      }
    }
  })
})

describe('catálogo da paleta', () => {
  it('não tem ids repetidos', () => {
    const ids = [...EVENT_SPECS, ...ACTION_SPECS].map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('descreve cada entrada em uma linha', () => {
    for (const spec of [...EVENT_SPECS, ...ACTION_SPECS]) {
      expect(spec.resumo.length, spec.id).toBeGreaterThan(10)
    }
  })

  it('marca como macro apenas o que precisa de estado auxiliar', () => {
    expect(actionSpec('pulsar')?.macro).toBe(true)
    expect(actionSpec('ligar')?.macro).toBeUndefined()
  })

  it('encontra especificações por id', () => {
    expect(eventSpec('resposta')?.params[0]!.type).toBe('entrada')
    expect(actionSpec('definir')?.params).toHaveLength(2)
    expect(actionSpec('inexistente')).toBeUndefined()
  })
})
