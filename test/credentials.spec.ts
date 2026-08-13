import { describe, expect, it } from 'vitest';
import { TavioCrmApi } from '../credentials/TavioCrmApi.credentials';

describe('credencial Tavio CRM', () => {
	it('usa URL de produção, protege a chave e testa a sessão autenticada', () => {
		const credential = new TavioCrmApi();
		const baseUrl = credential.properties.find(({ name }) => name === 'baseUrl');
		const apiKey = credential.properties.find(({ name }) => name === 'apiKey');
		expect(baseUrl?.default).toBe('https://crm.tavio.com.br/api/v1');
		expect(apiKey?.typeOptions).toMatchObject({ password: true });
		expect(credential.test.request.url).toBe('/auth/session');
		expect(JSON.stringify(credential)).not.toContain('workspaceId');
	});
});
