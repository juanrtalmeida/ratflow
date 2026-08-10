# MedState Notation — gramática implementada

Este documento é a especificação do parser em `src/core/`. Ele descreve **o que o parser reconhece
hoje**, não a totalidade da linguagem MedState. Itens marcados com ⚠ são hipóteses a confirmar
contra as fixtures reais em `fixtures/` e o manual do MED-PC.

## Princípio de projeto: reconhecer sem exigir

O parser é **lossless e permissivo**. Toda a fonte é coberta por spans; nada é descartado. O que ele
não sabe interpretar não vira erro — vira um nó cru (`raw`) que preserva o texto exato e volta a ser
escrito idêntico. Isso é o que permite:

- abrir `.MPC` de terceiros sem estragá-los;
- crescer o reconhecimento aos poucos, conforme as fixtures revelam construções novas;
- alimentar o "nó avançado" do canvas, que exibe código cru quando o catálogo ainda não modela algo.

Consequência prática: **toda construção tem duas camadas** — `raw: string` (sempre presente, sempre
fiel) e `parsed: … | null` (presente só quando reconhecida).

---

## 1. Léxico

| Token | Forma | Observações |
| --- | --- | --- |
| `Comment` | `\` até o fim da linha | Não há comentário de bloco |
| `Newline` | `\n`, `\r\n` | O `\r` fica dentro do token, para preservar CRLF |
| `Whitespace` | espaços e tabs | Preservado como trivia |
| `Ident` | `[A-Za-z_][A-Za-z0-9_]*` | Case-insensitive nas palavras-chave |
| `Number` | `[0-9]+(\.[0-9]+)?` | Sem notação científica ⚠ |
| `Caret` | `^` | Prefixo de constante |
| `Hash` | `#` | Prefixo de evento |
| `At` | `@` | Prefixo de rótulo |
| `Arrow` | `-->`…`--->` (2+ hifens e `>`) | Aceita variações de largura |
| `Quote` | `"` | Sufixo de tempo em segundos |
| `Apostrophe` | `'` | Sufixo de tempo em minutos |
| Pontuação | `: ; , = ( ) [ ] . + - * / < > !` | |

`S.S.1` não é um token único: sai como `Ident(S) . Ident(S) . Number(1)`. O reconhecimento acontece
na camada estrutural, que é orientada a linha.

## 2. Estrutura do arquivo

```
Program   := PreambleItem*  StateSet*
StateSet  := "S.S." Number ","  State*
State     := "S" Number ","  Statement*
```

O corpo começa no primeiro cabeçalho `S.S.n,`; tudo antes é preâmbulo.

### 2.1 Itens de preâmbulo reconhecidos

| Construção | Forma | Nó |
| --- | --- | --- |
| Constante | `^Nome = valor` | `ConstantDef` |
| Dimensão | `DIM A = 1000` | `DimDecl` |
| Lista | `LIST L = 1, 2, 3` | `ListDecl` |
| Alias de variável | `VAR_ALIAS` … `END` ⚠ | `VarAliasBlock` |
| Diretivas de disco | `DISKVARS = A, B` , `DISKCOLUMNS`, `DISKFORMAT` | `DiskDirective` |
| Qualquer outra linha | — | `RawPreamble` (preservada) |

⚠ A delimitação do bloco `VAR_ALIAS` (se termina em `END`, em linha em branco ou no próximo
comando) precisa ser confirmada nas fixtures. Hoje o parser aceita as três: o bloco termina em `END`
ou na primeira linha que comece uma outra construção de preâmbulo ou um `S.S.`.

## 3. Statements (linhas de transição)

```
Statement := Trigger ":" Segment ( LabelSegment )*
Segment      := Command ( ";" Command )*  [ Arrow Target ]
LabelSegment := "@" Ident ":" Segment
Target       := "S" Number | "SX"
```

Um `Statement` é a unidade que o canvas de nível 2 chama de **regra**: um gatilho, uma árvore de
comandos e um ou mais destinos.

### 3.1 Agrupamento em linhas

MedState permite que um statement ocupe várias linhas físicas — arquivos reais de laboratório fazem
isso o tempo todo, quebrando uma lista de comandos no meio para caber na tela, sem repetir o
gatilho. Confirmado contra `fixtures/*-real.MPC`, a regra é:

> Dentro de um bloco de estado, uma linha **só** começa um statement novo se tiver um `:` fora de
> parênteses/colchetes (gatilho ou rótulo). **Qualquer outra linha significativa continua o
> statement anterior** — não só as que começam por `@`.

Isso é o oposto do que a primeira versão do parser assumia (que só `@` continuava). A diferença
importa: `ADD B(0); SHOW 1, READY, B(0)` numa linha própria, sem gatilho, é comum — e a versão antiga
gerava um erro de sintaxe falso (`statement-sem-gatilho`) para cada uma dessas linhas.

### 3.2 Gatilhos reconhecidos

| Forma | Significado | `parsed.kind` |
| --- | --- | --- |
| `#START` | início da sessão | `start` |
| `#R1`, `#R^Alavanca` | resposta na entrada | `response` |
| `#K1`, `#K^Nome` | evento de teclado/entrada K ⚠ | `response` (canal `K`) |
| `#Z1` … `#Z32` | sinal vindo de outro processo | `signal` |
| `5"`, `0.05"`, `^Tempo"` | tempo decorrido em segundos | `time` (unidade `s`) |
| `5'`, `^Tempo'` | tempo decorrido em minutos | `time` (unidade `min`) |
| qualquer outra coisa | preservada | `null` (só `raw`) |

Combinações lógicas de eventos (por exemplo `#R1 ! #R2`) **não são interpretadas** hoje: ficam como
gatilho cru, fiel e reeditável em texto. ⚠ A semântica exata dos operadores precisa ser confirmada
antes de modelá-los como nós.

### 3.3 Comandos reconhecidos

| Forma | `parsed.op` |
| --- | --- |
| `ON ^Porta`, `ON ^A, ^B` | `ON` |
| `OFF …`, `LOCKON …`, `LOCKOFF …` | `OFF` / `LOCKON` / `LOCKOFF` |
| `ADD A`, `ADD A(I)` | `ADD` |
| `SUB A` | `SUB` |
| `SET A = 0`, `SET A = 0, B = 1` | `SET` |
| `SHOW 1, Respostas, A` | `SHOW` |
| `Z1` … `Z32` | `Z` |
| `IF cond [@Verdadeiro, @Falso]` | `IF` |
| qualquer outro | `null` (só `raw`) |

A condição do `IF` é guardada como texto e, quando tem a forma `operando operador operando`, também
decomposta — é o que alimenta o nó de decisão com seus três campos.

## 4. Metadados em comentários

Anotações do editor viajam dentro do próprio `.MPC` como comentários, invisíveis para o compilador
do MED-PC:

| Comentário | Significado |
| --- | --- |
| `\@nome: Esperando resposta` | nome amigável do estado ou processo |
| `\@pos: 120,340` | posição do nó no canvas |
| `\@papel: espera` | papel do estado (cor e ícone no canvas) |
| `\@macro: pulso 0.05` | marca um estado gerado por uma ação composta |

A anotação vale para o **cabeçalho imediatamente seguinte ou o da mesma linha**. Um arquivo sem
nenhuma anotação abre normalmente — os nomes caem para `S1`, `S2`, … e as posições para o layout
automático.

## 5. O que ainda não é modelado

Registrado aqui para não ser esquecido, e hoje coberto pelo caminho `raw`:

- operadores lógicos entre eventos (`!`, `#R1 ! #R2`);
- `RANDD` / `RANDI` e o uso de listas como distribuições;
- aritmética em índice ou valor (`A(I+1)`, `B(2) + .6`, `B(1)/6000` — o texto é preservado como
  índice/valor cru; só um único operando ou uma constante é decomposto);
- `DISKFORMAT` / `DISKCOLUMNS` além da forma `DIRETIVA = lista`;
- **destinos especiais de fim de programa** (`STOP`, `ABORT`, `FLUSH`, `KILL`, `PAUSE`, `RESUME`,
  `NOOP`, combináveis por concatenação — `STOPABORTFLUSH` aparece em todo arquivo real visto até
  agora). Um alvo que não é `Sn` nem `SX` vira `Target.state = null`; o descompilador do grafo
  (`src/graph/decompile.ts`) trata isso como "não modelado" e faz a regra inteira cair no caminho
  cru, em vez de adivinhar — nunca interpreta como `SX` ("fica aqui"), que mudaria o sentido do
  programa. Modelar esses destinos como um nó próprio do canvas é candidato a uma parte futura,
  dado quão comuns são;
- sub-rotinas e qualquer construção específica do MED-PC V ainda não vista em fixture.

### 5.1 Índice de array aninhado

`D(B(17))` — um array indexado por um elemento de outro array — é comum em arquivos reais
(`SET D(B(17)) = …`). O índice é capturado como texto cru (`"B(17)"`), procurando o parêntese de
**fechamento correspondente**, não o primeiro que aparecer — um bug inicial usava `findIndex` e
cortava `D(B(17))` em `D(B(17)` ao reimprimir, o que corrompia tudo que vinha depois na mesma linha
(o descasamento de parênteses derruba a contagem de profundidade do resto do statement).

### 5.2 Rótulo referenciado que não existe

Um `IF … [@Rotulo, @Outro]` cujo `@Rotulo` não bate com nenhum `@Rotulo:` definido no statement — por
erro de digitação (`@DURRINGREINFORCEMENT` no `IF`, `@DURINGREINFORCEMENT:` na definição) ou por um
rótulo com espaço que não é reconhecido como tal (`@COMPONENTE 4:` — ver §3, o espaço quebra a
detecção de fronteira `@Ident:`) — não vira um nó de decisão com um ramo faltando. A regra inteira
cai no caminho cru (mesmo mecanismo do rótulo órfão da Parte 4), e o **validador** (`rotulo-inexistente`)
é quem avisa o autor do arquivo em linguagem simples. As quatro fixtures reais têm esse exato bug —
é um erro de digitação real do laboratório, não do parser, e é exatamente o tipo de coisa que a
validação didática existe para pegar.

### 5.3 Rótulo repetido na mesma regra

`@STOP` (ou `@NOT`) uma vez por nível de `IF` aninhado é o padrão dominante nos arquivos reais —
aparece em 12 regras das fixtures, sempre com a indentação do autor indicando qual pertence a qual
nível:

```
.01": IF B(18) > 0 [@MORE, @STOP]
     @MORE: SUB B(18) ---> SX
     @STOP: OFF ^DIPPER; IF B(9) < A(8) [@ANOTHER, @STOP]
          @ANOTHER: ---> S3
          @STOP: ADD B(17) ---> STOPABORTFLUSH
```

A resolução é **o primeiro segmento com aquele rótulo depois do `IF` que o cita** — não um mapa por
nome, que guardaria só a última definição, faria o `IF` de fora pular para o `@STOP` final e deixaria
o `@STOP` do meio órfão, jogando a regra inteira no caminho cru. Até 2026-08-10 era exatamente isso
que acontecia: o canvas mostrava um único nó "avançado" onde havia duas decisões, nove ações e três
destinos perfeitamente editáveis.

Resolver só para frente também garante que a recursão avança (índices crescentes), e mantém fora do
modelo a corrente que volta — que dentro de uma regra do MedState não existe. Um rótulo definido
apenas **antes** do `IF` que o cita continua caindo no cru, sem adivinhação.

### 5.4 Número sem zero à esquerda (`.01`)

`.01": ON^HOUSELIGHT, ...` — sem o zero antes do ponto — é o gatilho de tempo **mais comum** nas
quatro fixtures reais (toda seção "BOX TEST" começa assim). O léxico só junta o ponto a um número
quando já vinha consumindo dígitos antes dele (`0.01` sim, `.01` não — ver `lexer.ts`), então
`.01` chega ao parser como dois tokens: `dot` e `number`. Até 2026-08-10 `parseOperand` não
reconhecia esse par, e o operando virava `type: 'unknown'` — o que fazia o **gatilho de tempo
inteiro** cair no caminho cru (`Trigger.parsed = null`) silenciosamente. Sem erro de sintaxe, sem
aviso: só um nó "avançado" no canvas de nível 2 onde deveria haver um gatilho de tempo normal, e o
simulador (Parte 10) nunca disparava esses temporizadores. Corrigido em `parseOperand`
reconhecendo `dot + number` como `type: 'number'`, com `name` igual ao texto exato (`.01`, não
`0.01`) — assim `Number(operand.name)` continua avaliando certo (JS aceita `.01` nativamente) e
reimprimir continua idêntico ao original. O narrador (`numero()` em `narrate.ts`) também precisou
de um ajuste: sem ele, ".01" virava ",01" em português (faltando o zero).
