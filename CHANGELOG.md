# Changelog

## 0.2.0 — 2026-08-23

- Adiciona a versão visual v2 do node Tavio CRM, com campos tipados por recurso e operação.
- Mantém a versão 1 carregável para workflows existentes, incluindo `Campos (JSON)` e a chave de idempotência legada.
- Gera idempotência automática estável por workflow, node, execução, item, recurso e operação.
- Adiciona operações de lifecycle já existentes na API, incluindo restaurar, qualificar e desqualificar.
- Mantém a credencial, o trigger, o tipo interno e o ícone oficial sem alterações incompatíveis.

## 0.1.1 — 2026-08-21

- Substitui o ícone antigo pelo PNG oficial do produto Tavio CRM.
- Nenhuma alteração de contrato, operação ou comportamento do node.

## 0.1.0 — 2026-08-13

- Primeira versão privada do nó regular Tavio CRM.
- Trigger com lifecycle remoto, HMAC-SHA256, validação de payload e deduplicação.
- Recursos comerciais, paginação automática, seletores dinâmicos e requisição avançada same-origin.
- Compatibilidade validada com n8n 2.34.5 e `n8n-workflow` 2.34.2.
