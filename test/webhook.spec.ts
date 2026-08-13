import type { IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { TavioCrmTrigger } from '../nodes/TavioCrm/TavioCrmTrigger.node';
import {
	isWebhookPayload,
	signWebhook,
	verifyWebhookSignature,
} from '../nodes/TavioCrm/webhook-signature';

describe('webhook Tavio CRM', () => {
	it('registra e desabilita o endpoint remoto sem expor o segredo', async () => {
		const trigger = new TavioCrmTrigger();
		const webhookData: Record<string, unknown> = {};
		const request = vi
			.fn()
			.mockResolvedValueOnce({ data: { id: 'webhook-1', secret: 'segredo-de-assinatura' } })
			.mockResolvedValueOnce({ data: { id: 'webhook-1', active: false } });
		const context = {
			getCredentials: vi.fn().mockResolvedValue({
				baseUrl: 'https://crm.tavio.com.br/api/v1',
				apiKey: 'chave-de-teste',
			}),
			getNodeParameter: vi.fn().mockReturnValue(['deal.won']),
			getNodeWebhookUrl: vi.fn().mockReturnValue('https://n8n.example/webhook/tavio'),
			getWorkflow: vi.fn().mockReturnValue({ name: 'Onboarding' }),
			getWorkflowStaticData: vi.fn().mockReturnValue(webhookData),
			helpers: { httpRequestWithAuthentication: request },
		} as unknown as IHookFunctions;

		await expect(trigger.webhookMethods.default.create.call(context)).resolves.toBe(true);
		expect(webhookData).toMatchObject({ webhookId: 'webhook-1' });
		expect(JSON.stringify(request.mock.calls[0])).not.toContain('segredo-de-assinatura');
		await expect(trigger.webhookMethods.default.delete.call(context)).resolves.toBe(true);
		expect(webhookData).toEqual({});
		expect(request.mock.calls[1][1]).toMatchObject({
			method: 'POST',
			url: 'https://crm.tavio.com.br/api/v1/webhooks/webhook-1/disable',
		});
	});

	it('entrega payload normalizado uma vez e elimina evento duplicado', async () => {
		const trigger = new TavioCrmTrigger();
		const webhookData: Record<string, unknown> = { webhookSecret: 'segredo-de-assinatura' };
		const payload = {
			eventId: 'evt-dedup-1',
			type: 'deal.won',
			occurredAt: new Date().toISOString(),
			data: { id: 'deal-1', title: 'Contrato' },
		};
		const rawBody = JSON.stringify(payload);
		const timestamp = String(Math.floor(Date.now() / 1000));
		const headers = {
			'x-tavio-timestamp': timestamp,
			'x-tavio-event-id': payload.eventId,
			'x-tavio-event': payload.type,
			'x-tavio-signature': signWebhook(
				'segredo-de-assinatura',
				timestamp,
				payload.eventId,
				rawBody,
			),
		};
		const response = {
			status: vi.fn().mockReturnThis(),
			send: vi.fn().mockReturnThis(),
			end: vi.fn().mockReturnThis(),
		};
		const context = {
			getRequestObject: vi.fn().mockReturnValue({ rawBody: Buffer.from(rawBody) }),
			getResponseObject: vi.fn().mockReturnValue(response),
			getHeaderData: vi.fn().mockReturnValue(headers),
			getBodyData: vi.fn().mockReturnValue(payload),
			getWorkflowStaticData: vi.fn().mockReturnValue(webhookData),
			helpers: {
				returnJsonArray: (items: unknown[]) => items.map((json) => ({ json })),
			},
		} as unknown as IWebhookFunctions;

		const first = await trigger.webhook.call(context);
		expect(JSON.stringify(first)).toContain('"resourceId":"deal-1"');
		expect(JSON.stringify(first)).toContain('"raw"');
		expect(JSON.stringify(first)).not.toContain('segredo-de-assinatura');
		await expect(trigger.webhook.call(context)).resolves.toEqual({
			webhookResponse: 'Evento já processado',
		});
	});

	it('valida HMAC no corpo bruto e rejeita adulteração', () => {
		const now = Date.parse('2026-08-13T03:00:00.000Z');
		const timestamp = String(now / 1000);
		const body =
			'{"eventId":"evt-1","type":"deal.won","occurredAt":"2026-08-13T03:00:00.000Z","data":{"id":"deal-1"}}';
		const signature = `sha256=${signWebhook('secret', timestamp, 'evt-1', body)}`;
		expect(verifyWebhookSignature('secret', timestamp, 'evt-1', body, signature, now)).toBe(true);
		expect(verifyWebhookSignature('secret', timestamp, 'evt-1', `${body} `, signature, now)).toBe(
			false,
		);
	});

	it('rejeita replay antigo e payload incompleto', () => {
		const timestamp = '1';
		const body = '{}';
		const signature = signWebhook('secret', timestamp, 'evt-1', body);
		expect(verifyWebhookSignature('secret', timestamp, 'evt-1', body, signature, Date.now())).toBe(
			false,
		);
		expect(isWebhookPayload({ eventId: 'evt-1', type: 'deal.won' })).toBe(false);
		expect(
			isWebhookPayload({
				eventId: 'evt-1',
				type: 'deal.won',
				occurredAt: '2026-08-13T03:00:00.000Z',
				data: { id: 'deal-1' },
			}),
		).toBe(true);
	});
});
