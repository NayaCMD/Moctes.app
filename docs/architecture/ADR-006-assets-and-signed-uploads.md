# ADR-006 — Assets e uploads assinados

- Status: aceito; a promoção para `READY` foi substituída pelo pipeline do ADR-008
- Data: 2026-08-11

## Contexto

Assets importados eram blobs guardados apenas no IndexedDB. Eles não estavam disponíveis em outro dispositivo, podiam desaparecer com a limpeza do navegador e aumentariam demais o JSON dos documentos caso fossem convertidos para base64.

## Decisão

- Metadados ficam no PostgreSQL como `Asset`, vinculados ao `Workspace` e ao usuário que iniciou o envio.
- O binário fica em object storage S3 compatível, fora do PostgreSQL e do JSON do documento.
- Um upload começa como `PENDING`. A API valida nome, tipo, MIME, dimensões declaradas e limite de 5 MB, gera uma chave não controlada pelo cliente e assina um `PutObject` por cinco minutos.
- O navegador envia o arquivo diretamente ao object storage com o `Content-Type` assinado.
- A conclusão executa `HeadObject`, compara tamanho e MIME declarados e somente então muda o registro para `READY`.
- Assets `READY` recebem URLs assinadas de leitura. Documentos continuam guardando `asset://<id>`, permitindo renovar a URL sem reescrever documentos.
- `VIEWER` possui `asset:read`; `OWNER`, `ADMIN` e `EDITOR` também possuem `asset:create` e `asset:delete`.
- MinIO é usado somente como implementação S3 local. Produção pode usar S3, R2 ou outro provedor compatível por configuração.

## Consequências

- O backend não processa o corpo do upload, reduzindo uso de memória e largura de banda da API.
- URLs temporárias não são identidades; o ID relacional é a referência estável.
- O estado `PENDING` permite distinguir uploads interrompidos de assets utilizáveis.
- Ainda são necessários um job para remover registros/objetos expirados, geração de thumbnails e inspeção assíncrona de conteúdo antes de aceitar arquivos de usuários desconhecidos em produção.
