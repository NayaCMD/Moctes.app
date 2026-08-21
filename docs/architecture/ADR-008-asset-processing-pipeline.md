# ADR-008 — Pipeline assíncrono de imagens

## Status

Aceito.

## Decisão

- O upload direto é gravado sob `quarantine/<workspace>/<asset>/...` e permanece inacessível ao cliente.
- `complete` faz somente a verificação preliminar de tamanho/MIME do objeto, muda o asset para `PROCESSING` e enfileira `AssetProcessingJob` na mesma transação.
- A fila usa PostgreSQL, claim otimista, lock com expiração e retry exponencial. O consumidor roda como outro processo do mesmo monólito Nest (`start:worker:*`), sem criar um serviço distribuído novo.
- O worker detecta o tipo pelos magic bytes, exige correspondência com o MIME declarado, limita dimensões e pixels durante o decode, executa ClamAV e sanitiza SVG com allowlist no backend.
- Imagens aprovadas geram display e thumbnail em WebP e AVIF. SVG aprovado preserva também uma origem sanitizada; raster é servido por uma versão WebP reencodada.
- Somente `READY` recebe URLs assinadas. Arquivos estruturalmente inválidos ficam `REJECTED`; detecção de malware ou impossibilidade definitiva de confirmar segurança fica `QUARANTINED`.
- `Workspace.storageUsedBytes` começa com a reserva do upload e, após processamento, passa a contabilizar os objetos efetivamente mantidos.

## Consequências

- API e worker podem ser escalados separadamente, mas compartilham banco, módulos e deploy.
- A indisponibilidade temporária do scanner não libera conteúdo: o job é repetido e termina em quarentena após o limite.
- A interface precisa tratar o asset como não utilizável durante processamento e renovar o cache apenas depois de `READY`.
- O bucket continua privado; a separação por prefixo é defesa adicional e não substitui políticas de acesso do object storage.
