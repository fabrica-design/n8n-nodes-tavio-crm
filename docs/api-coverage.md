# Matriz auditada da API Tavio CRM

## Cobertura da interface visual v3 (25/08/2026)

A v3 é o padrão para nodes novos. A v1 permanece legada e a v2 permanece
executável para workflows salvos; não houve migração de parâmetros persistidos.

### Diagnóstico e correção de UX

| Sintoma                             | Causa comprovada                                                                                                       | Correção 0.2.1                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tags repetidas                      | O mesmo objeto `tagIds`, com `displayOptions` amplo, era concatenado após cada grupo de recurso na v2.                 | A v2 insere a definição uma única vez; a v3 mantém uma única coleção no fluxo aplicável.           |
| Campos personalizados repetidos     | O mesmo objeto `customFields` era concatenado nas mesmas posições da v2.                                               | A v2 insere a definição uma única vez; a v3 usa uma única coleção contextual.                      |
| Ordem e formulário longo de negócio | Os campos compartilhados eram inseridos antes dos grupos seguintes, não pela operação de negócio.                      | A v3 inicia por Título, associação e Campos adicionais, sem mover parâmetros de workflows v2.      |
| `Renovação Acme` e `25000.00`       | São `placeholder` da descrição v2, não `default`, fixture, estado ou resposta da API.                                  | A v3 não os declara; valores salvos continuam intocados na v2.                                     |
| `[object Object]` em seletores      | Erros HTTP brutos eram relançados pelo carregador e serializados pelo editor.                                          | Erros 401/403/404/422/5xx são convertidos em `Error` seguro e acionável.                           |
| Tags falhando                       | O carregador derivava `entity=TAG` para o recurso Tag; o contrato aceita CONTACT, ORGANIZATION, LEAD, DEAL ou PRODUCT. | O carregador deriva a entidade do item (`entityType` para operação Tag) e usa somente enum válido. |
| Resource locators sem busca         | As propriedades declaravam `searchListMethod`, mas o node só expunha `loadOptions`.                                    | A implementação expõe `methods.listSearch`, paginação por `cursor` e `limit=100`.                  |

Campos adicionais de `Negócio → Criar`: valor, moeda, funil, etapa, data prevista
de fechamento, responsável, equipe, probabilidade, origem, ID externo,
observações, Tags e Campos personalizados. Eles são todos campos existentes no
contrato de criação de negócio. Funil e Etapa são validados antes do HTTP; a API
continua sendo a autoridade para os demais tipos e permissões.

| Recurso             | Operações expostas nas v2/v3                                                                                       | Payload visual principal                                                                    | Seletores/observações                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Contato             | criar, obter, listar, pesquisar, atualizar, upsert, arquivar, restaurar                                            | nome, e-mail, telefone, empresa, responsável, equipe, origem, observações, tags             | campos personalizados filtrados por `CONTACT`    |
| Empresa             | criar, obter, listar, pesquisar, atualizar, upsert, arquivar, restaurar                                            | nome, documento, e-mail, telefone, website, endereço, responsável, equipe                   | contrato não inventa CNPJ/CPF                    |
| Lead                | criar, obter, listar, pesquisar, atualizar, arquivar, restaurar, qualificar, desqualificar, converter              | título, contato, empresa, valor, moeda, responsável, equipe, origem, data prevista          | funil/etapa só aparecem na conversão             |
| Negócio             | criar, obter, listar, pesquisar, atualizar, mover, ganhar, perder, reabrir, arquivar, restaurar, adicionar produto | título, contato, empresa, valor, moeda, funil, etapa, responsável, equipe, fechamento, item | `externalId` é deduplicação de negócio           |
| Atividade           | criar, obter, listar, atualizar, concluir                                                                          | assunto, tipo, data, duração, prioridade, lembrete, entidades relacionadas                  | `updatedAt` permanece obrigatório em atualização |
| Produto             | criar, obter, listar, atualizar                                                                                    | nome, tipo, código, categoria, descrição, preço, moeda, unidade, recorrência, ativo         | `updatedAt` permanece obrigatório em atualização |
| Nota                | criar                                                                                                              | conteúdo e entidade relacionada                                                             | endpoint somente de criação                      |
| Funil/etapa         | listar funis, obter etapas                                                                                         | seletores dependentes                                                                       | etapas são filtradas pelo funil escolhido        |
| Tag                 | listar, adicionar, remover                                                                                         | entidade, item e tag                                                                        | tags carregadas por entidade                     |
| Requisição avançada | método, caminho, query e corpo JSON                                                                                | JSON somente neste recurso                                                                  | `resolveApiUrl` bloqueia troca de origem         |

Todos os campos visuais continuam aceitando expressões n8n. `workspaceId`, API
key, headers e detalhes de transporte não são parâmetros do node.

Auditoria realizada em 13/08/2026 sobre controllers, contratos, serviços,
Prisma, autenticação, idempotência, auditoria e worker do monorepo.

| Recurso               | Endpoint base        | Autorização API key        | Paginação/pesquisa      | Idempotência/auditoria                 | Lacuna encontrada e decisão                                            |
| --------------------- | -------------------- | -------------------------- | ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| API key               | `/api-keys`          | administração por sessão   | lista                   | segredo excluído de snapshot; auditada | credencial usa `/auth/session`, sem administrar chaves                 |
| Contatos              | `/contacts`          | `contacts:read/write`      | cursor + search         | interceptor + outbox/audit             | adicionado `/contacts/upsert` por externalId, e-mail ou telefone       |
| Empresas              | `/organizations`     | `organizations:read/write` | cursor + search         | interceptor + outbox/audit             | adicionado upsert por documento único                                  |
| Leads                 | `/leads`             | `leads:read/write`         | cursor + search         | interceptor; eventos                   | adicionados get/update/archive/restore; convert repetível sem duplicar |
| Negócios              | `/deals`             | `deals:read/write`         | cursor + search/filtros | interceptor; lifecycle auditado        | `externalId` exposto no contrato; lifecycle existente reutilizado      |
| Funis/etapas          | `/pipelines`         | `pipelines:read/write`     | lista com etapas        | mutações auditadas                     | leitura existente atende loadOptions                                   |
| Atividades            | `/activities`        | `activities:read/write`    | cursor + search/filtros | interceptor; eventos                   | adicionados get/update e complete idempotente                          |
| Produtos              | `/products`          | `products:read/write`      | cursor + search         | interceptor                            | adicionados get/update e eventos de auditoria                          |
| Notas                 | `/notes`             | `notes:write`              | não aplicável           | criação auditada                       | escopo API key adicionado                                              |
| Tags                  | `/tags`              | `tags:read/write`          | lista                   | mutações auditadas                     | add/remove usa leitura + update versionado do item                     |
| Campos personalizados | `/custom-fields`     | `custom-fields:read`       | lista                   | mutações existentes auditadas          | leitura liberada para automações; escrita fora do nó v1                |
| Usuários              | `/workspace/members` | `users:read`               | lista                   | leitura                                | escopo somente leitura para seletor                                    |
| Equipes               | `/workspace/teams`   | `teams:read`               | lista                   | leitura                                | escopo somente leitura para seletor                                    |
| Webhooks              | `/webhooks`          | `webhooks:manage`          | lista/deliveries        | lifecycle auditado; segredo one-shot   | trigger cria, verifica existência e desabilita                         |

## Invariantes preservados

- `workspaceId` sempre deriva da sessão ou chave persistida.
- Escopo RBAC `OWN`/`TEAM`/`ALL` continua aplicado por `scopedWhere`.
- Dinheiro não usa `number` persistido.
- Mutações sensíveis escrevem audit log append-only e, quando aplicável, outbox.
- Workspaces suspensos continuam bloqueados para escrita pelo guard global.
- Nenhuma migration foi criada ou alterada.

## Contrato de erro

O nó reconhece o envelope `{ error: { code, message, correlationId, details } }`
da API. `401` indica credencial, `403` escopo/permissão, `404` também protege
isolamento entre tenants, `409` representa concorrência/idempotência/regra de
negócio e `429` exige backoff.
