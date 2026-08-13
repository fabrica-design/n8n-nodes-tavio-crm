/* eslint-disable @n8n/community-nodes/no-restricted-imports -- Node built-ins are used only by the local HTTP mock test. */
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	getMany,
	parseJsonObject,
	resolveApiUrl,
	tavioApiRequest,
	type TavioFunctions,
} from '../nodes/TavioCrm/transport';

function contextWithResponses(...responses: unknown[]) {
	const request = vi.fn();
	for (const response of responses) request.mockResolvedValueOnce(response);
	const context = {
		getCredentials: vi.fn().mockResolvedValue({
			baseUrl: 'https://crm.tavio.com.br/api/v1/',
			apiKey: 'segredo-que-nao-deve-aparecer',
		}),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as TavioFunctions;
	return { context, request };
}

describe('transporte HTTP', () => {
	it('integra com um servidor HTTP mock sem expor credenciais no corpo', async () => {
		const server = createServer((request, response) => {
			expect(request.url).toBe('/api/v1/contacts');
			expect(request.headers.authorization).toBe('Bearer chave-de-teste');
			response.setHeader('content-type', 'application/json');
			response.end('{"data":{"id":"contact-http-1"}}');
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const { port } = server.address() as AddressInfo;
			const context = {
				getCredentials: vi.fn().mockResolvedValue({
					baseUrl: `http://127.0.0.1:${port}/api/v1`,
					apiKey: 'chave-de-teste',
				}),
				helpers: {
					httpRequestWithAuthentication: async (_name: string, options: IHttpRequestOptions) => {
						const result = await fetch(options.url, {
							headers: { Authorization: 'Bearer chave-de-teste' },
						});
						return result.json();
					},
				},
			} as unknown as TavioFunctions;
			await expect(tavioApiRequest.call(context, 'GET', '/contacts')).resolves.toEqual({
				data: { id: 'contact-http-1' },
			});
		} finally {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	});

	it('mantém requisições avançadas na mesma origem', () => {
		expect(resolveApiUrl('https://crm.tavio.com.br/api/v1', '/contacts')).toBe(
			'https://crm.tavio.com.br/api/v1/contacts',
		);
		expect(() => resolveApiUrl('https://crm.tavio.com.br/api/v1', '//evil.example/a')).toThrow();
		expect(() =>
			resolveApiUrl('https://crm.tavio.com.br/api/v1', 'https://evil.example'),
		).toThrow();
	});

	it('valida objetos JSON', () => {
		expect(parseJsonObject('{"ok":true}', 'Campos')).toEqual({ ok: true });
		expect(() => parseJsonObject('[]', 'Campos')).toThrow('objeto JSON');
		expect(() => parseJsonObject('{', 'Campos')).toThrow();
	});

	it('envia Idempotency-Key sem colocar a credencial no payload', async () => {
		const { context, request } = contextWithResponses({ data: { id: 'contact-1' } });
		await tavioApiRequest.call(
			context,
			'POST',
			'/contacts',
			{ firstName: 'Ana' },
			undefined,
			'retry-contact-1',
		);
		expect(request).toHaveBeenCalledWith(
			'tavioCrmApi',
			expect.objectContaining({
				headers: { 'Idempotency-Key': 'retry-contact-1' },
				body: { firstName: 'Ana' },
			}),
		);
		const options = request.mock.calls[0][1] as IHttpRequestOptions;
		expect(JSON.stringify(options)).not.toContain('segredo-que-nao-deve-aparecer');
	});

	it('pagina até o fim e preserva o cursor', async () => {
		const { context, request } = contextWithResponses(
			{ data: { items: [{ id: '1' }], nextCursor: 'cursor-1' } },
			{ data: { items: [{ id: '2' }] } },
		);
		const result = await getMany.call(context, '/contacts', { search: 'ana' }, true, 100);
		expect(result.items.map(({ id }) => id)).toEqual(['1', '2']);
		expect(request).toHaveBeenCalledTimes(2);
		expect((request.mock.calls[1][1] as IHttpRequestOptions).qs).toMatchObject({
			cursor: 'cursor-1',
			search: 'ana',
		});
	});
});
