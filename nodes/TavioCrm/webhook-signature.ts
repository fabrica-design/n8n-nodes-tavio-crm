import { createHmac, timingSafeEqual } from 'node:crypto';

export function signWebhook(
	secret: string,
	timestamp: string,
	eventId: string,
	body: string,
): string {
	return createHmac('sha256', secret).update(`${timestamp}.${eventId}.${body}`).digest('hex');
}

export function verifyWebhookSignature(
	secret: string,
	timestamp: string,
	eventId: string,
	body: string,
	signatureHeader: string,
	now = Date.now(),
): boolean {
	const age = Math.abs(now - Number(timestamp) * 1000);
	if (!Number.isFinite(age) || age > 5 * 60_000) return false;
	const signature = signatureHeader.startsWith('sha256=')
		? signatureHeader.slice('sha256='.length)
		: signatureHeader;
	if (!/^[a-f\d]{64}$/i.test(signature)) return false;
	const expected = Buffer.from(signWebhook(secret, timestamp, eventId, body), 'hex');
	const actual = Buffer.from(signature, 'hex');
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isWebhookPayload(value: unknown): value is {
	eventId: string;
	type: string;
	occurredAt: string;
	data: Record<string, unknown>;
} {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.eventId === 'string' &&
		candidate.eventId.length > 0 &&
		typeof candidate.type === 'string' &&
		candidate.type.length > 0 &&
		typeof candidate.occurredAt === 'string' &&
		!Number.isNaN(Date.parse(candidate.occurredAt)) &&
		typeof candidate.data === 'object' &&
		candidate.data !== null &&
		!Array.isArray(candidate.data)
	);
}
