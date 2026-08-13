# Segurança

## Relato de vulnerabilidades

Não abra issue pública com segredo, payload de cliente ou detalhes exploráveis.
Envie o relato privado para `fabricadesignbrand@gmail.com`, incluindo versão,
impacto, passos mínimos e uma forma segura de contato. A equipe confirmará o
recebimento e coordenará correção e divulgação.

## Modelo de segurança

- A credencial armazena a API key como senha do n8n.
- Nenhum nó recebe `workspaceId`; o tenant vem da chave Tavio.
- Requisições avançadas não podem trocar de origem.
- Webhooks exigem HMAC do corpo bruto e timestamp recente.
- Logs, erros e saídas não devem incluir chave ou segredo de webhook.
- Valores monetários são strings decimais.

Rotacione a API key e reative triggers após suspeita de exposição. Revogue o
endpoint no CRM se a instância n8n for comprometida.
