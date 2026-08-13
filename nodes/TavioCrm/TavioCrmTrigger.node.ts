import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { tavioApiRequest, unwrapResponse } from './transport';
import { isWebhookPayload, verifyWebhookSignature } from './webhook-signature';

const eventOptions = [
	['Atividade Concluída', 'activity.completed'],
	['Atividade Criada', 'activity.created'],
	['Contato Atualizado', 'contact.updated'],
	['Contato Criado', 'contact.created'],
	['Empresa Criada', 'organization.created'],
	['Lead Convertido', 'lead.converted'],
	['Lead Criado', 'lead.created'],
	['Negócio Atualizado', 'deal.updated'],
	['Negócio Criado', 'deal.created'],
	['Negócio Ganho', 'deal.won'],
	['Negócio Movido de Etapa', 'deal.stage_changed'],
	['Negócio Perdido', 'deal.lost'],
] as const;

function header(value: string | string[] | undefined): string {
	return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export class TavioCrmTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tavio CRM Trigger',
		name: 'tavioCrmTrigger',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg, @n8n/community-nodes/icon-prefer-themed-variants -- The official round Tavio asset is a theme-neutral PNG.
		icon: 'file:tavio-crm.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Inicia o workflow quando um evento assinado ocorre no Tavio CRM',
		defaults: { name: 'Tavio CRM Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'tavioCrmApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Eventos',
				name: 'events',
				type: 'multiOptions',
				options: eventOptions.map(([name, value]) => ({ name, value })),
				default: [
					'activity.completed',
					'activity.created',
					'contact.updated',
					'contact.created',
					'organization.created',
					'lead.converted',
					'lead.created',
					'deal.updated',
					'deal.created',
					'deal.won',
					'deal.stage_changed',
					'deal.lost',
				],
				required: true,
				description: 'Eventos que devem iniciar o workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.webhookId;
				if (typeof webhookId !== 'string') return false;
				const response = await tavioApiRequest.call(this, 'GET', '/webhooks');
				const endpoints = unwrapResponse<IDataObject[]>(response);
				const exists = endpoints.some(({ id, active }) => id === webhookId && active === true);
				if (!exists) {
					delete webhookData.webhookId;
					delete webhookData.webhookSecret;
				}
				return exists;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const events = this.getNodeParameter('events') as string[];
				if (events.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Selecione ao menos um evento');
				}
				const response = await tavioApiRequest.call(this, 'POST', '/webhooks', {
					url: this.getNodeWebhookUrl('default'),
					description: `n8n: ${this.getWorkflow().name}`,
					events,
					active: true,
				});
				const endpoint = unwrapResponse<IDataObject>(response);
				if (typeof endpoint.id !== 'string' || typeof endpoint.secret !== 'string') {
					throw new NodeOperationError(
						this.getNode(),
						'O Tavio CRM não retornou o ID e o segredo de uso único do webhook',
					);
				}
				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = endpoint.id;
				webhookData.webhookSecret = endpoint.secret;
				webhookData.seenEventIds = [];
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (typeof webhookData.webhookId !== 'string') return true;
				try {
					await tavioApiRequest.call(this, 'POST', `/webhooks/${webhookData.webhookId}/disable`);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), error as Error);
				}
				delete webhookData.webhookId;
				delete webhookData.webhookSecret;
				delete webhookData.seenEventIds;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const response = this.getResponseObject();
		const headers = this.getHeaderData();
		const bodyData = this.getBodyData();
		const timestamp = header(headers['x-tavio-timestamp'] as string | string[] | undefined);
		const eventId = header(headers['x-tavio-event-id'] as string | string[] | undefined);
		const eventType = header(headers['x-tavio-event'] as string | string[] | undefined);
		const signature = header(headers['x-tavio-signature'] as string | string[] | undefined);
		const webhookData = this.getWorkflowStaticData('node');
		const secret = webhookData.webhookSecret;
		const rawBody = Buffer.isBuffer(request.rawBody)
			? request.rawBody.toString('utf8')
			: JSON.stringify(bodyData);

		if (
			typeof secret !== 'string' ||
			!verifyWebhookSignature(secret, timestamp, eventId, rawBody, signature)
		) {
			response.status(401).send('Assinatura inválida').end();
			return { noWebhookResponse: true };
		}
		if (
			!isWebhookPayload(bodyData) ||
			bodyData.eventId !== eventId ||
			bodyData.type !== eventType
		) {
			response.status(400).send('Payload inválido').end();
			return { noWebhookResponse: true };
		}

		const seen = Array.isArray(webhookData.seenEventIds)
			? webhookData.seenEventIds.map(String)
			: [];
		if (seen.includes(eventId)) return { webhookResponse: 'Evento já processado' };
		webhookData.seenEventIds = [...seen.slice(-499), eventId];

		const normalized: IDataObject = {
			eventId: bodyData.eventId,
			event: bodyData.type,
			occurredAt: bodyData.occurredAt,
			resourceId: typeof bodyData.data.id === 'string' ? bodyData.data.id : undefined,
			data: bodyData.data as IDataObject,
			raw: bodyData,
		};
		return { workflowData: [this.helpers.returnJsonArray([normalized])] };
	}
}
