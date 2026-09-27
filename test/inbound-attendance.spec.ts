import type { IExecuteFunctions, IHttpRequestOptions, INode } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';

function contextFor(parameters: Record<string, unknown>, typeVersion = 3) {
	const request = vi.fn().mockResolvedValue({
		data: { attendanceId: 'attendance-1', status: 'EM_TRIAGEM', outcome: 'created' },
	});
	const context = {
		getInputData: vi.fn().mockReturnValue([{ json: {} }]),
		getNodeParameter: vi.fn((name: string, _index?: number, fallback?: unknown) =>
			name in parameters ? parameters[name] : (fallback ?? ''),
		),
		getNode: vi.fn().mockReturnValue({
			id: 'node-1',
			name: 'Tavio CRM',
			type: 'tavioCrm',
			typeVersion,
			parameters,
		} as unknown as INode),
		getExecutionId: vi.fn().mockReturnValue('execution-1'),
		getWorkflow: vi.fn().mockReturnValue({ id: 'workflow-1', name: 'Teste', active: false }),
		getCredentials: vi.fn().mockResolvedValue({ baseUrl: 'https://crm.tavio.com.br/api/v1' }),
		continueOnFail: vi.fn().mockReturnValue(false),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as IExecuteFunctions;
	return { context, request };
}

describe('atendimento inbound e leads no node v3', () => {
	it('usa seletores do CRM para vínculos e mantém a operação ausente na v2', () => {
		const v3 = new TavioCrm().getNodeType(3).description.properties;
		const contact = v3.find(
			(property) =>
				property.name === 'contactId' &&
				property.displayOptions?.show?.resource?.includes('attendance'),
		);
		const lead = v3.find(
			(property) =>
				property.name === 'leadId' &&
				property.displayOptions?.show?.resource?.includes('attendance'),
		);
		expect(contact?.type).toBe('resourceLocator');
		expect(lead?.type).toBe('resourceLocator');
		const v2 = new TavioCrm().getNodeType(2).description.properties;
		expect(
			v2.some(
				(property) =>
					property.name === 'operation' &&
					property.displayOptions?.show?.resource?.includes('attendance'),
			),
		).toBe(false);
	});

	it('registra episódio sem inventar contato e devolve IDs e estado', async () => {
		const { context, request } = contextFor({
			resource: 'attendance',
			operation: 'inbound',
			chatwootAccountId: '1',
			chatwootConversationId: '20',
			messageId: '300',
			inboxId: '5',
			channel: 'whatsapp',
			occurredAt: '2026-09-26T10:00:00Z',
			source: 'whatsapp_organico',
			initialStatus: 'EM_TRIAGEM',
		});
		const output = await new TavioCrm().getNodeType(3).execute?.call(context);
		const options = request.mock.calls[0][1] as IHttpRequestOptions;
		expect(options.url).toBe('https://crm.tavio.com.br/api/v1/attendances/inbound');
		expect(options.body).toMatchObject({
			chatwootAccountId: '1',
			chatwootConversationId: '20',
			messageId: '300',
		});
		expect(options.body).not.toHaveProperty('contactId');
		expect(options.body).not.toHaveProperty('workspaceId');
		expect(options.headers ?? {}).not.toHaveProperty('Idempotency-Key');
		expect(Array.isArray(output) ? output[0]?.[0]?.json : undefined).toMatchObject({
			attendanceId: 'attendance-1',
			status: 'EM_TRIAGEM',
		});
	});

	it('envia fechamento com evento estável e motivo sem alterar o lead', async () => {
		const { context, request } = contextFor({
			resource: 'attendance',
			operation: 'close',
			attendanceId: 'att-1',
			eventId: 'chatwoot-resolved-81',
			occurredAt: '2026-09-26T11:00:00Z',
			reason: 'Atendimento concluído',
			expectedVersion: '2',
		});
		await new TavioCrm().getNodeType(3).execute?.call(context);
		const options = request.mock.calls[0][1] as IHttpRequestOptions;
		expect(options.url).toBe('https://crm.tavio.com.br/api/v1/attendances/att-1/close');
		expect(options.body).toEqual({
			eventId: 'chatwoot-resolved-81',
			occurredAt: '2026-09-26T11:00:00Z',
			version: 2,
			reason: 'Atendimento concluído',
		});
	});

	it('recupera lead pelo ID externo exato e consulta ativos por contato', async () => {
		const exact = contextFor({
			resource: 'lead',
			operation: 'getByExternalId',
			lookupExternalId: 'chatwoot:1:20',
		});
		exact.request.mockResolvedValueOnce({
			data: { items: [{ id: 'lead-1', externalId: 'chatwoot:1:20' }] },
		});
		await new TavioCrm().getNodeType(3).execute?.call(exact.context);
		expect((exact.request.mock.calls[0][1] as IHttpRequestOptions).qs).toMatchObject({
			externalId: 'chatwoot:1:20',
			limit: 1,
		});

		const active = contextFor({
			resource: 'lead',
			operation: 'listActiveByContact',
			lookupContactId: 'contact-1',
		});
		active.request.mockResolvedValueOnce({ data: { items: [{ id: 'lead-1', status: 'NEW' }] } });
		await new TavioCrm().getNodeType(3).execute?.call(active.context);
		expect((active.request.mock.calls[0][1] as IHttpRequestOptions).qs).toMatchObject({
			contactId: 'contact-1',
			active: 'true',
		});
	});

	it('cria ou localiza lead com externalId de negócio e sem chave da execução n8n', async () => {
		const { context, request } = contextFor({
			resource: 'lead',
			operation: 'upsert',
			title: 'Nova oportunidade',
			externalId: 'chatwoot:1:20:commercial',
			currency: 'BRL',
			options: { idempotencyMode: 'automatic' },
		});
		await new TavioCrm().getNodeType(3).execute?.call(context);
		const options = request.mock.calls[0][1] as IHttpRequestOptions;
		expect(options.url).toBe('https://crm.tavio.com.br/api/v1/leads/upsert');
		expect(options.body).toMatchObject({
			title: 'Nova oportunidade',
			externalId: 'chatwoot:1:20:commercial',
		});
		expect(options.headers ?? {}).not.toHaveProperty('Idempotency-Key');
	});
});
