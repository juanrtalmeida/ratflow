/**
 * Conteúdo do manual. Dados, não JSX — mesmo princípio de
 * `glossary-terms.ts`: quem escreve documentação não devia precisar mexer em
 * componente, e revisar o texto num arquivo só é bem mais fácil.
 *
 * Em qualquer texto, `entre backticks` vira código na tela. É a única marcação
 * — o resto é a estrutura dos blocos.
 */

export type ManualBloco =
  | { readonly kind: 'texto'; readonly texto: string }
  /** Lista numerada: uma sequência que se faz em ordem. */
  | { readonly kind: 'passos'; readonly itens: readonly string[] }
  /** Lista sem ordem: coisas que existem lado a lado. */
  | { readonly kind: 'lista'; readonly itens: readonly string[] }
  | {
      readonly kind: 'tabela'
      readonly cabecalho: readonly string[]
      readonly linhas: readonly (readonly string[])[]
    }
  /** Bloco de código `.MPC`, em fonte monoespaçada e preservando as quebras. */
  | { readonly kind: 'codigo'; readonly texto: string }
  /** Destaque para um limite real do sistema — nunca para vender uma feature. */
  | { readonly kind: 'nota'; readonly texto: string }

export interface ManualSecao {
  readonly id: string
  /** Opcional: o glossário é uma lista de termos, e um mesmo ícone repetido 13 vezes só faz ruído. */
  readonly icone?: string
  readonly titulo: string
  readonly blocos: readonly ManualBloco[]
}

export const MANUAL: readonly ManualSecao[] = [
  {
    id: 'ideia',
    icone: '🧭',
    titulo: 'A ideia central',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O RatFlow é um editor visual para programas MedState Notation (`.MPC`) do MED-PC. ' +
          'Você monta o protocolo arrastando e ligando nós, em vocabulário de laboratório, e o ' +
          'arquivo `.MPC` sai pronto para rodar no equipamento.',
      },
      {
        kind: 'texto',
        texto:
          '**O arquivo é a fonte da verdade.** O canvas é uma projeção do texto, e cada gesto seu ' +
          'vira uma edição cirúrgica nele — comentários, espaçamento e ordem originais são ' +
          'preservados. Um arquivo escrito por outra pessoa abre e volta a fechar sem ser ' +
          'estragado, byte a byte.',
      },
      {
        kind: 'texto',
        texto:
          'Não existe banco de dados à parte. Nomes amigáveis, papéis e posições dos nós são ' +
          'gravados no próprio `.MPC`, em idiomas nativos do MedState (`^Constante`, `VAR_ALIAS`) e ' +
          'em comentários que o MED-PC ignora. O arquivo continua legível no Bloco de Notas.',
      },
      {
        kind: 'texto',
        texto:
          'Tudo roda no navegador, offline, sem servidor. O que está na tela é salvo ' +
          'automaticamente no navegador; ir para o disco é sempre uma ação sua.',
      },
    ],
  },

  {
    id: 'documentacao',
    icone: '📚',
    titulo: 'Onde está a documentação',
    blocos: [
      {
        kind: 'texto',
        texto: 'São três páginas, todas no menu ☰ → Ajuda, e todas com URL própria:',
      },
      {
        kind: 'tabela',
        cabecalho: ['Página', 'Responde'],
        linhas: [
          [
            '**Manual** (esta)',
            'Onde clicar. O que cada painel faz, o que o editor sabe escrever, quais os limites conhecidos.',
          ],
          [
            '**A linguagem MED-PC**',
            'O que o equipamento executa. Como um programa MedState roda, a sintaxe com exemplo de cada uso, os padrões dos arquivos de laboratório e as armadilhas comuns.',
          ],
          [
            '**Glossário**',
            'O que uma palavra quer dizer. Os termos de laboratório e de MedState em uma ou duas frases. São os mesmos textos do balãozinho "?" que aparece pelas telas do app.',
          ],
        ],
      },
      {
        kind: 'texto',
        texto:
          'As três abrem por cima do editor, sem desmontá-lo: voltar (`Esc` ou "← Voltar ao editor") ' +
          'devolve a tela exatamente como estava, sem perder edição nenhuma.',
      },
    ],
  },

  {
    id: 'arquivo',
    icone: '📁',
    titulo: 'Arquivo: começar, abrir, salvar',
    blocos: [
      {
        kind: 'texto',
        texto: 'Tudo isso está no menu ☰, no canto esquerdo da barra do topo.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Ação', 'O que faz'],
        linhas: [
          ['Novo', 'Esvazia a tela para começar do zero.'],
          ['Abrir', 'Escolhe um `.MPC` do disco.'],
          ['Salvar', 'Grava no mesmo arquivo que você abriu.'],
          ['Salvar como', 'Escolhe um arquivo novo.'],
          ['Modelos', 'Nove protocolos prontos (FR, VR, VI, VT, PR, DRL, extinção, autoshaping, concorrente).'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Um **modelo** substitui o documento inteiro e já vem com nomes, papéis e posições — é o ' +
          'caminho mais rápido para ver o sistema funcionando. Você escolhe os números (razão, ' +
          'intervalo, duração da sessão) antes de gerar.',
      },
      {
        kind: 'texto',
        texto:
          'O **autosave** guarda a sessão no navegador poucos segundos depois de cada mudança, ' +
          'então fechar a aba não perde trabalho. Ele não escreve no seu arquivo do disco: para ' +
          'isso é Salvar.',
      },
      {
        kind: 'nota',
        texto:
          'Em navegadores sem a API de acesso a arquivos, Salvar baixa o arquivo pela pasta de ' +
          'downloads em vez de reescrever o original.',
      },
    ],
  },

  {
    id: 'protocolo',
    icone: '🗺',
    titulo: 'Mapa do protocolo (nível 1)',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A primeira tela do canvas é o protocolo: **cada nó é um estado** (`Sn`) e **cada seta é ' +
          'uma transição**. É a visão de "por onde a sessão passa".',
      },
      {
        kind: 'tabela',
        cabecalho: ['Gesto', 'Resultado'],
        linhas: [
          ['Arrastar um nó', 'Move o estado e grava a posição no arquivo (`\\@pos:`).'],
          ['Duplo clique no vazio', 'Cria um estado ali.'],
          ['Arrastar um bloco da paleta', 'Cria um estado com o papel escolhido.'],
          ['Soltar um bloco **sobre uma seta**', 'Insere o estado no meio daquela transição, já ligado dos dois lados.'],
          ['Puxar da bolinha direita até outro nó', 'Cria uma transição nova.'],
          ['Arrastar a ponta de uma seta', 'Religa a transição para outro destino.'],
          ['Duplo clique num nó', 'Abre a lógica daquele estado (nível 2).'],
          ['Clique simples num nó', 'Revela o trecho correspondente no editor de código.'],
          ['✏️ no card', 'Renomeia o estado.'],
          ['🗑 no card, ou Delete', 'Exclui o estado.'],
          ['Delete numa seta', 'Apaga a regra daquela transição.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Uma transição nova nasce com gatilho de tempo (`5"`), porque é o único que sempre ' +
          'funciona sem depender de hardware declarado. A seta aparece rotulada "depois de 5 ' +
          'segundos" — abra o estado para trocar o gatilho pelo que você quer de verdade.',
      },
      {
        kind: 'texto',
        texto:
          'O **selo colorido** no canto do card é um diagnóstico: ⛔ erro, ⚠ aviso, ℹ observação. ' +
          'Passe o mouse no editor de código para ler o problema em palavras.',
      },
      {
        kind: 'nota',
        texto:
          'Excluir um estado **não** corrige as setas que apontavam para ele: elas ficam ' +
          'sinalizadas como problema, para você decidir. O editor não reescreve sozinho partes do ' +
          'programa que você não pediu.',
      },
    ],
  },

  {
    id: 'logica',
    icone: '🔀',
    titulo: 'Lógica de um estado (nível 2)',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Duplo clique num estado abre o grafo da lógica dele. Cada **regra** (uma linha de ' +
          'transição do MedState) é uma faixa horizontal, com quatro tipos de bloco:',
      },
      {
        kind: 'lista',
        itens: [
          '**Gatilho** (o "quando"): a sessão começar, o sujeito responder, passar um tempo, chegar um sinal.',
          '**Ação**: ligar/desligar dispositivo, ligar por um tempo, somar/subtrair/definir contador, registrar no painel, avisar outro processo.',
          '**Decisão** (`Se…`): compara dois valores e separa o caminho em sim e não.',
          '**Destino**: ir para outro estado, ou ficar onde está.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Os fios carregam **fluxo**, nunca valores: um fio significa sempre "depois disto, ' +
          'aquilo". Dispositivos, contadores e números são escolhidos dentro do bloco, em listas ' +
          'suspensas — é o que mantém o desenho legível.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Gesto', 'Resultado'],
        linhas: [
          ['Arrastar um bloco da paleta para o vazio', 'O bloco entra solto, esperando ser ligado.'],
          ['Soltar **sobre um fio**', 'Encaixa no meio da corrente: o que vinha depois passa a vir depois dele.'],
          ['Arrastar um gatilho para o vazio', 'Começa uma regra nova.'],
          ['Puxar de uma bolinha a outra', 'Liga os dois blocos.'],
          ['Delete num bloco', 'Remove o bloco e religa o antecessor ao sucessor.'],
          ['Delete no gatilho', 'Apaga a regra inteira (com confirmação).'],
          ['Delete num fio', 'Corta a ligação.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          '**Enquanto a regra não fecha, ela fica só na tela.** Um bloco com campo vazio, ou solto ' +
          'sem ligação, não tem como ser escrito em MedState — então ele aparece com borda ' +
          'tracejada e ⚠, e o painel da direita mostra em "Falta terminar" o que resolver. No ' +
          'instante em que a regra fica válida, ela vai para o arquivo sozinha.',
      },
      {
        kind: 'nota',
        texto:
          'A posição dos blocos do nível 2 não é salva: o fluxograma se organiza sozinho. Um bloco ' +
          'recém-solto fica onde você o deixou enquanto a regra está incompleta e assume a sua ' +
          'coluna quando ela fecha.',
      },
    ],
  },

  {
    id: 'paleta',
    icone: '🧱',
    titulo: 'A paleta de blocos',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A coluna da esquerda muda com o nível: no protocolo ela oferece **estados** (neutro, ' +
          'espera, reforço, intervalo, fim); dentro de um estado, oferece **gatilhos, ações e ' +
          'caminho**. O botão ◂ no topo dela recolhe tudo para o canvas ficar limpo; ▸ traz de volta.',
      },
      {
        kind: 'texto',
        texto:
          'O **papel** de um estado (espera, reforço, intervalo, fim) é só cor e ícone no canvas — ' +
          'não muda o comportamento do programa. Serve para ler o protocolo de longe.',
      },
    ],
  },

  {
    id: 'caixa',
    icone: '🔌',
    titulo: 'Sua caixa: dispositivos e contadores',
    blocos: [
      {
        kind: 'texto',
        texto:
          'No pé da paleta, "Sua caixa" mostra o que o arquivo revela sobre o equipamento e sobre ' +
          'as variáveis. Nada disso é um cadastro à parte: é tudo lido do `.MPC`.',
      },
      {
        kind: 'texto',
        texto:
          '**Dispositivos** são constantes de porta (`^Pelota = 1`). O tipo é descoberto pelo uso: ' +
          'uma constante que aparece em `#R^X` é entrada; em `ON ^X`, é saída. Para declarar um ' +
          'dispositivo novo, escolha o tipo, o nome e a porta e clique em adicionar — isso escreve ' +
          '`^Nome = porta` no preâmbulo.',
      },
      {
        kind: 'texto',
        texto:
          '**Contadores** são detectados de duas formas. `VAR_ALIAS` nomeia uma variável inteira ' +
          '(`Respostas = A`). Para uma posição de array, que o `VAR_ALIAS` não aceita, o nome vem ' +
          'do comentário de documentação — a convenção que os programas de laboratório já usam:',
      },
      {
        kind: 'codigo',
        texto: 'DIM B = 19\n\n\\ B(5) = LEFTLEVER RESPONSES\n\\ B(9) = REINFORCERS LEFT',
      },
      {
        kind: 'texto',
        texto:
          'Esses nomes aparecem nas listas de contador dos blocos, nas frases que descrevem as ' +
          'regras e na folha de protocolo. São de leitura apenas: o editor não reescreve o ' +
          'comentário do autor.',
      },
    ],
  },

  {
    id: 'processos',
    icone: '⚡',
    titulo: 'Processos paralelos e sinais',
    blocos: [
      {
        kind: 'texto',
        texto:
          'Um `.MPC` pode ter vários processos (`S.S.1`, `S.S.2`…) que rodam **ao mesmo tempo** — ' +
          'tipicamente um para a tarefa e outro para cronometrar a sessão. O seletor na barra do ' +
          'topo troca de processo; o `+` ao lado cria um novo, já com `S1` e `#START`.',
      },
      {
        kind: 'texto',
        texto:
          'Processos conversam por **sinal Z**: um emite (`Z1`), os outros que esperam por aquele ' +
          'número (`#Z1`) disparam juntos — é um aviso para todos, não uma seta de um para outro. ' +
          'O resumo fica no pé da paleta, e cada nome ali é um atalho para aquele processo.',
      },
    ],
  },

  {
    id: 'codigo',
    icone: '</>',
    titulo: 'Editor de código',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O botão `código` na barra do topo abre o `.MPC` como texto, editável. Canvas e código ' +
          'são a mesma coisa vista de dois jeitos:',
      },
      {
        kind: 'lista',
        itens: [
          'Mexer no canvas muda o texto na hora; digitar no texto redesenha o canvas.',
          'O **desfazer é um só** para os dois: um arrasto no canvas e uma tecla no código entram na mesma pilha.',
          'Clicar num nó ou numa regra marca o trecho no código — sem abrir o painel. Quando você abrir o `código`, ele já vem selecionado e rolado até ali.',
          'Mover o cursor no código destaca o estado e a regra correspondentes no canvas.',
        ],
      },
      {
        kind: 'texto',
        texto:
          'O **linter** roda pouco depois de você parar de digitar e sublinha o problema, com o ' +
          'motivo em português e uma sugestão. São as mesmas verificações que pintam os selos do ' +
          'canvas — uma lista de problemas, duas telas.',
      },
      {
        kind: 'texto',
        texto:
          'Passar o mouse sobre um comando ou símbolo (`ADD`, `IF`, `SX`, `#R`, `--->`, `"`) explica ' +
          'o que ele faz.',
      },
      {
        kind: 'texto',
        texto: 'O **autocomplete** muda com o lugar do cursor:',
      },
      {
        kind: 'tabela',
        cabecalho: ['Onde você está', 'O que ele oferece'],
        linhas: [
          ['Depois de `^`', 'As constantes que o arquivo já tem.'],
          ['Depois de `@`', 'Os rótulos de decisão do arquivo.'],
          ['Depois de `--->`', 'Os estados existentes, e `SX` (ficar aqui).'],
          ['Palavra no meio de uma linha', 'Comandos do MedState, com explicação, e os atalhos de anotação (`defname`, `defpapel`, `defpos`).'],
          ['Começo de uma linha', 'Os atalhos `def…`, as estruturas prontas (processo, estado, `VAR_ALIAS`), regras completas e os comandos.'],
          ['`#` no começo de uma linha', 'Regras prontas com gatilho, e os gatilhos sozinhos.'],
          ['Dentro de um comentário', 'As anotações do editor: `\\@nome:`, `\\@papel:`, `\\@pos:`.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Nos **snippets**, `Tab` salta entre os campos a preencher e `Shift-Tab` volta. Campos ' +
          'com o mesmo nome andam juntos: no snippet de decisão, renomear `@Sim` no `IF` renomeia ' +
          'o segmento correspondente no mesmo gesto.',
      },
      {
        kind: 'texto',
        texto:
          '**Os atalhos `def…`.** Digitar `def` numa linha abre a lista inteira do que o editor sabe ' +
          'escrever — é o caminho para quem não tem a sintaxe do MedState na cabeça. Cada um escreve ' +
          'o trecho já com os campos marcados; `Tab` anda entre eles.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Atalho', 'Escreve'],
        linhas: [
          ['`defstate`', 'Cabeçalho de estado com nome e papel: `Sn, \\@nome: … \\@papel: …`'],
          ['`defname`', 'Só a anotação de nome: `\\@nome: …` — cabe no fim de um cabeçalho já escrito.'],
          ['`defpapel`', 'Só a anotação de papel: `\\@papel: …` (`espera`, `reforco`, `timeout`, `fim`).'],
          ['`defpos`', 'Só a posição no canvas: `\\@pos: x,y`.'],
          ['`defprocess`', 'Um processo novo (`S.S.n`) com o primeiro estado e o `#START`.'],
          ['`defalias`', 'O bloco `VAR_ALIAS … END`.'],
          ['`defconst`', 'Uma constante: `^Nome = valor`.'],
          ['`defdim`', 'Um array: `DIM B = 19`.'],
          ['`deflist`', 'Uma `LIST` de valores para sortear.'],
          ['`defdisk`', 'A diretiva `DISKVARS`.'],
          ['`defstart`', 'A regra `#START:` que zera contadores e segue.'],
          ['`defresp`', 'Contar uma resposta: `#R^Porta: ADD A ---> SX`.'],
          ['`deftimer`', 'Esperar e sair: `N": ---> Sn`.'],
          ['`defif`', 'Uma decisão com os dois ramos já escritos.'],
          ['`defsignal` / `defsend`', 'Receber (`#Zn:`) e emitir (`Zn`) um sinal entre processos.'],
          ['`defshow`', 'Mostrar um valor no painel: `SHOW posição, rótulo, valor`.'],
          ['`defrand`', 'Sortear de uma lista: `RANDD C = Intervalos`.'],
          ['`defpulse`', 'O par de estados que liga e desliga um dispositivo por um tempo exato.'],
          ['`defcount`', 'O contador de razão fixa: conta, testa a meta, zera.'],
          ['`defiti`', 'O intervalo entre tentativas: apaga a luz, espera, acende.'],
          ['`defclock`', 'O processo do relógio da sessão, com critério de parada.'],
          ['`defbox`', 'O processo de teste de caixa, que confere a fiação antes da sessão.'],
        ],
      },
      {
        kind: 'nota',
        texto:
          'Os atalhos são só a porta de entrada: o que cada um escreve, e por que se escreve assim, ' +
          'está explicado em **A linguagem MED-PC** (☰ → Ajuda), na seção **Padrões da linguagem**.',
      },
    ],
  },

  {
    id: 'simulador',
    icone: '▶',
    titulo: 'Simulador e caixa virtual',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O botão `simular` roda o protocolo de verdade, interpretando o programa. A **caixa ' +
          'virtual** desenha os dispositivos do arquivo: os de entrada são botões (clicar é o ' +
          'sujeito respondendo), os de saída acendem quando o programa os liga.',
      },
      {
        kind: 'tabela',
        cabecalho: ['Controle', 'Para que serve'],
        linhas: [
          ['▶ Rodar / ⏸ Pausar', 'Toca e para o tempo.'],
          ['Passo', 'Avança um instante só, com a simulação parada.'],
          ['↺ Reiniciar', 'Volta ao começo da sessão.'],
          ['1× / 10× / 40×', 'Velocidade do relógio.'],
          ['sujeito virtual', 'Um "rato" automático responde sozinho, ~15 respostas por minuto em cada entrada.'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Com o simulador aberto, o estado ativo **pulsa no canvas** — dá para ver o programa ' +
          'andando pelo mapa.',
      },
      {
        kind: 'nota',
        texto:
          'O simulador é uma aproximação para depurar lógica, não um emulador fiel de tempo. Serve ' +
          'para descobrir que uma transição nunca dispara ou que um contador não zera — não para ' +
          'validar precisão de milissegundos.',
      },
    ],
  },

  {
    id: 'documentar',
    icone: '📋',
    titulo: 'Folha de protocolo e exportação',
    blocos: [
      {
        kind: 'texto',
        texto:
          'A **folha de protocolo** (menu ☰) monta, a partir do arquivo, um documento para a seção ' +
          'de Métodos: tabela de dispositivos, de contadores e variáveis, de parâmetros, e cada ' +
          'regra de cada estado descrita em português. O botão imprimir salva em PDF.',
      },
      {
        kind: 'texto',
        texto:
          'No mapa do protocolo, o menu ☰ também exporta o canvas como **PNG** ou **SVG**, para ' +
          'colar num artigo ou numa apresentação.',
      },
      {
        kind: 'texto',
        texto:
          'Nada disso é uma segunda fonte de verdade: é sempre uma leitura do `.MPC` atual, então ' +
          'não tem como desatualizar.',
      },
    ],
  },

  {
    id: 'anotacoes',
    icone: '🏷',
    titulo: 'As anotações no arquivo',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O editor guarda o que precisa dentro do próprio `.MPC`, como comentário — invisível ' +
          'para o MED-PC, legível para humanos:',
      },
      {
        kind: 'tabela',
        cabecalho: ['Anotação', 'Significa'],
        linhas: [
          ['`\\@nome: Esperando resposta`', 'Nome amigável do estado ou do processo.'],
          ['`\\@papel: espera`', 'Papel do estado: cor e ícone no canvas (`espera`, `reforco`, `timeout`, `fim`).'],
          ['`\\@pos: 120,340`', 'Posição do nó no mapa.'],
          ['`\\@macro: pulso ^Pelota 0.05`', 'Marca um estado que o editor criou para desligar um pulso.'],
          ['`\\ B(5) = RESPOSTAS`', 'Nome de uma posição de array (convenção dos arquivos de laboratório).'],
        ],
      },
      {
        kind: 'texto',
        texto:
          'Um arquivo sem nenhuma anotação abre normalmente: os nomes caem para `S1`, `S2`… e as ' +
          'posições para o layout automático. Você pode escrever essas anotações à mão no editor ' +
          'de código — o autocomplete as oferece dentro de qualquer comentário.',
      },
      {
        kind: 'texto',
        texto:
          '"Ligar por um tempo" merece uma nota: o MedState não tem esse comando. O editor escreve ' +
          'o `ON` na regra e cria um **estado auxiliar** que espera a duração, faz o `OFF` e segue ' +
          'para onde a regra ia. É por isso que aparece um estado a mais no mapa, marcado com ' +
          '`\\@macro:`.',
      },
    ],
  },

  {
    id: 'atalhos',
    icone: '⌨',
    titulo: 'Atalhos',
    blocos: [
      {
        kind: 'tabela',
        cabecalho: ['Atalho', 'Onde', 'O que faz'],
        linhas: [
          ['`Ctrl`+`Z` / `Ctrl`+`Shift`+`Z`', 'em todo o app', 'Desfazer e refazer, canvas e código juntos.'],
          ['`Delete` ou `Backspace`', 'canvas', 'Apaga o nó ou a seta selecionada.'],
          ['duplo clique', 'canvas', 'No vazio, cria estado; num nó, abre a lógica dele.'],
          ['`Ctrl`+`Espaço`', 'editor de código', 'Abre o autocomplete e os snippets.'],
          ['`Tab` / `Shift`+`Tab`', 'num snippet', 'Anda entre os campos a preencher.'],
          ['`Esc`', 'editor de código', 'Fecha o autocomplete ou solta os campos do snippet.'],
          ['`Ctrl`+`F`', 'editor de código', 'Busca no texto.'],
          ['`Esc`', 'nesta página', 'Volta ao editor (o botão voltar do navegador também).'],
        ],
      },
      {
        kind: 'nota',
        texto: 'No macOS, `Cmd` no lugar de `Ctrl`.',
      },
    ],
  },

  {
    id: 'limites',
    icone: '🧩',
    titulo: 'Limites conhecidos',
    blocos: [
      {
        kind: 'texto',
        texto:
          'O editor prefere ser honesto a adivinhar. Quando ele não sabe modelar algo, mostra o ' +
          'código original num bloco **"avançado"** em vez de interpretar errado — o trecho ' +
          'continua no arquivo, intacto, e você pode editá-lo no código. Cai nesse caminho:',
      },
      {
        kind: 'lista',
        itens: [
          'Sorteio de listas (`RANDD`, `RANDI`) e o uso de `LIST` como distribuição.',
          'Combinações lógicas de eventos (`#R1 ! #R2`).',
          'Um comando com vários alvos de uma vez (`SET A = 0, B = 1`, `ON ^A, ^B`).',
          'Contas em índice ou valor (`A(I+1)`, `B(1)/6000`) — o texto é preservado como está.',
          'Fins de programa especiais (`STOP`, `ABORT`, `FLUSH`, `KILL` e combinações): viram um bloco de destino avançado, nunca confundido com "ficar aqui".',
        ],
      },
      {
        kind: 'texto',
        texto:
          'Duas situações comuns em arquivos reais fazem a **regra inteira** virar avançada, e o ' +
          'linter aponta as duas: um `IF` que cita um rótulo que não existe (quase sempre erro de ' +
          'digitação, como `@DURRING…` em vez de `@DURING…`), e um `;` no lugar da `,` entre os ' +
          'dois rótulos (`[@COMP4; @COMP5]`). Corrigindo o arquivo, a regra volta a abrir em blocos.',
      },
      {
        kind: 'texto',
        texto: 'Outras coisas que ainda não têm caminho pelo canvas:',
      },
      {
        kind: 'lista',
        itens: [
          'Trocar o papel de um estado já criado, e renomear um processo: pelo editor de código (os snippets ajudam).',
          'Reordenar as regras de um estado, ou mover um estado de um processo para outro.',
          'Apagar um único ramo de um `Se…` pelo mapa — o ramo é editado dentro do estado.',
        ],
      },
      {
        kind: 'nota',
        texto:
          'O dialeto usado nas verificações é o do MED-PC V. Diretivas exclusivas dele ' +
          '(`DISKCOLUMNS`, `DISKFORMAT`) são aceitas; num arquivo de MED-PC IV, elas apareceriam ' +
          'como erro.',
      },
    ],
  },
]
