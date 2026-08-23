# Matriz auditada da API Tavio CRM

## Cobertura da interface visual v2 (23/08/2026)

| Recurso             | Operações expostas na v2                                                                                           | Payload visual principal                                                                    | Seletores/observações                            |
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
