# ADR-007 — Assets offline, cotas e manutenção

- Status: aceito
- Data: 2026-08-11

## Contexto

As primeiras URLs assinadas de leitura eram copiadas para os elementos do documento. Como essas URLs expiram, um documento podia deixar de renderizar depois de algumas horas e não havia uma fonte binária local para o modo offline. Assets importados antes do backend também continuavam restritos ao IndexedDB antigo. No servidor, uploads pendentes não reservavam uma cota e não existia coleta automática de objetos abandonados.

## Decisão

- Elementos persistem somente a referência estável `asset://<id>`. URLs assinadas são dados transitórios da biblioteca e nunca a identidade do conteúdo.
- O navegador mantém blobs remotos no IndexedDB, versionados por `Asset.updatedAt`, e metadados separados pelo escopo `<userId>:<workspaceId>`.
- Durante a hidratação, o cache é exibido primeiro. Quando a API responde, metadados e blobs são renovados em segundo plano.
- Referências antigas contendo URLs assinadas ou caminhos antigos são normalizadas ao abrir documentos e a sincronização grava a representação canônica no servidor.
- Assets locais legados com blob disponível são enviados gradualmente ao workspace. Após sucesso, os IDs são substituídos nos documentos e o blob antigo é removido.
- `Workspace.storageUsedBytes` inclui bytes `PENDING` e `READY`. A reserva acontece em transação serializável antes da criação do ticket, impedindo ultrapassagem por uploads concorrentes. O tamanho declarado também integra a assinatura do `PUT`, para que o object storage recuse um corpo diferente antes da confirmação.
- Uploads inválidos, cancelados ou removidos liberam a reserva. Os limites iniciais são 100 MB e 500 assets ativos por workspace; ambos podem ser alterados posteriormente pelo serviço de entitlements.
- Um processo interno periódico remove uploads pendentes expirados, registros falhos antigos e objetos sem metadado após uma janela de segurança.
- Eventos do ciclo de vida são emitidos como logs estruturados. O endpoint de uso expõe consumo, limite, contadores operacionais e o resultado da última manutenção somente a membros autorizados.

## Consequências

- Imagens já visitadas continuam renderizando sem rede e URLs expiradas podem ser renovadas sem alterar documentos.
- A primeira sincronização após esta versão pode criar uma revisão apenas para canonicalizar referências antigas.
- O cache é uma otimização local; PostgreSQL e object storage continuam sendo as fontes de verdade.
- Os contadores operacionais em memória reiniciam com a API. Uma implantação distribuída deverá exportá-los para uma plataforma de métricas.
- Inspeção de magic bytes, thumbnails e antivírus continuam pertencendo ao futuro pipeline assíncrono de mídia.
