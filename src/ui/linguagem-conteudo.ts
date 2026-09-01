/**
 * Conteúdo da página "A linguagem MED-PC" (rota `#/linguagem`). Dados, não
 * JSX — mesma convenção de `manual-conteudo.ts`, cujos tipos este arquivo
 * reaproveita: `entre backticks` vira código e `**negrito**` vira negrito, e
 * nada mais.
 *
 * Divisão de trabalho entre as duas páginas de documentação:
 *
 * - `manual-conteudo.ts` explica **o RatFlow** — onde clicar, o que cada
 *   painel faz, quais os limites do editor;
 * - este arquivo explica **a linguagem** — o que o MED-PC executa, com que
 *   sintaxe, e como os programas de laboratório de verdade são escritos.
 *
 * A fonte do que está aqui é o que o parser em `src/core/` reconhece (ver
 * `src/core/GRAMMAR.md`), a ajuda de comando em `src/editor/command-help.ts`,
 * a biblioteca de modelos em `src/core/templates/` e os arquivos reais em
 * `fixtures/` — todo trecho de código desta página é código que abre no
 * RatFlow.
 */

import type { ManualSecao } from './manual-conteudo.ts'

export const LINGUAGEM: readonly ManualSecao[] = [
  {
    id: 'o-que-e',
    icone: '🧪',
    titulo: 'O que é o MED-PC e o MedState',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O **MED-PC** (Med Associates) é o programa que controla caixas operantes: ele lê as ' +
          'entradas da caixa (alavancas, bicadas, sensores de entrada no comedouro) e aciona as ' +
          'saídas (luz da casa, luz da alavanca, dispensador, som, bomba de infusão), com precisão ' +
          'de centésimo de segundo, e grava o que aconteceu num arquivo de dados.',
      },
      {
        kind: 'texto',
        texto:
          'O que você escreve não é o MED-PC: é um **programa** para ele, na linguagem **MedState ' +
          'Notation** (MSN). O arquivo-fonte tem extensão `.MPC` e é texto puro — abre no Bloco de ' +
          'Notas. Antes de rodar, o MED-PC traduz esse texto para a forma que a máquina executa; ' +
          'um erro de sintaxe aparece nessa tradução, não no meio do experimento.',
      },
      {
        kind: 'texto',
        texto:
          'A ideia central da linguagem é uma só: **um experimento é uma máquina de estados**. Em ' +
          'cada momento o programa está *num* estado ("esperando resposta", "entregando pelota", ' +
          '"intervalo entre tentativas"), e o que pode acontecer ali está escrito em uma lista de ' +
          'regras. Cada regra é uma frase com três partes: **quando** algo acontece, **faça** isso, ' +
          '**vá** para aquele estado.',
      },
      {
        kind: 'codigo',
        texto: `#R^Alavanca: ADD A ---> S3
\\ └── quando ──┘  └ faça ┘  └ vá ┘`,
      },
      {
        kind: 'texto',
        texto:
          'Tudo o mais na linguagem — constantes, contadores, temporizadores, processos paralelos — ' +
          'existe para escrever essa frase de um jeito legível. Se você entender a frase, entendeu o ' +
          'MedState.',
      },
    ],
  },

  {
    id: 'como-roda',
    icone: '⚙️',
    titulo: 'Como um programa roda',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O MED-PC roda em **tiques**. A cada tique — por padrão **0,01 s**, um centésimo de ' +
          'segundo — ele olha o estado atual de cada processo, verifica quais gatilhos dispararam ' +
          'desde o tique anterior, executa os comandos das regras correspondentes e, se a regra ' +
          'mandar, muda de estado. Depois repete.',
      },
      {
        kind: 'passos',
        itens: [
          'O relógio avança um tique (0,01 s).',
          'Para cada processo, o MED-PC verifica os gatilhos das regras do estado em que ele está: chegou uma resposta? o temporizador do estado venceu? veio um sinal `Z`?',
          'A regra cuja condição foi satisfeita executa os seus comandos, na ordem em que estão escritos, da esquerda para a direita.',
          'Se a regra termina com `---> Sn`, o processo entra no estado `Sn` e o **temporizador daquele estado começa do zero**. Se termina com `---> SX`, ele fica onde está e nada é reiniciado.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Duas consequências que explicam quase todo comportamento estranho de um programa MedState:',
      },
      {
        kind: 'lista',
        itens: [
          '**O tempo de um estado conta a partir da entrada nele.** `5":` significa "cinco segundos depois de eu ter entrado aqui", e não "cinco segundos depois do começo da sessão". Para medir tempo de sessão você precisa de um contador próprio (ver **Padrões da linguagem**).',
          '**Nada acontece entre tiques.** O menor tempo que existe é `0.01"`. Um gatilho de tempo escrito como `.01"` é, na prática, "assim que entrar aqui, no próximo tique" — é assim que se escreve uma ação de entrada num estado.',
        ],
      },
      {
        kind: 'nota',
        texto:
          'O MedState **não tem laço** (`while`, `for`) nem sub-rotina no sentido comum. Repetir é ' +
          'voltar a um estado; esperar é ficar num estado. Tentar escrever um algoritmo linear em ' +
          'MedState é a forma mais rápida de se perder — desenhe a máquina de estados primeiro.',
      },
    ],
  },

  {
    id: 'anatomia',
    icone: '📄',
    titulo: 'Anatomia de um arquivo .MPC',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Todo arquivo tem duas metades: o **preâmbulo**, que declara nomes e memória, e o ' +
          '**corpo**, que é uma sequência de processos, cada um com os seus estados. A fronteira é o ' +
          'primeiro cabeçalho `S.S.n,` — tudo antes dele é preâmbulo.',
      },
      {
        kind: 'codigo',
        texto: `\\ ── PREÂMBULO ─────────────────────────────
\\ Comentário: uma barra invertida até o fim da linha.

^Alavanca = 1          \\ constante: a porta 1 é a alavanca
^Pelota   = 1
^Razao    = 5

DIM B = 19             \\ B vira um array indexável

LIST Intervalos = 10, 20, 30, 40, 50

VAR_ALIAS
  Respostas = A        \\ nome amigável para quem lê o arquivo
  Reforcos  = B
END

DISKVARS = A, B        \\ o que vai para o arquivo de dados

\\ ── CORPO ─────────────────────────────────
S.S.1,                 \\ processo 1
S1,                    \\   estado 1
  #START: SET A = 0 ---> S2

S2,                    \\   estado 2
  #R^Alavanca: ADD A ---> SX

S.S.2,                 \\ processo 2, roda em paralelo
S1,
  30': ---> STOPABORTFLUSH`,
      },
      {
        kind: 'tabela',
        cabecalho: ['Peça', 'Forma', 'Para que serve'],
        linhas: [
          ['Comentário', '`\\ texto até o fim da linha`', 'Ignorado pelo MED-PC. Não existe comentário de bloco.'],
          ['Constante', '`^Nome = valor`', 'Dá nome a uma porta ou a um parâmetro. Usada como `^Nome` em qualquer lugar.'],
          ['Processo', '`S.S.n,`', 'Abre um processo (*state set*). Roda em paralelo com os outros.'],
          ['Estado', '`Sn,`', 'Abre um estado dentro do processo. A numeração recomeça em cada processo.'],
          ['Regra', '`gatilho: comandos ---> destino`', 'A unidade de execução. Um estado tem quantas regras precisar.'],
        ],
      },
      {
        kind: 'nota',
        texto:
          'Indentação e espaços em branco **não têm significado** para o MED-PC — a linguagem não é ' +
          'sensível a recuo, como Python. Recuar continua sendo obrigatório para o humano seguinte: ' +
          'é o recuo que mostra qual ramo de `IF` pertence a qual decisão.',
      },
    ],
  },

  {
    id: 'preambulo',
    icone: '🏷️',
    titulo: 'Preâmbulo: constantes, arrays e listas',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O preâmbulo não executa nada — ele nomeia e reserva. Escrever o preâmbulo bem é o que ' +
          'separa um arquivo que outra pessoa consegue ajustar de um que ninguém encosta.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Construção', 'Exemplo', 'O que faz'],
        linhas: [
          [
            '`^Constante`',
            '`^Alavanca = 1`',
            'Define um nome fixo. Em todo o resto do arquivo, `^Alavanca` vale `1`. Trocar a fiação da caixa vira uma edição de uma linha.',
          ],
          [
            '`DIM`',
            '`DIM B = 19`',
            'Transforma a variável `B` num array, reservando espaço para indexá-la: `B(0)`, `B(1)`, … Declare antes de usar índice.',
          ],
          [
            '`LIST`',
            '`LIST Intervalos = 10, 20, 30`',
            'Uma lista fixa de valores, para sortear com `RANDD`/`RANDI` — a base de qualquer esquema variável (VI, VR, VT).',
          ],
          [
            '`VAR_ALIAS` … `END`',
            '`VAR_ALIAS`\n`  Respostas = A`\n`END`',
            'Apelido para uma variável de uma letra. É documentação: o programa continua vendo `A`, mas quem lê vê `Respostas`.',
          ],
          [
            '`DISKVARS`',
            '`DISKVARS = A, B, C`',
            'Lista as variáveis que vão para o arquivo de dados no fim da sessão. O que não está aqui não é gravado.',
          ],
          [
            '`DISKCOLUMNS` / `DISKFORMAT`',
            '`DISKCOLUMNS = 5`',
            'Ajustam a apresentação do arquivo de dados (colunas e formato numérico). Diretivas do MED-PC V.',
          ],
        ],
      },
      {
        kind: 'texto',
        texto:
          '**Constante para porta, constante para parâmetro.** As duas coisas mais comuns no ' +
          'preâmbulo são o mapa da caixa e os números que o experimentador vai querer mudar. Vale a ' +
          'pena separá-las visualmente, como fazem os arquivos de laboratório:',
      },
      {
        kind: 'codigo',
        texto: `\\****************************************
\\ ENTRADAS
^ALAVANCA_ESQ  = 1
^ALAVANCA_DIR  = 2
^COMEDOURO     = 3

\\****************************************
\\ SAIDAS
^DISPENSADOR   = 4
^LUZ_CASA      = 3
^LUZ_ALAVANCA  = 1

\\****************************************
\\ PARAMETROS
^RAZAO         = 5      \\ respostas por reforço
^DURACAO_PULSO = 0.05   \\ segundos
^DURACAO_SESSAO = 60'   \\ minutos`,
      },
      {
        kind: 'nota',
        texto:
          'Uma constante **não é uma variável**: `^Razao` não pode ser alterada durante a sessão. ' +
          'Se o valor muda ao longo do experimento (uma razão progressiva, por exemplo), ele tem ' +
          'que morar numa variável (`A`–`Z`), não numa constante.',
      },
    ],
  },

  {
    id: 'estados',
    icone: '🔵',
    titulo: 'Estados e a linha de transição',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Dentro de um processo, `Sn,` abre um estado e tudo o que vem depois, até o próximo `Sn,`, ' +
          'são as regras dele. A forma completa de uma regra:',
      },
      {
        kind: 'codigo',
        texto: `gatilho : comando ; comando ; comando ---> destino`,
      },
      {
        kind: 'lista',
        itens: [
          'O **gatilho** vem antes dos dois-pontos e diz *quando*.',
          'Os **comandos** são separados por `;` e executam na ordem escrita.',
          'Vários alvos de um mesmo comando são separados por `,`: `ON ^A, ^B` liga as duas portas.',
          'A **seta** `--->` e o destino são opcionais — sem eles, a regra executa e o processo fica onde está (o mesmo que `---> SX`, mas é melhor escrever `SX`, para deixar a intenção clara).',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Um estado pode ter **quantas regras precisar**, e elas convivem: o estado abaixo reage ' +
          'a três coisas diferentes.',
      },
      {
        kind: 'codigo',
        texto: `S2,  \\ Esperando resposta
  #R^Alavanca: ADD A ---> S3      \\ o rato respondeu
  30": ---> S9                    \\ passaram 30 s sem resposta
  #Z1: OFF ^LUZ_CASA ---> S9      \\ outro processo mandou parar`,
      },
      {
        kind: 'texto',
        texto:
          '**Uma regra pode ocupar várias linhas.** Arquivos reais quebram listas longas de comandos ' +
          'para caber na tela. A regra é simples: uma linha só começa uma regra nova se tiver um ' +
          '`:` de gatilho ou de rótulo; qualquer outra linha continua a regra anterior.',
      },
      {
        kind: 'codigo',
        texto: `S6,
  1": OFF ^DISPENSADOR, ^LUZ_ALAVANCA, ^LUZ_CASA;
     ADD B(0); SHOW 1, PRONTO, B(0) ---> S8`,
      },
    ],
  },

  {
    id: 'gatilhos',
    icone: '⚡',
    titulo: 'Gatilhos — a coluna da esquerda',
    blocos: [
      {
        kind: 'texto',
        texto: 'Tudo o que pode acordar uma regra, com um exemplo de cada:',
      },
      {
        kind: 'tabela',
        cabecalho: ['Gatilho', 'Exemplo', 'Dispara quando'],
        linhas: [
          [
            '`#START`',
            '`#START: SET A = 0 ---> S2`',
            'A sessão começa. Acontece **uma vez só**, no início — por isso só faz sentido no `S1` de um processo.',
          ],
          [
            '`#Rn`',
            '`#R1: ADD A ---> SX`',
            'Chega uma resposta na porta de entrada `n` (a alavanca, o bico, o sensor do comedouro ligado ali).',
          ],
          [
            '`#R^Nome`',
            '`#R^Alavanca: ADD A ---> SX`',
            'O mesmo, com a porta vindo de uma constante. **É assim que se escreve** — o número cru só aparece no preâmbulo.',
          ],
          [
            '`#Kn`',
            '`#K1: ---> S5`',
            'Uma tecla do teclado/entrada K do MED-PC é acionada. Usado para testes manuais e para o experimentador intervir.',
          ],
          [
            '`#Zn`',
            '`#Z1: OFF ^LUZ ---> S9`',
            'Outro processo emitiu o sinal `Zn` (de `Z1` a `Z32`). É o rádio entre processos.',
          ],
          [
            'tempo em segundos',
            '`5": ---> S2`',
            'Passaram 5 segundos **desde a entrada no estado**. Aceita decimal: `0.05"`, `.01"`.',
          ],
          [
            'tempo em minutos',
            "`30': ---> STOPABORTFLUSH`",
            'Passaram 30 minutos desde a entrada no estado.',
          ],
          [
            'tempo por constante ou variável',
            '`^Intervalo": ---> S3`  ·  `C": ---> S3`',
            'O mesmo, com a duração vindo de uma constante ou de uma variável — é o que permite um intervalo sorteado a cada volta.',
          ],
        ],
      },
      {
        kind: 'texto',
        texto:
          'O gatilho de tempo é o que faz o MedState conseguir esperar. Estes três usos cobrem quase ' +
          'tudo o que se escreve:',
      },
      {
        kind: 'codigo',
        texto: `S3,
  .01": ON ^DISPENSADOR ---> S4     \\ "assim que entrar": ação de entrada
S4,
  0.05": OFF ^DISPENSADOR ---> S2   \\ pulso de 50 ms
S5,
  C": ---> S6                       \\ espera o tempo que estiver em C`,
      },
      {
        kind: 'nota',
        texto:
          'Combinações lógicas de eventos (por exemplo `#R1 ! #R2`) existem no MED-PC, mas o RatFlow ' +
          '**não as interpreta**: o gatilho fica preservado como texto cru, fiel e editável no editor ' +
          'de código, e o canvas mostra um nó "avançado" no lugar de adivinhar o sentido.',
      },
    ],
  },

  {
    id: 'comandos',
    icone: '🔧',
    titulo: 'Comandos — o que a regra faz',
    blocos: [
      {
        kind: 'tabela',
        cabecalho: ['Comando', 'Exemplo', 'O que faz'],
        linhas: [
          ['`ON`', '`ON ^DISPENSADOR`', 'Liga uma porta de saída e **mantém ligada** até um `OFF`. Vários alvos: `ON ^A, ^B`.'],
          ['`OFF`', '`OFF ^DISPENSADOR, ^LUZ`', 'Desliga portas ligadas antes por um `ON`.'],
          ['`LOCKON`', '`LOCKON ^BOMBA`', 'Liga e **trava**: um `OFF` comum não apaga. Protege um dispositivo crítico de ser desligado por outro processo.'],
          ['`LOCKOFF`', '`LOCKOFF ^BOMBA`', 'Destrava e desliga o que foi ligado com `LOCKON`.'],
          ['`ADD`', '`ADD A`  ·  `ADD B(17)`', 'Soma 1. É o jeito de contar respostas, reforços e tiques.'],
          ['`SUB`', '`SUB B(18)`', 'Subtrai 1.'],
          ['`SET`', '`SET A = 0, B = 1`', 'Atribui um valor, sem depender do anterior. Aceita expressão: `SET C = B(2) + .21`.'],
          ['`SHOW`', '`SHOW 1, RESPOSTAS, A`', 'Mostra `rótulo = valor` na posição 1 do painel do MED-PC durante a sessão. Não muda nada no programa — é só para o experimentador olhar.'],
          ['`Zn`', '`Z1`', 'Emite o sinal `Z1`, que acorda quem tiver `#Z1` como gatilho em qualquer outro processo.'],
          ['`IF`', '`IF A >= ^Razao [@Sim, @Nao]`', 'Testa uma condição e desvia para um dos dois rótulos. Ver a seção **IF e rótulos**.'],
          ['`RANDD`', '`RANDD C = Intervalos`', 'Sorteia um valor da `LIST` **sem repetir** até esgotar a lista. Garante que a média sai certa na sessão.'],
          ['`RANDI`', '`RANDI C = Intervalos`', 'Sorteia um valor da `LIST` **podendo repetir** a qualquer sorteio.'],
        ],
      },
      {
        kind: 'texto',
        texto: 'Todos eles, numa página só, para copiar e adaptar:',
      },
      {
        kind: 'codigo',
        texto: `S2,
  \\ saídas
  #R1: ON ^LUZ_CASA, ^LUZ_ALAVANCA ---> SX
  #R2: OFF ^LUZ_ALAVANCA ---> SX
  #R3: LOCKON ^BOMBA ---> SX
  #R4: LOCKOFF ^BOMBA ---> SX

  \\ contas
  #R5: ADD A ---> SX
  #R6: SUB A ---> SX
  #R7: SET A = 0, B(1) = 100 ---> SX

  \\ painel, sinal e sorteio
  #R8: SHOW 1, RESPOSTAS, A; Z1; RANDD C = Intervalos ---> SX

  \\ decisão
  #R9: IF A >= ^RAZAO [@REFORCO, @CONTINUA]
         @REFORCO:  SET A = 0 ---> S3
         @CONTINUA: ---> SX`,
      },
      {
        kind: 'nota',
        texto:
          '**A ordem importa.** Os comandos de uma regra executam da esquerda para a direita, e a ' +
          'transição acontece por último. `ADD A; IF A >= ^Razao …` testa o valor **já somado** — ' +
          'inverter as duas partes muda o esquema de FR 5 para FR 6.',
      },
    ],
  },

  {
    id: 'variaveis',
    icone: '🔢',
    titulo: 'Variáveis, arrays e aritmética',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O MedState tem **26 variáveis**, de `A` a `Z`. Não existe declarar uma nova nem inventar ' +
          'um nome: a memória do programa é essa. Toda variável começa a sessão valendo zero.',
      },
      {
        kind: 'texto',
        texto:
          'Como 26 nomes é pouco para um experimento sério, a linguagem oferece duas saídas, e as ' +
          'duas aparecem em todo arquivo real:',
      },
      {
        kind: 'lista',
        itens: [
          '**Arrays.** `DIM B = 19` transforma `B` num array; a partir daí `B(0)`, `B(1)`, … `B(19)` são casas independentes. Uma letra vira vinte contadores.',
          '**Apelidos.** `VAR_ALIAS` dá um nome legível à letra. Não muda nada na execução — muda tudo na hora de reler o arquivo seis meses depois.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'O padrão de laboratório é dedicar uma letra a cada assunto e documentar as casas num ' +
          'bloco de comentário logo abaixo do `DIM`:',
      },
      {
        kind: 'codigo',
        texto: `DIM B = 19

\\ B(0)  = pronto
\\ B(1)  = tempo de sessão (em centésimos)
\\ B(5)  = respostas na alavanca esquerda
\\ B(7)  = respostas na alavanca direita
\\ B(17) = índice do próximo evento no array D`,
      },
      {
        kind: 'texto',
        texto: 'O índice pode ser um número, uma variável, ou o valor de outro array:',
      },
      {
        kind: 'codigo',
        texto: `SET D(0) = 1          \\ índice literal
ADD B(I)              \\ índice numa variável
SET D(B(17)) = B(2)   \\ índice vindo de outro array — o padrão de log de eventos`,
      },
      {
        kind: 'texto',
        texto:
          'Aritmética simples funciona no valor de um `SET` e nos argumentos de um `SHOW`: `+`, `-`, ' +
          '`*`, `/`. É o que permite gravar um evento com um código na parte decimal, ou mostrar o ' +
          'tempo em minutos num contador que conta centésimos:',
      },
      {
        kind: 'codigo',
        texto: `SET D(B(17)) = B(2) + .21    \\ carimbo de tempo + código do evento (.21)
SHOW 6, TEMPO_SESSAO, B(1)/6000`,
      },
      {
        kind: 'nota',
        texto:
          'O RatFlow **preserva** expressões aritméticas fielmente, mas ainda não as decompõe em nós ' +
          'do canvas — uma regra com `B(2) + .21` continua editável no editor de código e volta a ser ' +
          'gravada idêntica, mas aparece como nó "avançado" no nível 2.',
      },
    ],
  },

  {
    id: 'destinos',
    icone: '➡️',
    titulo: 'Destinos — para onde a regra manda',
    blocos: [
      {
        kind: 'tabela',
        cabecalho: ['Destino', 'Exemplo', 'Efeito'],
        linhas: [
          [
            '`Sn`',
            '`---> S3`',
            'Entra no estado 3 **do mesmo processo**. O temporizador do novo estado começa do zero.',
          ],
          [
            '`SX`',
            '`---> SX`',
            '"Fica aqui." Não muda de estado e **não reinicia nada** — nem o temporizador que já estava correndo.',
          ],
          [
            'fim de programa',
            '`---> STOPABORTFLUSH`',
            'Encerra. As palavras `STOP`, `ABORT`, `FLUSH`, `KILL`, `PAUSE`, `RESUME` e `NOOP` combinam-se por concatenação; `STOPABORTFLUSH` — parar, abortar o que estiver pendente e descarregar os dados em disco — é a forma que aparece em praticamente todo arquivo real.',
          ],
          [
            'sem seta',
            '`#R1: ADD A`',
            'Igual a `SX`, mas menos explícito. Prefira escrever `---> SX`.',
          ],
        ],
      },
      {
        kind: 'texto',
        texto:
          '**`SX` contra voltar para o próprio número.** As duas coisas parecem iguais e não são. Num ' +
          'estado `S2` que tem um temporizador de 30 s:',
      },
      {
        kind: 'codigo',
        texto: `S2,
  30": ---> S9                 \\ o limite de tempo
  #R^Alavanca: ADD A ---> SX   \\ conta e NÃO reinicia os 30 s
  \\ #R^Alavanca: ADD A ---> S2  ← reiniciaria os 30 s a cada resposta`,
      },
      {
        kind: 'texto',
        texto:
          'Com `SX`, o limite de 30 s é do estado. Com `---> S2`, ele vira "30 s sem responder" — um ' +
          'experimento completamente diferente, escrito com dois caracteres de diferença.',
      },
      {
        kind: 'nota',
        texto:
          'Um destino que não seja `Sn` nem `SX` — os fins de programa, por exemplo — o RatFlow trata ' +
          'como não modelado: a regra inteira cai no caminho cru, em vez de ser adivinhada. Isso é ' +
          'deliberado: interpretar `STOPABORTFLUSH` como `SX` mudaria o sentido do programa.',
      },
    ],
  },

  {
    id: 'decisao',
    icone: '🔀',
    titulo: 'IF e rótulos: decisão dentro da regra',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O `IF` é a única ramificação da linguagem. Ele não tem bloco: tem um **par de rótulos** ' +
          'entre colchetes — o primeiro é seguido quando a condição é verdadeira, o segundo quando é ' +
          'falsa — e os rótulos são definidos logo abaixo, na mesma regra, com `@Nome:`.',
      },
      {
        kind: 'codigo',
        texto: `#R^Alavanca: ADD A; IF A >= ^Razao [@REFORCO, @CONTINUA]
     @REFORCO:  SET A = 0 ---> S3
     @CONTINUA: ---> SX`,
      },
      {
        kind: 'lista',
        itens: [
          'Comparadores: `=`, `<>`, `<`, `>`, `<=`, `>=`.',
          'Cada ramo é um pedaço de regra completo: pode ter comandos, pode ter a sua própria seta, pode ter outro `IF`.',
          'Os dois ramos são obrigatórios. Um ramo que não faz nada e fica no lugar escreve-se `@NAO: ---> SX`.',
        ],
      },
      {
        kind: 'texto',
        texto:
          '`IF` aninha, e é assim que se escreve uma sequência de verificações — o padrão do ' +
          'relógio de sessão nos arquivos reais:',
      },
      {
        kind: 'codigo',
        texto: `.01": IF B(18) > 0 [@MAIS, @PARA]
     @MAIS: SUB B(18) ---> SX
     @PARA: OFF ^DISPENSADOR; IF B(9) < A(8) [@OUTRO, @PARA]
          @OUTRO: ---> S3
          @PARA:  ADD B(17) ---> STOPABORTFLUSH`,
      },
      {
        kind: 'texto',
        texto:
          'Repare que `@PARA` aparece **duas vezes**, uma por nível — e isso é correto e comum. A ' +
          'resolução é sempre *o primeiro rótulo com aquele nome depois do `IF` que o cita*, o que faz ' +
          'a leitura seguir para a frente, como o recuo sugere.',
      },
      {
        kind: 'nota',
        texto:
          'Um `IF` que cita `[@ROTULO, …]` sem que exista um `@ROTULO:` correspondente é um erro ' +
          'silencioso no MED-PC — e um erro de digitação **muito** comum. O RatFlow avisa ' +
          '(`rótulo inexistente`) e mostra a regra como nó avançado em vez de adivinhar. Um rótulo ' +
          'com espaço no nome (`@COMPONENTE 4:`) também não é reconhecido como rótulo: use ' +
          '`@COMPONENTE_4:`.',
      },
    ],
  },

  {
    id: 'processos',
    icone: '🧵',
    titulo: 'Processos paralelos e sinais Z',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Cada `S.S.n,` é um **processo independente**, com os seus próprios estados e o seu próprio ' +
          'temporizador, e todos avançam no mesmo tique. Isso é o que permite escrever, ao mesmo ' +
          'tempo e sem embaralhar: a tarefa, o relógio da sessão, o registro de dados e o teste da ' +
          'caixa.',
      },
      {
        kind: 'texto',
        texto:
          'A divisão que os arquivos de laboratório usam, e que vale copiar:',
      },
      {
        kind: 'tabela',
        cabecalho: ['Processo', 'Papel'],
        linhas: [
          ['`S.S.1`', 'Teste da caixa: acende tudo, espera uma resposta em cada alavanca, confirma que a fiação está certa antes de começar.'],
          ['`S.S.2`', 'A tarefa em si — o esquema de reforço.'],
          ['`S.S.10`', 'Contagem de respostas e registro de eventos (roda sempre, independente do estado da tarefa).'],
          ['`S.S.12`', 'Relógio da sessão e critério de parada.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Processos não compartilham estado, mas compartilham **as variáveis** `A`–`Z` e podem ' +
          'conversar por **sinais Z**. Um processo emite `Z1` como comando; qualquer outro que tenha ' +
          '`#Z1` como gatilho acorda no mesmo tique. São 32 sinais, de `Z1` a `Z32`.',
      },
      {
        kind: 'codigo',
        texto: `\\ Processo 12: o relógio decide que acabou e avisa
S.S.12,
S1,
  #START: ---> S2
S2,
  60': Z1 ---> S3        \\ "acabou o tempo"
S3,
  .01": ---> STOPABORTFLUSH

\\ Processo 2: a tarefa escuta e se encerra com dignidade
S.S.2,
S2,
  #R^Alavanca: ADD A ---> SX
  #Z1: OFF ^LUZ_CASA, ^LUZ_ALAVANCA ---> S9
S9,
  .01": ---> SX          \\ estado terminal: não faz mais nada`,
      },
      {
        kind: 'nota',
        texto:
          'Como as variáveis são compartilhadas, dois processos que escrevem na mesma variável no ' +
          'mesmo tique brigam. O padrão seguro: **um dono por variável** — quem conta respostas é só ' +
          'o processo de registro; os outros leem.',
      },
    ],
  },

  {
    id: 'dados',
    icone: '💾',
    titulo: 'Sair com os dados: SHOW e DISKVARS',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Um programa que roda perfeitamente e não grava nada não serviu para nada. São dois ' +
          'caminhos, e eles não se substituem:',
      },
      {
        kind: 'lista',
        itens: [
          '**`SHOW`** é a tela: mostra um valor no painel do MED-PC **durante** a sessão, para o experimentador acompanhar. Não grava nada.',
          '**`DISKVARS`** é o arquivo: lista as variáveis despejadas no arquivo de dados no fim da sessão. O que não está no `DISKVARS` **não existe** depois que a sessão termina.',
        ],
      },
      {
        kind: 'codigo',
        texto: `DISKVARS = A, B, C, D

\\ …

  #R^Alavanca: ADD B(5); SHOW 3, RESP_ESQ, B(5) ---> SX`,
      },
      {
        kind: 'texto',
        texto:
          'Para gravar **quando** cada coisa aconteceu, e não só quantas vezes, o padrão é um array ' +
          'usado como fita de eventos: um contador serve de índice, e cada evento é gravado como ' +
          '`tempo + código`, onde o código vive na parte decimal.',
      },
      {
        kind: 'codigo',
        texto: `\\ B(2) = tempo real em centésimos, B(17) = índice do próximo evento
\\ .2 = resposta esquerda, .3 = resposta direita

#R^ALAVANCA_ESQ: SET D(B(17)) = B(2) + .2;
    ADD B(17);
    SET D(B(17)) = -987.987 ---> SX`,
      },
      {
        kind: 'texto',
        texto:
          'O `-987.987` gravado sempre na casa seguinte é a **marca de fim** da fita: quem for ler o ' +
          'arquivo depois sabe onde os dados acabam, mesmo que o array tenha sido dimensionado com ' +
          'folga. É uma convenção de laboratório, não um recurso da linguagem — mas é praticamente ' +
          'universal nos arquivos do MED-PC.',
      },
    ],
  },

  {
    id: 'padroes',
    icone: '🧩',
    titulo: 'Padrões da linguagem',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Quase todo programa MedState é uma combinação de meia dúzia de padrões. Estes são os que ' +
          'aparecem em todos os arquivos, e reconhecê-los é o atalho para ler qualquer programa de ' +
          'laboratório.',
      },
      {
        kind: 'texto',
        texto: '**1. Ação de entrada** — fazer alguma coisa assim que o estado começa.',
      },
      {
        kind: 'codigo',
        texto: `S3,
  .01": ON ^DISPENSADOR; ADD B ---> S4`,
      },
      {
        kind: 'texto',
        texto:
          '**2. Pulso** — ligar um dispositivo por um tempo exato. Não existe "ligue por 50 ms": são ' +
          'sempre dois estados, um que liga e um que desliga.',
      },
      {
        kind: 'codigo',
        texto: `S3,
  .01": ON ^DISPENSADOR ---> S4
S4,
  0.05": OFF ^DISPENSADOR ---> S2`,
      },
      {
        kind: 'texto',
        texto: '**3. Contador com meta (razão fixa)** — conte, teste, zere.',
      },
      {
        kind: 'codigo',
        texto: `S2,
  #R^Alavanca: ADD A; IF A >= ^Razao [@REFORCO, @CONTINUA]
       @REFORCO:  SET A = 0 ---> S3
       @CONTINUA: ---> SX`,
      },
      {
        kind: 'texto',
        texto:
          '**4. Espera sorteada (intervalo variável)** — uma `LIST` mais `RANDD` numa variável, e a ' +
          'variável como gatilho de tempo.',
      },
      {
        kind: 'codigo',
        texto: `LIST Intervalos = 10, 20, 30, 40, 50

S1,
  #START: RANDD C = Intervalos ---> S2
S2,
  C": ---> S3                      \\ espera o intervalo sorteado
S3,
  #R^Alavanca: ON ^Pelota; RANDD C = Intervalos ---> S4`,
      },
      {
        kind: 'texto',
        texto:
          '**5. Relógio de sessão** — um processo só para contar o tempo, porque o temporizador de ' +
          'estado sempre reinicia e não serve para medir a sessão inteira.',
      },
      {
        kind: 'codigo',
        texto: `S.S.12,
S1,
  #START: ---> S2
S2,
  .01": ADD B(1);                     \\ B(1) conta centésimos de segundo
     SHOW 6, TEMPO, B(1)/6000;        \\ mostra em minutos
     IF B(1) < A(2) [@SEGUE, @PARA]
          @SEGUE: ---> SX
          @PARA:  ---> STOPABORTFLUSH`,
      },
      {
        kind: 'texto',
        texto:
          '**6. Intervalo entre tentativas (ITI) / timeout** — um estado que só existe para esperar, ' +
          'com as luzes apagadas.',
      },
      {
        kind: 'codigo',
        texto: `S5,
  .01": OFF ^LUZ_CASA ---> S6
S6,
  ^ITI": ON ^LUZ_CASA ---> S2`,
      },
      {
        kind: 'texto',
        texto:
          '**7. Estado de porteiro** — uma variável-bandeira que outro processo consulta, em vez de ' +
          'tentar espiar em que estado o vizinho está. `F(0) = 1` significando "estou entregando ' +
          'reforço agora" é o exemplo clássico: o processo de registro conta as respostas em duas ' +
          'contas diferentes conforme a bandeira.',
      },
      {
        kind: 'codigo',
        texto: `\\ no processo da tarefa
S3,
  .01": SET F(0) = 1; ON ^DISPENSADOR ---> S4
S4,
  1": SET F(0) = 0; OFF ^DISPENSADOR ---> S2

\\ no processo de registro
S2,
  #R^Alavanca: IF F(0) = 1 [@DURANTE_REFORCO, @NORMAL]
       @DURANTE_REFORCO: ADD B(6) ---> SX
       @NORMAL:          ADD B(5); SHOW 3, RESP, B(5) ---> SX`,
      },
      {
        kind: 'texto',
        texto:
          '**8. Teste de caixa** — o primeiro processo do arquivo, que acende tudo e só libera a ' +
          'sessão depois de uma resposta em cada manipulando. Custa dez linhas e evita perder um ' +
          'sujeito por um cabo solto.',
      },
      {
        kind: 'codigo',
        texto: `S.S.1,
S1,
  .01": ON ^LUZ_CASA, ^LUZ_ESQ, ^LUZ_DIR ---> S2
S2,
  #R^ALAVANCA_ESQ: ON ^DISPENSADOR ---> S3
S3,
  1": OFF ^DISPENSADOR, ^LUZ_ESQ ---> S4
S4,
  #R^ALAVANCA_DIR: ON ^DISPENSADOR ---> S5
S5,
  1": OFF ^DISPENSADOR, ^LUZ_DIR, ^LUZ_CASA;
     ADD B(0); SHOW 1, PRONTO, B(0) ---> S6
S6,
  1": ---> SX`,
      },
    ],
  },

  {
    id: 'exemplo',
    icone: '📘',
    titulo: 'Um programa inteiro, linha a linha',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Razão fixa 5: a cada cinco respostas na alavanca, uma pelota. É o mesmo programa que o ' +
          'modelo **Razão fixa (FR)** da galeria gera — abra-o no RatFlow e compare com o canvas.',
      },
      {
        kind: 'codigo',
        texto: `\\ Razão fixa (FR 5)

^Alavanca = 1
^Pelota   = 1
^Razao    = 5

VAR_ALIAS
  Respostas = A
  Reforcos  = B
END

S.S.1,
S1,
  #START: SET A = 0, B = 0 ---> S2

S2,
  #R^Alavanca: ADD A; IF A >= ^Razao [@Reforco, @Continua]
       @Reforco:  SET A = 0 ---> S3
       @Continua: ---> SX

S3,
  .01": ON ^Pelota; ADD B ---> S4

S4,
  0.05": OFF ^Pelota ---> S2`,
      },
      {
        kind: 'tabela',
        cabecalho: ['Trecho', 'Leitura'],
        linhas: [
          ['`^Alavanca = 1`', 'A alavanca está na porta de entrada 1. Trocar de porta é mudar esta linha.'],
          ['`^Razao = 5`', 'O parâmetro do experimento fica no topo, com nome — não escondido no meio de um `IF`.'],
          ['`VAR_ALIAS`', '`A` conta respostas, `B` conta reforços. Só para o leitor; o programa vê as letras.'],
          ['`#START: SET A = 0, B = 0`', 'Zera os contadores uma vez, no início. Boa prática mesmo com as variáveis já começando em zero — deixa a intenção escrita.'],
          ['`#R^Alavanca: ADD A`', 'Cada resposta soma 1 em `A`. Este é o único lugar do programa que conta.'],
          ['`IF A >= ^Razao`', 'Teste feito **depois** do `ADD`: com `^Razao = 5`, o reforço sai na quinta resposta.'],
          ['`@Reforco: SET A = 0 ---> S3`', 'Bateu a meta: zera a contagem e vai entregar.'],
          ['`@Continua: ---> SX`', 'Ainda não: fica no mesmo estado, esperando a próxima resposta.'],
          ['`S3` e `S4`', 'O par que faz o pulso do dispensador: `S3` liga e conta o reforço, `S4` espera 50 ms, desliga e devolve o controle ao `S2`.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Note o que **não** está aqui e um programa de verdade teria: limite de tempo da sessão, ' +
          '`DISKVARS`, teste de caixa, registro de eventos com carimbo de tempo. Os padrões da seção ' +
          'anterior encaixam neste esqueleto sem mexer no que já existe — cada um é um processo a ' +
          'mais.',
      },
    ],
  },

  {
    id: 'armadilhas',
    icone: '⚠️',
    titulo: 'Armadilhas comuns',
    blocos: [
      {
        kind: 'lista',
        itens: [
          '**`---> S2` em vez de `---> SX` no próprio estado.** Reinicia o temporizador do estado a cada passagem. Vira "30 s sem responder" onde você queria "30 s no total".',
          '**Testar antes de somar.** `IF A >= ^Razao; ADD A` e `ADD A; IF A >= ^Razao` diferem em um reforço por bloco. A ordem dos comandos é a ordem da execução.',
          '**`ON` sem `OFF`.** O dispositivo fica ligado até o fim da sessão. Todo `ON` precisa de um `OFF` em **todos** os caminhos que saem dali — inclusive no ramo de encerramento.',
          '**Índice sem `DIM`.** Usar `B(5)` sem ter declarado `DIM B` não faz o que você espera. Declare primeiro.',
          '**Rótulo citado que não existe.** `IF … [@REFORCO, @NAO]` com a definição escrita `@REFORCOO:` é aceito na digitação e quebra o desvio. O RatFlow sinaliza (`rótulo inexistente`); o MED-PC não necessariamente.',
          '**Rótulo com espaço.** `@COMPONENTE 4:` não é um rótulo — a fronteira é `@Nome:` sem espaço. Use `@COMPONENTE_4:`.',
          '**Duas letras para a mesma coisa.** Com só 26 variáveis, a tentação é reciclar uma letra "que já não está sendo usada". Um `DIM` e casas nomeadas em comentário custam menos do que caçar o conflito depois.',
          '**Dois processos escrevendo a mesma variável.** Eles rodam no mesmo tique e o resultado depende da ordem. Um dono por variável.',
          '**Esquecer o `DISKVARS`.** A sessão roda inteira, os contadores contam certo, e o arquivo de dados sai sem eles.',
        ],
      },
      {
        kind: 'nota',
        texto:
          'Sobre `.01"` e `0.01"`: as duas formas são o mesmo tempo, e as duas aparecem nos arquivos ' +
          'reais — `.01"`, sem o zero, é de longe a mais comum. O RatFlow entende as duas e reescreve ' +
          'cada uma exatamente como você digitou.',
      },
    ],
  },

  {
    id: 'dialetos',
    icone: '🆚',
    titulo: 'MED-PC IV × MED-PC V',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A linguagem é a mesma nas duas versões; o que muda é o que existe em volta. Um arquivo ' +
          'escrito para o IV normalmente roda no V, e o caminho inverso é o que dá problema.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Recurso', 'MED-PC IV', 'MED-PC V'],
        linhas: [
          ['Máquina de estados, `S.S.n`, `Sn`, gatilhos, comandos', 'sim', 'sim'],
          ['`VAR_ALIAS` … `END`', 'não', 'sim'],
          ['`DISKCOLUMNS`, `DISKFORMAT`', 'não', 'sim'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'O RatFlow valida contra o **MED-PC V** e avisa quando um arquivo usa algo que a versão ' +
          'escolhida não tem. Se o equipamento do seu laboratório é IV, evite `VAR_ALIAS` e as ' +
          'diretivas de disco novas — o apelido de variável pode virar simplesmente um comentário ao ' +
          'lado da letra.',
      },
    ],
  },

  {
    id: 'ratflow',
    icone: '🐀',
    titulo: 'O que o RatFlow faz com tudo isso',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O RatFlow lê o `.MPC` e desenha a máquina de estados: cada estado vira um nó, cada `--->` ' +
          'vira uma seta, e o duplo clique num estado abre as regras dele como um grafo de gatilhos, ' +
          'ações, decisões e destinos. Editar o desenho reescreve o texto — e só o pedaço de texto ' +
          'que mudou.',
      },
      {
        kind: 'lista',
        itens: [
          '**O arquivo é a fonte da verdade.** Comentários, recuo e ordem originais são preservados byte a byte. Um arquivo do laboratório abre e volta a fechar igual.',
          '**O que não é reconhecido é preservado, não descartado.** Combinações lógicas de eventos, aritmética complexa, destinos de fim de programa: viram um nó "avançado" que mostra o texto cru, editável no editor de código.',
          '**Nada mora fora do arquivo.** Nomes amigáveis, papéis e posições dos nós são gravados no próprio `.MPC` — em `^Constante`, `VAR_ALIAS` e comentários `\\@nome:` que o MED-PC ignora.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Para saber onde clicar, o que cada painel faz e quais os limites do editor, veja o ' +
          '**Manual do RatFlow** (menu ☰ → Ajuda → Manual). Esta página é sobre a linguagem; aquela é ' +
          'sobre a ferramenta.',
      },
    ],
  },
]
