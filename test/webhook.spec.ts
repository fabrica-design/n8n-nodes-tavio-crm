import { describe, expect, it } from 'vitest';
import {
	isWebhookPayload,
	signWebhook,
	verifyWebhookSignature,
} from '../nodes/TavioCrm/webhook-signature';

describe('webhook Tavio CRM', () => {
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
