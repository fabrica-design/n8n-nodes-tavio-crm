/* eslint-disable @n8n/community-nodes/no-restricted-imports -- Node built-ins verify the local brand asset. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TavioCrmApi } from '../credentials/TavioCrmApi.credentials';
import { TavioCrm } from '../nodes/TavioCrm/TavioCrm.node';
import { TavioCrmTrigger } from '../nodes/TavioCrm/TavioCrmTrigger.node';

const iconPath = resolve('nodes/TavioCrm/tavio-crm-icon.png');
const icon = readFileSync(iconPath);
const iconHash = 'ddb71bf763a7574b9de4e0b00d573a7a6c992ec5120ab44310c1a406cf59c7ac';

describe('identidade visual Tavio CRM', () => {
	it('referencia o mesmo PNG no node, trigger e credencial', () => {
		expect(new TavioCrm().description.icon).toBe('file:tavio-crm-icon.png');
		expect(new TavioCrmTrigger().description.icon).toBe('file:tavio-crm-icon.png');
		expect(new TavioCrmApi().icon).toBe('file:../nodes/TavioCrm/tavio-crm-icon.png');
	});

	it('preserva o PNG oficial byte a byte com transparência', () => {
		expect(existsSync(iconPath)).toBe(true);
		expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
		expect(icon.subarray(12, 16).toString('ascii')).toBe('IHDR');
		expect(icon.readUInt32BE(16)).toBe(3380);
		expect(icon.readUInt32BE(20)).toBe(2736);
		expect(icon[24]).toBe(8);
		expect(icon[25]).toBe(6);
		expect(createHash('sha256').update(icon).digest('hex')).toBe(iconHash);
		expect(existsSync(resolve('nodes/TavioCrm/tavio-crm.png'))).toBe(false);
	});
});
