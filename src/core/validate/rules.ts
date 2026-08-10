import { stateLabel, stateSetLabel, type Operand } from '../ast.ts'
import {
  eachCommand,
  eachStatement,
  operandsOf,
  operandsOfTrigger,
  portOperandsOf,
  variableNameOf,
} from '../walk.ts'
import type { Diagnostic, Rule } from './types.ts'

/**
 * Cada regra devolve diagnósticos em duas camadas: `plain` para quem só quer
 * saber o que está errado, `why`/`fix` para quem quer entender e consertar.
 * A linguagem é deliberadamente a do laboratório, não a do compilador.
 */

// ------------------------------------------------------------- estruturais

/** Transição que aponta para um estado que não existe naquele processo. */
export const alvoInexistente: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  for (const { stateSet, state, statement } of eachStatement(program)) {
    const existentes = new Set(stateSet.states.map((s) => s.index))
    for (const segment of statement.segments) {
      const target = segment.target
      if (!target || typeof target.state !== 'number') continue
      if (existentes.has(target.state)) continue
      out.push({
        span: target.span,
        severity: 'error',
        code: 'alvo-inexistente',
        plain: `Esta seta aponta para o estado S${target.state}, que não existe em «${stateSetLabel(stateSet)}».`,
        why:
          'Quando o programa tentar seguir por aqui, o MED-PC não vai saber para onde ir e ' +
          'a sessão trava.',
        fix: `Escolha um dos estados existentes ou crie S${target.state}. Estado de origem: ${stateLabel(state)}.`,
      })
    }
  }
  return out
}

/** Estado que nenhuma transição alcança — código morto no protocolo. */
export const estadoInalcancavel: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  for (const stateSet of program.stateSets) {
    const entrada = stateSet.states[0]?.index
    const alcancados = new Set<number>()
    for (const state of stateSet.states) {
      for (const statement of state.statements) {
        for (const segment of statement.segments) {
          const alvo = segment.target?.state
          if (typeof alvo === 'number') alcancados.add(alvo)
        }
      }
    }
    for (const state of stateSet.states) {
      if (state.index === entrada || alcancados.has(state.index)) continue
      out.push({
        span: state.headerSpan,
        severity: 'warning',
        code: 'estado-inalcancavel',
        plain: `Nada leva ao estado «${stateLabel(state)}» — ele nunca vai acontecer.`,
        why:
          'Nenhuma outra parte do processo tem uma seta apontando para cá, então tudo o que ' +
          'está escrito aqui é ignorado durante a sessão.',
        fix: 'Aponte alguma transição para este estado, ou apague-o se ele não é mais usado.',
      })
    }
  }
  return out
}

/** Processo sem `#START`: nunca começa a rodar. */
export const processoSemStart: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  for (const stateSet of program.stateSets) {
    const temStart = stateSet.states.some((state) =>
      state.statements.some((s) => s.trigger.parsed?.kind === 'start'),
    )
    if (temStart || stateSet.states.length === 0) continue
    out.push({
      span: stateSet.headerSpan,
      severity: 'error',
      code: 'processo-sem-start',
      plain: `O processo «${stateSetLabel(stateSet)}» nunca começa.`,
      why:
        'Todo processo precisa de uma regra disparada por #START — é ela que tira o processo ' +
        'do lugar quando a sessão inicia.',
      fix: 'Adicione um gatilho "a sessão começar" no primeiro estado do processo.',
    })
  }
  return out
}

/** Estado do qual não se sai: a sessão para ali. */
export const estadoSemSaida: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  for (const stateSet of program.stateSets) {
    for (const state of stateSet.states) {
      const temSaida = state.statements.some((statement) =>
        statement.segments.some(
          (segment) =>
            typeof segment.target?.state === 'number' &&
            segment.target.state !== state.index,
        ),
      )
      if (temSaida) continue
      out.push({
        span: state.headerSpan,
        severity: 'warning',
        code: 'estado-sem-saida',
        plain: `O estado «${stateLabel(state)}» não leva a lugar nenhum.`,
        why:
          'O programa entra aqui e fica. Se isso não for de propósito (como um estado final), ' +
          'a sessão nunca avança.',
        fix: 'Adicione um gatilho — uma resposta ou um tempo — com uma seta para outro estado.',
      })
    }
  }
  return out
}

/** Rótulos de `IF` que não existem, e segmentos rotulados que ninguém usa. */
export const rotuloOrfao: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  for (const { statement } of eachStatement(program)) {
    const definidos = new Map(
      statement.segments
        .filter((s) => s.label !== null)
        .map((s) => [s.label!, s] as const),
    )
    const referenciados = new Set<string>()

    for (const segment of statement.segments) {
      for (const command of segment.commands) {
        if (command.parsed?.kind !== 'if') continue
        const { thenLabel, elseLabel } = command.parsed
        for (const label of [thenLabel, elseLabel]) {
          if (label === null) continue
          referenciados.add(label)
          if (definidos.has(label)) continue
          out.push({
            span: command.span,
            severity: 'error',
            code: 'rotulo-inexistente',
            plain: `Este "se" manda o programa para «${label}», mas esse caminho não foi escrito.`,
            why: 'O ramo existe na decisão mas não tem continuação, então o programa fica sem saída.',
            fix: `Escreva o que acontece em «${label}» ou aponte a decisão para outro caminho.`,
          })
        }
      }
    }

    for (const [label, segment] of definidos) {
      if (referenciados.has(label)) continue
      out.push({
        span: segment.labelSpan ?? segment.span,
        severity: 'warning',
        code: 'rotulo-sem-uso',
        plain: `O caminho «${label}» está escrito mas nenhuma decisão leva até ele.`,
        why: 'Ele nunca vai rodar — é código morto dentro desta regra.',
        fix: 'Aponte uma decisão para este caminho, ou remova-o.',
      })
    }
  }
  return out
}

// -------------------------------------------------------------------- dados

/** Uso de array sem `DIM`, e índice constante além do tamanho declarado. */
export const arrayMalDimensionado: Rule = ({ program, index }) => {
  const out: Diagnostic[] = []
  const visitar = (operand: Operand, span = operand.span) => {
    if (operand.type !== 'element') return
    if (!index.dims.has(operand.name)) {
      out.push({
        span,
        severity: 'error',
        code: 'array-sem-dim',
        plain: `A variável ${operand.name} está sendo usada como lista, mas nunca foi dimensionada.`,
        why:
          'Sem um DIM, o MED-PC trata a variável como um número único e a gravação de vários ' +
          'valores falha.',
        fix: `Declare o tamanho antes do programa: DIM ${operand.name} = 1000.`,
      })
      return
    }
    const tamanho = index.dims.get(operand.name) ?? null
    const indice = Number(operand.index)
    if (tamanho !== null && Number.isInteger(indice) && indice > tamanho) {
      out.push({
        span,
        severity: 'error',
        code: 'indice-fora-do-dim',
        plain: `${operand.name}(${operand.index}) passa do tamanho declarado (${tamanho}).`,
        why: 'Gravar além do fim da lista descarta o dado — ou derruba a sessão.',
        fix: `Aumente o DIM de ${operand.name} ou use um índice menor.`,
      })
    }
  }

  for (const { command } of eachCommand(program)) {
    for (const operand of operandsOf(command)) visitar(operand)
  }
  for (const { statement } of eachStatement(program)) {
    for (const operand of operandsOfTrigger(statement.trigger)) visitar(operand)
  }
  return out
}

/** Constante `^X` usada sem ter sido definida no preâmbulo. */
export const constanteIndefinida: Rule = ({ program, index }) => {
  const out: Diagnostic[] = []
  const visitar = (operand: Operand) => {
    if (operand.type !== 'constant') return
    if (index.constants.has(operand.name)) return
    out.push({
      span: operand.span,
      severity: 'error',
      code: 'constante-indefinida',
      plain: `«^${operand.name}» é usado aqui mas nunca foi definido.`,
      why:
        'Constantes dão nome a portas e parâmetros. Sem a definição, o MED-PC não sabe a que ' +
        'número isso corresponde.',
      fix: `Defina no início do arquivo: ^${operand.name} = <número>.`,
    })
  }

  for (const { command } of eachCommand(program)) {
    for (const operand of operandsOf(command)) visitar(operand)
  }
  for (const { statement } of eachStatement(program)) {
    for (const operand of operandsOfTrigger(statement.trigger)) visitar(operand)
  }
  return out
}

/** Variável marcada para gravação em disco que nada no programa escreve. */
export const diskvarNuncaEscrita: Rule = ({ program, index }) => {
  const out: Diagnostic[] = []
  const diretiva = program.preamble.find(
    (item) => item.kind === 'DiskDirective' && item.directive === 'DISKVARS',
  )
  if (diretiva?.kind !== 'DiskDirective') return out

  for (const nome of index.diskVars) {
    const variavel = index.aliases.get(nome) ?? nome
    if (index.written.has(variavel)) continue
    out.push({
      span: diretiva.valuesSpan,
      severity: 'warning',
      code: 'diskvar-nunca-escrita',
      plain: `«${nome}» vai para o arquivo de dados, mas nada no programa grava valor nela.`,
      why:
        'A coluna sai vazia (ou zerada) no arquivo da sessão — e o dado só faz falta depois do ' +
        'experimento rodado.',
      fix: `Grave algo em ${variavel} com ADD ou SET, ou remova-a do DISKVARS.`,
    })
  }
  return out
}

// ----------------------------------------------------------------- hardware

function chaveDaPorta(operand: Operand): string | null {
  if (operand.type === 'constant') return `^${operand.name}`
  if (operand.type === 'number') return operand.name
  return null
}

/** Porta ligada e nunca desligada — dispositivo fica ativo até o fim da sessão. */
export const portaNuncaDesligada: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  const ligadas = new Map<string, Operand>()
  const desligadas = new Set<string>()

  for (const { command } of eachCommand(program)) {
    const detail = command.parsed
    if (detail?.kind !== 'port') continue
    for (const operand of portOperandsOf(command)) {
      const chave = chaveDaPorta(operand)
      if (!chave) continue
      if (detail.op === 'ON' || detail.op === 'LOCKON') {
        if (!ligadas.has(chave)) ligadas.set(chave, operand)
      } else {
        desligadas.add(chave)
      }
    }
  }

  for (const [chave, operand] of ligadas) {
    if (desligadas.has(chave)) continue
    out.push({
      span: operand.span,
      severity: 'warning',
      code: 'porta-nunca-desligada',
      plain: `${chave} é ligado mas nunca desligado em lugar nenhum do programa.`,
      why:
        'O dispositivo fica ativo até a sessão terminar. Para uma luz de casa isso pode ser ' +
        'intencional; para um dispensador ou um som, quase nunca é.',
      fix: `Se não for intencional, adicione uma ação "desligar ${chave}" no fim do ciclo.`,
    })
  }
  return out
}

/** Mesma porta comandada por dois processos: quem ganha depende da ordem. */
export const portaEmDoisProcessos: Rule = ({ program }) => {
  const out: Diagnostic[] = []
  const porPorta = new Map<string, Map<number, Operand>>()

  for (const { stateSet, command } of eachCommand(program)) {
    for (const operand of portOperandsOf(command)) {
      const chave = chaveDaPorta(operand)
      if (!chave) continue
      const processos = porPorta.get(chave) ?? new Map<number, Operand>()
      if (!processos.has(stateSet.index)) processos.set(stateSet.index, operand)
      porPorta.set(chave, processos)
    }
  }

  for (const [chave, processos] of porPorta) {
    if (processos.size < 2) continue
    const numeros = [...processos.keys()].sort((a, b) => a - b)
    const primeiro = processos.get(numeros[0]!)!
    out.push({
      span: primeiro.span,
      severity: 'warning',
      code: 'porta-em-dois-processos',
      plain: `${chave} é comandado pelos processos ${numeros.join(' e ')} ao mesmo tempo.`,
      why:
        'Os processos rodam em paralelo. Se os dois mexerem no mesmo dispositivo, o estado final ' +
        'depende de qual rodou por último — e isso muda de sessão para sessão.',
      fix: 'Deixe um único processo dono do dispositivo e avise os outros com um sinal Z.',
    })
  }
  return out
}

// ------------------------------------------------------------------ dialeto

/** Diretiva de preâmbulo que a versão escolhida do MED-PC não aceita. */
export const diretivaNaoSuportada: Rule = ({ program, dialect }) => {
  const out: Diagnostic[] = []
  for (const item of program.preamble) {
    if (item.kind !== 'DiskDirective') continue
    if (dialect.directives.has(item.directive)) continue
    out.push({
      span: item.span,
      severity: 'error',
      code: 'diretiva-nao-suportada',
      plain: `${item.directive} não existe no ${dialect.label}.`,
      why: 'O programa não vai compilar na versão que este projeto tem como alvo.',
      fix: `Remova a diretiva ou troque o alvo do projeto para uma versão que a aceite.`,
    })
  }
  return out
}

/** Programa com mais processos do que a versão suporta. */
export const excedeProcessos: Rule = ({ program, dialect }) => {
  if (program.stateSets.length <= dialect.maxStateSets) return []
  const excedente = program.stateSets[dialect.maxStateSets]!
  return [
    {
      span: excedente.headerSpan,
      severity: 'error',
      code: 'excede-processos',
      plain: `Este programa tem ${program.stateSets.length} processos; o ${dialect.label} aceita ${dialect.maxStateSets}.`,
      why: 'Processos além do limite simplesmente não rodam.',
      fix: 'Junte processos que fazem trabalho parecido, ou reduza o escopo do protocolo.',
    },
  ]
}

/** Pulso `Z` acima do máximo da versão. */
export const sinalForaDoLimite: Rule = ({ program, dialect }) => {
  const out: Diagnostic[] = []
  const registrar = (numero: number, span: readonly [number, number]) => {
    if (numero >= 1 && numero <= dialect.maxSignals) return
    out.push({
      span,
      severity: 'error',
      code: 'sinal-fora-do-limite',
      plain: `O sinal Z${numero} não existe: o ${dialect.label} vai de Z1 a Z${dialect.maxSignals}.`,
      why: 'Sinais são o canal de conversa entre processos; um número inválido não chega a ninguém.',
      fix: `Use um número entre 1 e ${dialect.maxSignals}.`,
    })
  }

  for (const { command } of eachCommand(program)) {
    if (command.parsed?.kind === 'signal') {
      registrar(command.parsed.number, command.span)
    }
  }
  for (const { statement } of eachStatement(program)) {
    if (statement.trigger.parsed?.kind === 'signal') {
      registrar(statement.trigger.parsed.number, statement.trigger.span)
    }
  }
  return out
}

/** Nome de constante ou alias maior do que a versão aceita. */
export const identificadorLongo: Rule = ({ program, dialect }) => {
  const out: Diagnostic[] = []
  for (const item of program.preamble) {
    if (item.kind === 'ConstantDef' && item.name.length > dialect.maxIdentifierLength) {
      out.push({
        span: item.nameSpan,
        severity: 'warning',
        code: 'identificador-longo',
        plain: `«${item.name}» tem ${item.name.length} caracteres; o ${dialect.label} aceita até ${dialect.maxIdentifierLength}.`,
        why: 'Nomes longos podem ser truncados na compilação, criando dois nomes iguais sem querer.',
        fix: 'Encurte o nome.',
      })
    }
    if (item.kind === 'VarAliasBlock') {
      for (const alias of item.aliases) {
        if (alias.alias.length <= dialect.maxIdentifierLength) continue
        out.push({
          span: alias.span,
          severity: 'warning',
          code: 'identificador-longo',
          plain: `O apelido «${alias.alias}» tem ${alias.alias.length} caracteres; o limite é ${dialect.maxIdentifierLength}.`,
          why: 'Apelidos longos podem ser truncados na compilação.',
          fix: 'Encurte o apelido.',
        })
      }
    }
  }
  return out
}

/** Variável usada como contador sem nunca ser zerada no início da sessão. */
export const contadorNuncaZerado: Rule = ({ program, index }) => {
  const out: Diagnostic[] = []
  const zerados = new Set<string>()
  const incrementados = new Map<string, Operand>()

  for (const { command } of eachCommand(program)) {
    const detail = command.parsed
    if (detail?.kind === 'set') {
      for (const atribuicao of detail.assignments) {
        const nome = variableNameOf(atribuicao.target)
        if (nome) zerados.add(nome)
      }
    }
    if (detail?.kind === 'counter') {
      const nome = variableNameOf(detail.target)
      if (nome && !incrementados.has(nome)) incrementados.set(nome, detail.target)
    }
  }

  for (const [nome, operand] of incrementados) {
    if (zerados.has(nome)) continue
    const apelido = index.aliasOf.get(nome)
    const rotulo = apelido ? `«${apelido}»` : nome
    out.push({
      span: operand.span,
      severity: 'info',
      code: 'contador-nunca-zerado',
      plain: `O contador ${rotulo} nunca recebe um valor inicial.`,
      why:
        'O MED-PC começa a sessão com as variáveis em zero, então na prática funciona — mas se ' +
        'o protocolo for reiniciado dentro da mesma sessão, a contagem vem contaminada.',
      fix: `Zere ${nome} na regra de #START, junto com os outros contadores.`,
    })
  }
  return out
}

export const ALL_RULES: readonly Rule[] = [
  alvoInexistente,
  estadoInalcancavel,
  processoSemStart,
  estadoSemSaida,
  rotuloOrfao,
  arrayMalDimensionado,
  constanteIndefinida,
  diskvarNuncaEscrita,
  portaNuncaDesligada,
  portaEmDoisProcessos,
  diretivaNaoSuportada,
  excedeProcessos,
  sinalForaDoLimite,
  identificadorLongo,
  contadorNuncaZerado,
]
