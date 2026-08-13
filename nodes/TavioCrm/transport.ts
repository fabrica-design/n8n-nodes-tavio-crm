import type {
	GenericValue,
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { jsonParse } from 'n8n-workflow';

export type TavioFunctions =
	| IExecuteFunctions
	| IHookFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

export interface TavioPage {
	items: IDataObject[];
	nextCursor?: string;
}

interface TavioEnvelope {
	data?: unknown;
}

export function normalizeBaseUrl(raw: string): string {
	const url = new URL(raw.trim());
	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new TypeError('A URL da API deve usar HTTP ou HTTPS');
	}
	url.hash = '';
	url.search = '';
	url.pathname = url.pathname.replace(/\/+$/, '');
	return url.toString().replace(/\/$/, '');
}

export function resolveApiUrl(baseUrl: string, path: string): string {
	const normalizedBase = normalizeBaseUrl(baseUrl);
	if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
		throw new TypeError('Use um caminho relativo iniciado por /');
	}
	const base = new URL(`${normalizedBase}/`);
	const resolved = new URL(path.replace(/^\//, ''), base);
	if (resolved.origin !== base.origin) {
		throw new TypeError('A requisição avançada deve permanecer na origem da credencial');
	}
	return resolved.toString();
}

export function parseJsonObject(value: unknown, label: string): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as IDataObject;
	if (typeof value !== 'string') throw new TypeError(`${label} deve ser um objeto JSON`);
	const parsed = jsonParse<unknown>(value);
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new TypeError(`${label} deve ser um objeto JSON`);
	}
	return parsed as IDataObject;
}

export function unwrapResponse<T = unknown>(response: unknown): T {
	if (typeof response === 'object' && response !== null && 'data' in response) {
		return (response as TavioEnvelope).data as T;
	}
	return response as T;
}

export async function tavioApiRequest<T = unknown>(
	this: TavioFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	query?: IDataObject,
	idempotencyKey?: string,
): Promise<T> {
	const credentials = await this.getCredentials('tavioCrmApi');
	const options: IHttpRequestOptions = {
		method,
		url: resolveApiUrl(String(credentials.baseUrl), path),
		json: true,
	};
	if (body && Object.keys(body).length > 0) options.body = body;
	if (query && Object.keys(query).length > 0) options.qs = query;
	if (idempotencyKey) options.headers = { 'Idempotency-Key': idempotencyKey };
	const response = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'tavioCrmApi',
		options,
	);
	return response as T;
}

export async function getMany(
	this: TavioFunctions,
	path: string,
	query: IDataObject,
	returnAll: boolean,
	limit: number,
): Promise<{ items: IDataObject[]; rawPages: unknown[] }> {
	const items: IDataObject[] = [];
	const rawPages: unknown[] = [];
	let cursor: string | undefined;
	do {
		const remaining = returnAll ? 100 : Math.min(100, limit - items.length);
		const response = await tavioApiRequest.call(this, 'GET', path, undefined, {
			...query,
			limit: remaining,
			...(cursor ? { cursor } : {}),
		});
		rawPages.push(response);
		const page = unwrapResponse<TavioPage>(response);
		if (!page || !Array.isArray(page.items)) throw new TypeError('Resposta de paginação inválida');
		items.push(...page.items);
		cursor = page.nextCursor;
	} while (cursor && (returnAll || items.length < limit));
	return { items: returnAll ? items : items.slice(0, limit), rawPages };
}

export function compactObject(value: IDataObject): IDataObject {
	return Object.fromEntries(
		Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
	) as IDataObject;
}

export function asDataObject(value: unknown): IDataObject {
	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		return value as IDataObject;
	}
	return { value: value as GenericValue };
}
