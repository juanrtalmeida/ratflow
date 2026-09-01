/**
 * Conteúdo da página "Estilo e estrutura" (rota `#/estilo`). Dados, não JSX —
 * mesma convenção dos outros guias, cujos tipos este arquivo reaproveita.
 *
 * Divisão de trabalho entre os guias de documentação:
 *
 * - `manual-conteudo.ts` explica **o RatFlow** — onde clicar, o que cada
 *   painel faz, quais os limites do editor;
 * - `linguagem-conteudo.ts` explica **a linguagem** — o que o MED-PC executa e
 *   com que sintaxe;
 * - este arquivo explica **como escrever** — as convenções que fazem um `.MPC`
 *   continuar legível seis meses depois, na mão de outra pessoa.
 *
 * A fronteira com "Padrões da linguagem" é de propósito: lá estão os idiomas
 * que você **precisa** conhecer para que o programa funcione (pulso, relógio de
 * sessão, porteiro); aqui está o que é **escolha** de quem escreve — nome,
 * ordem, comentário, tamanho do processo. Nada nesta página muda o que o
 * MED-PC executa; tudo nela muda o custo de mexer no arquivo depois.
 */

import type { ManualSecao } from './manual-conteudo.ts'

export const ESTILO: readonly ManualSecao[] = [
  {
    id: 'por-que',
    icone: '🧭',
    titulo: 'Por que padronizar',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Um programa MedState não é escrito uma vez. Ele é copiado do arquivo de um colega, ' +
          'ajustado para outro grupo, retomado no meio do doutorado seguinte e conferido às pressas ' +
          'na véspera de uma sessão. O leitor mais frequente do seu `.MPC` é **você daqui a seis ' +
          'meses**, e ele não vai lembrar por que `C` valia 12.',
      },
      {
        kind: 'texto',
        texto:
          'A linguagem não ajuda: são 26 nomes de variável, sem tipos, sem função, sem escopo — o ' +
          'compilador aceita qualquer coisa que esteja sintaticamente correta, inclusive um ' +
          'experimento diferente do que você quis descrever. **Nada nesta página o MED-PC verifica.** ' +
          'É tudo convenção, e é justamente por isso que precisa ser combinada.',
      },
      {
        kind: 'lista',
        itens: [
          '**Um parâmetro, um lugar.** Quem for rodar FR 10 em vez de FR 5 muda uma linha do topo, não caça um `5` no meio de um `IF`.',
          '**O nome no arquivo, não na cabeça.** `^ALAVANCA_ESQ` em vez de `1`; `VAR_ALIAS` para `A`, `B`, `C`.',
          '**O comentário responde "por quê", não "o quê".** `ADD B(5)` já diz que soma; o que falta é *o que* `B(5)` conta.',
          '**Estrutura previsível.** Se todo arquivo do laboratório tem as mesmas peças na mesma ordem, achar qualquer coisa vira reflexo.',
        ],
      },
      {
        kind: 'nota',
        texto:
          'Nenhuma regra daqui vale mais que a convenção que o seu laboratório já usa. Se os arquivos ' +
          'da casa nomeiam constantes em português com maiúsculas, siga — a consistência entre os ' +
          'arquivos vale mais que a preferência de qualquer guia.',
      },
    ],
  },

  {
    id: 'nomes',
    icone: '🏷️',
    titulo: 'Nomes: constantes, variáveis e rótulos',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Nome é o único mecanismo de abstração que o MedState oferece. Usar bem os três lugares ' +
          'onde ele existe — `^Constante`, `VAR_ALIAS` e `@Rotulo` — é metade da legibilidade de um ' +
          'arquivo.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Nomeie', 'Convenção sugerida', 'Exemplo'],
        linhas: [
          [
            'Porta da caixa',
            'Maiúsculas, o que o bicho vê — não o número nem a marca do equipamento',
            '`^ALAVANCA_ESQ = 1`, `^LUZ_CASA = 3`',
          ],
          [
            'Parâmetro do experimento',
            'Maiúsculas, com a unidade quando não for óbvia',
            '`^RAZAO = 5`, `^ITI_SEG = 20`, `^DUR_SESSAO_MIN = 60`',
          ],
          [
            'Variável de trabalho',
            '`VAR_ALIAS` com o substantivo do que ela guarda',
            '`Respostas = A`, `Reforcos = B`',
          ],
          [
            'Casa de array',
            'Comentário logo abaixo do `DIM`, uma linha por casa usada',
            '`\\ B(5) = respostas na alavanca esquerda`',
          ],
          [
            'Rótulo de `IF`',
            'Maiúsculas, dizendo o **caso**, não o desfecho',
            '`@BATEU_A_META`, `@AINDA_NAO`',
          ],
        ],
      },
      {
        kind: 'texto',
        texto:
          'O teste do bom nome é ler a regra em voz alta e ela virar uma frase do experimento, não ' +
          'uma frase de programação:',
      },
      {
        kind: 'codigo',
        texto: `\\ ruim — correto, e ilegível
#R1: ADD A; IF A >= 5 [@X, @Y]
     @X: SET A = 0 ---> S3
     @Y: ---> SX

\\ bom — a mesma coisa, dizendo o que é
#R^ALAVANCA: ADD Respostas; IF Respostas >= ^RAZAO [@BATEU_A_META, @AINDA_NAO]
     @BATEU_A_META: SET Respostas = 0 ---> S3
     @AINDA_NAO:    ---> SX`,
      },
      {
        kind: 'lista',
        itens: [
          '**Sem abreviação que só você entende.** `^ITI_SEG` é claro; `^IT` não é. O nome longo não custa nada em execução.',
          '**Sem número mágico no corpo.** Todo valor que alguém pode querer mudar é uma `^Constante`. Ficam soltos só os tempos que são mecânica do equipamento, como o `0.05"` de um pulso.',
          '**Um nome, um sentido, no arquivo inteiro.** Se `C` é o intervalo sorteado no processo 1, `C` não vira outra coisa no processo 4.',
          '**Rótulos repetidos em níveis diferentes de `IF` são normais** e não são conflito — mas dois `@PARA` no mesmo nível são um erro esperando acontecer. Nomeie pelo caso e o problema não aparece.',
        ],
      },
      {
        kind: 'nota',
        texto:
          '`VAR_ALIAS` é enfeite para o leitor: o MED-PC continua vendo as letras, e o RatFlow lê o ' +
          'bloco para mostrar o nome amigável no canvas. Ele não cria variável nova nem protege ' +
          'contra reuso — quem garante um dono por letra é você.',
      },
    ],
  },

  {
    id: 'arquivo',
    icone: '📄',
    titulo: 'A ordem do arquivo',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O MED-PC exige pouco: o preâmbulo antes do primeiro `S.S.n,` e mais nada. Como a ordem é ' +
          'livre, vale fixar uma — abrir um arquivo do laboratório e já saber onde olhar é o ganho ' +
          'inteiro.',
      },
      {
        kind: 'passos',
        itens: [
          '**Cabeçalho**: nome do protocolo, autor, data, uma linha dizendo o que o programa faz e para que caixa ele foi escrito.',
          '**Portas** (`^Constante`): tudo que é fiação — entradas primeiro, saídas depois.',
          '**Parâmetros** (`^Constante`): razão, intervalos, duração da sessão. É a parte que muda entre grupos.',
          '**Memória**: `DIM` de cada array, com as casas documentadas em comentário logo abaixo.',
          '**`LIST`**: as listas de sorteio.',
          '**`VAR_ALIAS`**: os nomes amigáveis das letras.',
          '**`DISKVARS`**: o que vai para o arquivo de dados. Perto do fim do preâmbulo, onde é fácil conferir.',
          '**Processos**, na ordem em que se lê o experimento: teste de caixa, tarefa principal, registro, relógio de sessão.',
        ],
      },
      {
        kind: 'codigo',
        texto: `\\ ============================================================
\\  FR5-ALAVANCA.MPC — razão fixa 5, uma alavanca
\\  Autora: M. Silva      Revisão: 2025-03-14
\\  Caixa: ENV-007 padrão, alavanca esquerda + dispensador
\\ ============================================================

\\ ---- Portas -------------------------------------------------
^ALAVANCA   = 1        \\ entrada
^COMEDOURO  = 2        \\ entrada
^PELOTA     = 1        \\ saída
^LUZ_CASA   = 3        \\ saída

\\ ---- Parâmetros ---------------------------------------------
^RAZAO           = 5   \\ respostas por reforço
^DUR_SESSAO_MIN  = 60
^PULSO_PELOTA    = 0.05

\\ ---- Memória ------------------------------------------------
DIM B = 19
\\ B(0)  = pronto (teste de caixa passou)
\\ B(1)  = tempo de sessão, em centésimos
\\ B(5)  = respostas na alavanca
\\ B(6)  = reforços entregues

VAR_ALIAS
  Respostas = A
  Contadores = B
END

DISKVARS = A, B`,
      },
      {
        kind: 'texto',
        texto:
          'Sobre o cabeçalho: a data e o nome de quem revisou parecem burocracia até o dia em que ' +
          'existem três arquivos parecidos na pasta e ninguém sabe qual rodou no experimento ' +
          'publicado. **A pasta não é controle de versão** — `FR5_v2_FINAL_agora_vai.MPC` não conta a ' +
          'história; duas linhas de comentário contam.',
      },
      {
        kind: 'nota',
        texto:
          'O RatFlow preserva comentários, espaçamento e ordem exatamente como estão — inclusive as ' +
          'linhas de separador. Organizar o preâmbulo à mão não é trabalho perdido: ele volta a ser ' +
          'gravado igual depois de qualquer edição no canvas.',
      },
    ],
  },

  {
    id: 'comentarios',
    icone: '💬',
    titulo: 'Comentários que valem a linha',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O comentário do MedState é uma barra invertida até o fim da linha — não existe bloco. ' +
          'Como cada um custa uma linha inteira, vale escolher: comente **decisão**, não mecânica.',
      },
      {
        kind: 'codigo',
        texto: `\\ ruim — repete o que o código já diz
ADD B(5)                     \\ soma 1 em B(5)

\\ bom — diz o que a linha significa no experimento
ADD B(5)                     \\ conta a resposta; B(5) sai no DISKVARS

\\ melhor ainda — o "por quê" que ninguém adivinha
0.05": OFF ^PELOTA ---> S2   \\ 50 ms: abaixo disso o dispensador falha`,
      },
      {
        kind: 'lista',
        itens: [
          '**Um cabeçalho por processo**, dizendo em uma linha o que aquele processo faz. É o índice do arquivo.',
          '**Uma linha por casa de array**, logo abaixo do `DIM`. Sem isso, `B(17)` é indecifrável.',
          '**Todo valor que veio de fora do programa** — protocolo publicado, limite do equipamento, decisão do orientador — leva a origem no comentário.',
          '**Toda gambiarra deliberada** leva o motivo. A que não tem motivo escrito vira, na leitura seguinte, um bug que alguém "conserta".',
        ],
      },
      {
        kind: 'texto',
        texto:
          'O separador visual entre processos custa uma linha e faz mais pela leitura de um arquivo ' +
          'de 300 linhas do que qualquer outra coisa desta página:',
      },
      {
        kind: 'codigo',
        texto: `\\ =============================================================
\\  S.S.2 — registro: conta respostas e carimba eventos
\\ =============================================================
S.S.2,
S1,
  #START: ---> S2`,
      },
      {
        kind: 'nota',
        texto:
          'Comentário mentiroso é pior que comentário nenhum. Ao mudar uma regra, releia o comentário ' +
          'de cima — é o que fica desatualizado primeiro, e é nele que a próxima pessoa vai confiar.',
      },
    ],
  },

  {
    id: 'processos',
    icone: '🧵',
    titulo: 'Como dividir em processos',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Processo (`S.S.n,`) é a unidade de organização do MedState — o mais próximo que a ' +
          'linguagem tem de uma função. A regra é uma só: **um processo, um assunto.**',
      },
      {
        kind: 'tabela',
        cabecalho: ['Processo', 'Assunto', 'Por que separado'],
        linhas: [
          ['`S.S.1`', 'Teste de caixa', 'Roda antes da sessão e depois nunca mais. Não tem por que estar no meio da tarefa.'],
          ['`S.S.2`', 'A tarefa', 'A máquina de estados do experimento. É a parte que muda entre protocolos.'],
          ['`S.S.3`', 'Registro', 'Contar e carimbar eventos não é decidir o que acontece. Separado, dá para mudar o que se grava sem tocar na tarefa.'],
          ['`S.S.12`', 'Relógio de sessão', 'Conta o tempo e encerra. Um processo de cinco linhas que serve a todos os outros.'],
        ],
      },
      {
        kind: 'lista',
        itens: [
          '**Numeração com folga.** Deixar o relógio em `S.S.12` e a tarefa em `S.S.2` deixa espaço para intercalar um processo novo sem renumerar o arquivo.',
          '**Um dono por variável.** Só o processo de registro escreve em `B(5)`; os outros leem. Dois processos escrevendo a mesma casa no mesmo tique dão um resultado que depende da ordem.',
          '**Conversa por bandeira, não por espionagem.** Um processo não consulta em que estado o outro está; ele lê uma variável que o outro mantém (o padrão do porteiro, na página da linguagem).',
          '**Estado que só espera merece existir.** Separar "entregando" de "esperando o fim da entrega" em dois estados é mais claro — e é a única forma de medir um tempo exato.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Dentro do processo, a numeração dos estados também é convenção. `S1` como preparação ' +
          '(`#START:` zera contadores), o laço principal logo em seguida, e os estados de saída no ' +
          'fim é a ordem que a maioria dos arquivos reais segue — e, no canvas do RatFlow, é a que ' +
          'desenha o fluxo de cima para baixo.',
      },
      {
        kind: 'nota',
        texto:
          'Um processo com vinte estados quase sempre são dois processos. Se você precisa rolar a ' +
          'tela para achar o estado que a seta aponta, o custo já apareceu.',
      },
    ],
  },

  {
    id: 'regras',
    icone: '📏',
    titulo: 'Escrevendo uma regra legível',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Indentação e quebra de linha **não têm significado** para o MED-PC: uma regra pode ocupar ' +
          'uma linha ou dez. Como o compilador não se importa, o formato é inteiramente para o ' +
          'leitor — e é onde se ganha ou se perde a leitura de um `IF` aninhado.',
      },
      {
        kind: 'lista',
        itens: [
          '**Uma regra por linha** enquanto couber. Passou da largura da tela, quebre antes de um `;` e alinhe a continuação sob o primeiro comando.',
          '**Rótulos de `IF` indentados sob a regra**, um por linha, e os dois ramos alinhados entre si — é o recuo que mostra qual ramo pertence a qual decisão.',
          '**`IF` aninhado ganha mais um nível de recuo.** Se passar de dois níveis, considere um estado a mais em vez de um terceiro `IF`.',
          '**`---> SX` explícito** no fim da regra que fica no lugar. Omitir a seta faz a mesma coisa e esconde a intenção.',
          '**Comandos na ordem da história**: primeiro conta, depois testa, depois liga o que tem que ligar. A ordem de escrita é a ordem de execução.',
        ],
      },
      {
        kind: 'codigo',
        texto: `\\ ruim — corre certo, ninguém lê
S2,
  #R^ALAVANCA: ADD Respostas; IF Respostas >= ^RAZAO [@SIM, @NAO] @SIM: SET Respostas = 0 ---> S3 @NAO: ---> SX

\\ bom — a mesma regra, com o recuo mostrando a decisão
S2,
  30': ---> S9                         \\ limite de tempo do componente
  #R^ALAVANCA: ADD Respostas;
       IF Respostas >= ^RAZAO [@BATEU_A_META, @AINDA_NAO]
            @BATEU_A_META: SET Respostas = 0 ---> S3
            @AINDA_NAO:    ---> SX`,
      },
      {
        kind: 'texto',
        texto:
          'Dentro de um estado, uma ordem de leitura que ajuda: **primeiro a ação de entrada** ' +
          '(`.01":`), **depois os limites de tempo** (`30":`, `30\':`), **depois as respostas** ' +
          '(`#R^…`). O MED-PC verifica todos os gatilhos do estado de qualquer jeito; quem lê, não.',
      },
      {
        kind: 'nota',
        texto:
          'O RatFlow reescreve apenas a regra que você editou, preservando o resto do arquivo byte a ' +
          'byte. Isso significa que o recuo que você escolher **fica** — e também que um arquivo mal ' +
          'formatado não se conserta sozinho por passar pelo editor.',
      },
    ],
  },

  {
    id: 'parametros',
    icone: '🎛️',
    titulo: 'Parâmetros e variantes do protocolo',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A mudança mais comum num programa de laboratório é a menor: FR 5 vira FR 10, o ITI passa ' +
          'de 20 s para 30 s, a sessão encurta. Se essas três mudanças forem edições de uma linha ' +
          'cada, o arquivo aguenta anos. Se forem caçadas de número no corpo, cada variante vira uma ' +
          'cópia — e as cópias divergem.',
      },
      {
        kind: 'codigo',
        texto: `\\ ---- Parâmetros da sessão -----------------------------------
^RAZAO           = 5    \\ respostas por reforço
^ITI_SEG         = 20   \\ intervalo entre tentativas
^DUR_SESSAO_MIN  = 60   \\ encerra por tempo
^MAX_REFORCOS    = 60   \\ encerra por reforços — o que vier primeiro`,
      },
      {
        kind: 'lista',
        itens: [
          '**Constante nomeada mesmo para o valor usado uma vez só.** O nome é o comentário que não desatualiza.',
          '**A unidade no nome** quando ela não estiver no símbolo: `^ITI_SEG = 20` com `^ITI_SEG":` na regra não deixa dúvida sobre segundos ou centésimos.',
          '**Critério de parada explícito, e todos eles.** Tempo e número de reforços costumam coexistir; deixe os dois nomeados no topo.',
          '**Uma `LIST` para o que é sorteado**, em vez de valores espalhados: mudar a distribuição vira editar uma linha.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Quando a variante muda a **estrutura** — não o valor —, aí sim vale um arquivo novo. O ' +
          'sinal é claro: se para mudar de grupo você precisa comentar e descomentar regras, o ' +
          'programa está fazendo duas coisas e já devia ser dois arquivos com o mesmo preâmbulo.',
      },
      {
        kind: 'nota',
        texto:
          'Regra comentada não é documentação: é código morto que alguém vai descomentar por engano. ' +
          'Se a variante importa, ela é um arquivo; se não importa mais, apague.',
      },
    ],
  },

  {
    id: 'dados',
    icone: '💾',
    titulo: 'Deixar os dados prontos para analisar',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A parte do programa que ninguém revisa é a que decide se os dados servem. O arquivo de ' +
          'saída é escrito uma vez, ao fim da sessão — o que não foi contado, não existe, e a sessão ' +
          'não se repete.',
      },
      {
        kind: 'lista',
        itens: [
          '**`DISKVARS` conferido contra a análise**, não contra a intenção. A pergunta é: com este arquivo de dados, dá para calcular o que o artigo vai relatar?',
          '**Carimbo de tempo em tudo que for evento.** Contagem total responde "quantos"; só o carimbo responde "quando" e "em que ordem" — e é o carimbo que salva a análise que ninguém tinha planejado.',
          '**Um código por tipo de evento**, documentado em comentário junto do array de log. O padrão de laboratório é o tempo na parte inteira e o código na decimal.',
          '**`SHOW` para o que o experimentador olha durante a sessão**, com nome curto e legível — é a única janela sobre o que está acontecendo enquanto roda.',
          '**Contadores zerados no `#START:`**, mesmo que a linguagem já comece em zero. Deixa a intenção escrita e sobrevive a um `#START` que roda duas vezes.',
        ],
      },
      {
        kind: 'codigo',
        texto: `DIM D = 5000
\\ D(n) = evento: parte inteira = tempo em centésimos, decimal = código
\\   .11 = resposta na alavanca      .21 = reforço entregue
\\   .31 = entrada no comedouro      .99 = fim de sessão
\\ B(17) = índice do próximo evento livre em D

S2,
  #R^ALAVANCA: SET D(B(17)) = B(1) + .11;
       ADD B(17); ADD B(5);
       SHOW 3, RESPOSTAS, B(5) ---> SX`,
      },
      {
        kind: 'nota',
        texto:
          'Dimensione o array de log para a **pior** sessão, não para a média, e verifique o índice ' +
          'antes de gravar. Um `D` que estoura no meio de uma sessão longa perde exatamente a parte ' +
          'mais interessante dela.',
      },
    ],
  },

  {
    id: 'revisao',
    icone: '✅',
    titulo: 'Antes de rodar com um sujeito',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Uma sessão perdida custa um animal, um dia e um horário de sala. Esta é a lista que pega ' +
          'quase tudo que se perde por descuido — vale mais como ritual de cinco minutos do que como ' +
          'leitura.',
      },
      {
        kind: 'passos',
        itens: [
          '**Compile.** Erro de sintaxe aparece na tradução, não no meio do experimento.',
          '**Simule.** Rode o programa no simulador do RatFlow e dispare as respostas: o fluxo passa pelos estados que você esperava, na ordem que você esperava?',
          '**Cace o `ON` sem `OFF`.** Cada saída ligada precisa desligar em **todos** os caminhos que saem dali, inclusive no de encerramento.',
          '**Confira `SX` contra `Sn` em cada estado com temporizador.** É a diferença entre "30 s no total" e "30 s sem responder", e são dois caracteres.',
          '**Confira o `DISKVARS`** contra a lista de variáveis que a análise usa.',
          '**Verifique os critérios de parada** — tempo e reforços — e o que acontece quando o que vier primeiro chegar.',
          '**Rode o teste de caixa** na caixa de verdade: um cabo trocado não aparece em simulação nenhuma.',
          '**Faça uma sessão curta de mentira**, com a duração reduzida, e abra o arquivo de dados. Ele tem o que você precisa?',
        ],
      },
      {
        kind: 'texto',
        texto:
          'A ordem importa: os quatro primeiros itens são sobre o programa estar certo; os quatro ' +
          'últimos, sobre ele estar certo **para este experimento**. Um programa que compila, simula ' +
          'e grava o arquivo errado é um dia perdido do mesmo jeito.',
      },
      {
        kind: 'nota',
        texto:
          'Guarde junto do arquivo de dados uma cópia do `.MPC` que rodou. É a única forma de, meses ' +
          'depois, saber com que parâmetros aqueles números foram gerados.',
      },
    ],
  },
]
