# ADR-009: compartilhamento e colaboracao realtime

## Status

Aceito em 13/08/2026.

## Contexto

O sincronizador existente usa snapshots versionados, fila IndexedDB, retry e
resolucao explicita de conflitos. Esse modelo e adequado para autosave,
trabalho offline e concorrencia ocasional, mas nao oferece presenca, cursores
ou convergencia de alteracoes simultaneas com latencia de interacao.

Tambem era necessario separar tres formas de acesso:

- membership ativo, autenticado e associado a um workspace;
- convite pendente, destinado a um e-mail e ainda sem permissao;
- link publico revogavel, estritamente somente leitura.

## Decisao

Continuaremos no monolito modular NestJS, com um processo HTTP/WebSocket e o
mesmo PostgreSQL. A colaboracao usa Socket.IO em um namespace autenticado por
cookie de sessao.

### Compartilhamento

- `DocumentShareLink` armazena apenas SHA-256 do token, expiracao, revogacao e
  auditoria de uso. O token em texto puro e retornado somente na criacao.
- `GET /api/shares/:token` e publico, somente leitura e reemite URLs assinadas
  apenas para assets `READY` pertencentes ao workspace do documento.
- `WorkspaceInvitation` representa convite pendente, expira e pode ser
  revogado. Aceite exige sessao com o mesmo e-mail do destinatario.
- Convites nao concedem acesso ate serem aceitos. A promocao para `OWNER`
  continua sendo uma acao separada sobre um membership ativo.

### Presenca e interacao

- Presenca e cursores sao efemeros e nao persistidos.
- Previews de drag, resize e rotacao sao transmitidos a aproximadamente 30 Hz
  e nunca entram no historico ou banco.
- O commit final do gesto e persistido como operacao.

### Protocolo de coedicao

O protocolo usa os patches incrementais ja compartilhados pelo undo/redo:
`set`, `delete`, `insert-entity`, `remove-entity` e `reorder-entities`.

Cada operacao possui:

- `operationId` idempotente;
- `clientId` por aba;
- `baseSequence` observado pelo cliente;
- patches por caminho, usando seletores `{ id }` para entidades;
- `sequence` monotonicamente atribuida pelo PostgreSQL.

O servidor aplica atualizacao otimista conjunta sobre `collaborationSequence`
e `version`, repete em caso de corrida e possui unicidade em
`(documentId, operationId)` e `(documentId, sequence)`. Insercao e remocao de
entidades sao idempotentes. Alteracoes em caminhos independentes convergem;
uma operacao atrasada que sobreponha um caminho alterado desde sua
`baseSequence` recebe conflito explicito em vez de sobrescrever silenciosamente.

Esse e um modelo operacional equivalente adequado para elementos de canvas.
Ele nao e apresentado como CRDT de texto: edicao simultanea do mesmo bloco de
texto ainda tem granularidade de commit e ordem do servidor. Caso a experiencia
exija composicao caractere a caractere, um CRDT de texto devera ser introduzido
somente nesse tipo de conteudo.

### Integracao com offline

Enquanto a conexao realtime esta ativa, o documento e removido do envio de
snapshots para evitar dois escritores. Quando o socket cai, o autosave e a
fila IndexedDB voltam a ser o fallback.

Snapshots agora enviam `expectedVersion` e
`expectedCollaborationSequence`. Portanto, um snapshot offline antigo nao pode
sobrescrever operacoes realtime silenciosamente: o servidor devolve conflito e
reutiliza a interface de resolucao existente.

## Consequencias

O modelo suporta uma unica instancia imediatamente. Antes de escalar o backend
horizontalmente, presenca e broadcasts precisam de um adapter compartilhado
(por exemplo, Redis) e sticky sessions ou transporte compativel. O log mantem
as 5.000 operacoes mais recentes por documento. Cada commit colaborativo cria
uma revisao recuperavel e o documento retem as 100 revisoes mais recentes.
Previews de movimento continuam efemeros e nao criam revisoes.

Limites de seguranca do protocolo:

- no maximo 100 patches e 256 KiB por operacao;
- caminhos com profundidade maxima de 12;
- bloqueio de `__proto__`, `constructor` e `prototype`;
- cursores limitados a coordenadas percentuais validas;
- sessao revalidada nos eventos e sockets desconectados quando o membership muda;
- autorizacao de leitura no join e de escrita no commit;
- viewers nao podem publicar previews nem operacoes.
