/* eslint-disable @n8n/community-nodes/no-restricted-imports -- Node built-ins verify the local brand asset. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TavioCrmApi } from '../credentials/TavioCrmApi.credentials';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';
import { TavioCrmTrigger } from '../nodes/TavioCrm/TavioCrmTrigger.node';

const iconPath = resolve('nodes/TavioCrm/tavio-crm.png');
const icon = readFileSync(iconPath);

describe('identidade visual Tavio CRM', () => {
	it('referencia o mesmo PNG no node, trigger e credencial para ambos os temas', () => {
		expect(new TavioCrm().description.icon).toBe('file:tavio-crm.png');
		expect(new TavioCrmTrigger().description.icon).toBe('file:tavio-crm.png');
		expect(new TavioCrmApi().icon).toBe('file:../nodes/TavioCrm/tavio-crm.png');
	});

	it('preserva o PNG oficial redondo 300x300 com transparência', () => {
		expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(icon.subarray(12, 16).toString('ascii')).toBe('IHDR');
		expect(icon.readUInt32BE(16)).toBe(300);
		expect(icon.readUInt32BE(20)).toBe(300);
		expect(icon[24]).toBe(8);
		expect(icon[25]).toBe(6);
		expect(createHash('sha256').update(icon).digest('hex')).toBe(
			'c2776887b2748652841baa2abc01936d4dee19504f70795e17eaadae799661c5',
		);
	});
});
