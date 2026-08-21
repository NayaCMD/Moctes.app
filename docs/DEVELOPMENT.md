# Desenvolvimento local

## Banco e API

1. Crie `backend/.env` a partir de `backend/.env.example`.
2. Execute `npm run db:up`.
3. Execute `npm run db:migrate`.
4. Execute `npm run dev`.

O PostgreSQL do Moctes usa `localhost:5433`, o backend usa `localhost:3000`, o frontend usa `localhost:5173`, o MinIO expõe a API S3 em `localhost:9000` e o console em `localhost:9001`, e o ClamAV atende o worker em `localhost:3310`. `npm run dev` inicia frontend, API e worker de assets.

## Autenticação e workspaces

- `POST /api/auth/register`: cria usuário, workspace pessoal e sessão.
- `POST /api/auth/login`: cria uma sessão por cookie `HttpOnly`.
- `GET /api/auth/session`: retorna usuário e workspaces da sessão atual.
- `POST /api/auth/logout`: revoga a sessão atual.
- `GET /api/workspaces`: lista os workspaces ativos do usuário.
- `POST /api/workspaces`: cria um workspace com o usuário como `OWNER`.
- `GET|POST /api/workspaces/:workspaceId/members`: lista ou adiciona membros.
- `PATCH|DELETE /api/workspaces/:workspaceId/members/:membershipId`: altera ou remove um membership.

O cookie é enviado automaticamente pelo frontend com `credentials: include`. As rotas protegidas passam por autenticação global e por políticas de `OWNER`, `ADMIN`, `EDITOR` ou `VIEWER`.

## Persistência de documentos

- `GET /api/documents?workspaceId=:workspaceId`: lista documentos autorizados.
- `GET /api/documents/:id`: lê um documento autorizado.
- `POST /api/documents`: cria um documento; o corpo exige `workspaceId`.
- `PUT /api/documents/:id`: atualiza usando `expectedVersion`.
- `DELETE /api/documents/:id`: move um documento para a lixeira recuperável.
- `GET /api/documents/trash?workspaceId=:workspaceId`: lista documentos excluídos.
- `POST /api/documents/:id/restore-deleted?workspaceId=:workspaceId`: restaura um documento excluído.
- `GET /api/documents/:id/revisions`: lista até 100 revisões imutáveis.
- `GET /api/documents/:id/revisions/:version`: recupera o conteúdo de uma revisão.
- `POST /api/documents/:id/revisions/:version/restore`: restaura usando `expectedVersion` e cria uma nova versão.

O frontend carrega a API ao iniciar e usa o estado persistido no navegador como cache offline. Alterações são gravadas primeiro em uma fila IndexedDB, consolidadas por documento e enviadas após debounce de 800 ms. Falhas transitórias usam backoff exponencial com jitter e sobrevivem a reload/reinício. Um conflito de versão preserva a operação e marca a máquina como `conflict`.

O indicador ao lado do workspace expõe os estados `Conectando`, `na fila`, `Salvando`, `Salvo`, `Aguardando retry`, `Offline`, `Conflito` e `Falha`. Estados transitórios podem ser antecipados com `Tentar agora`.

Conflitos reais abrem uma comparação entre o estado desejado deste dispositivo e o documento atual do servidor. O usuário pode descartar a operação local ou reaplicá-la sobre a versão remota mais recente. O histórico fica disponível na barra da conta; `VIEWER` pode consultar, enquanto `OWNER`, `ADMIN` e `EDITOR` podem restaurar. Uma restauração nunca regride o contador: ela copia o conteúdo antigo para uma nova revisão e preserva a versão substituída.

## Assets e object storage

- `GET /api/assets?workspaceId=:workspaceId&limit=100&cursor=:id`: pagina assets em processamento ou finalizados; URLs de leitura são emitidas exclusivamente para `READY`.
- `GET /api/assets/:id`: consulta o estado atual de um asset autorizado.
- `GET /api/assets/usage?workspaceId=:workspaceId`: retorna cota, bytes reservados, contadores do ciclo de vida e estado da última limpeza.
- `POST /api/assets/uploads`: cria o metadado `PENDING` e devolve uma URL assinada para `PUT` direto.
- `POST /api/assets/:id/complete`: verifica o objeto com `HEAD`, muda para `PROCESSING` e cria um job durável.
- `DELETE /api/assets/:id`: remove o objeto e os metadados.

Arquivos permitidos: PNG, JPEG, WEBP, GIF e SVG, com limite atual de 5 MB. `VIEWER` pode listar; `OWNER`, `ADMIN` e `EDITOR` podem enviar e excluir. A API não recebe o corpo do upload: o navegador envia diretamente para S3/MinIO usando uma assinatura curta. O worker lê o objeto privado, confere assinatura binária e MIME real, executa ClamAV, limita dimensões/pixels, sanitiza SVG no servidor e gera display/thumbnail em WebP e AVIF. Em produção, o bucket e sua política CORS devem ser provisionados pela infraestrutura; `OBJECT_STORAGE_AUTO_CREATE_BUCKET` é apenas uma conveniência local.

O ciclo é `PENDING → PROCESSING → READY`. Conteúdo inválido termina em `REJECTED`; malware ou uma falha que impeça confirmar segurança termina em `QUARANTINED`. Somente `READY` recebe URL assinada. O antivírus pode ser desligado com `ASSET_ANTIVIRUS_ENABLED=false` apenas em desenvolvimento; o worker recusa essa configuração quando `NODE_ENV=production`.

O cache local é separado pelo par usuário/workspace para não reutilizar documentos entre tenants. A API limita tráfego global e aplica limites mais restritos a login, cadastro e emissão de upload assinado. Antes de exposição pública ainda devem ser adicionadas recuperação/verificação de conta, política explícita de CSRF e gestão administrativa/limpeza de sessões.

`GET /api/health` é o liveness check. `GET /api/health/ready` valida PostgreSQL, object storage e ClamAV e responde `503` quando alguma dependência está degradada. Em produção, a inicialização exige URLs e credenciais explícitas, HTTPS no frontend e antivírus habilitado.

Imagens remotas também são cacheadas no IndexedDB. Documentos guardam `asset://<id>` em vez de URLs assinadas; referências antigas são migradas ao carregar e assets importados antes do backend são enviados gradualmente quando a rede está disponível.

A cota padrão é de 100 MB e 500 assets ativos por workspace; uploads `PENDING`, `PROCESSING` e `QUARANTINED` consomem ambos os limites. Quando o processamento termina, a reserva passa a refletir os bytes efetivos das variantes. A manutenção interna remove uploads expirados, rejeições antigas, quarentenas vencidas e objetos órfãos. Os intervalos podem ser ajustados com `ASSET_CLEANUP_INTERVAL_SECONDS`, `ASSET_PENDING_CLEANUP_GRACE_SECONDS`, `ASSET_REJECTED_RETENTION_SECONDS`, `ASSET_QUARANTINE_RETENTION_SECONDS`, `ASSET_ORPHAN_CLEANUP_GRACE_SECONDS` e `ASSET_CLEANUP_BATCH_SIZE`.
