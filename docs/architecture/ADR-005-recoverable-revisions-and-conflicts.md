# ADR-005 — Revisões recuperáveis e resolução de conflitos

- Status: aceito
- Data: 2026-08-11

## Contexto

O controle otimista impede sobrescritas silenciosas, mas um `409` ainda deixava a sincronização bloqueada sem uma forma segura de decidir entre o trabalho local e o estado remoto. Além disso, salvar apenas a versão atual não permitia recuperar uma alteração já sincronizada.

## Decisão

- Cada criação, atualização ou restauração cria uma `DocumentRevision` imutável na mesma transação PostgreSQL que altera o documento.
- A chave `(documentId, version)` é única e cada revisão registra autor, data e eventual versão de origem da restauração.
- Restaurar não move o documento para trás: copia o snapshot escolhido, incrementa a versão atual e registra outra revisão. Assim, o estado substituído continua recuperável.
- A restauração exige `expectedVersion`, evitando que uma confirmação antiga sobrescreva trabalho concorrente.
- Leitura do histórico usa `document:read`; restauração usa `document:update`.
- Em conflito, o frontend lê a operação exata da fila IndexedDB e o estado remoto. Aceitar o servidor remove a operação local; manter o local atualiza a base de versão e reenvia a mesma intenção.
- Exclusões locais e remotas são apresentadas como estados explícitos, não como documentos vazios.

## Consequências

- Um erro humano ou uma edição concorrente pode ser recuperado sem apagar a linha do tempo posterior.
- O banco armazena snapshots completos por revisão. Isso simplifica a recuperação e é apropriado para a fase atual, mas exige política futura de retenção, paginação e medição de volume.
- A resolução atual escolhe um estado completo; merge por elemento fica reservado para uma futura camada de colaboração/operações.
- A fila permanece bloqueada enquanto o conflito ativo não for decidido, impedindo sobrescrita automática.
