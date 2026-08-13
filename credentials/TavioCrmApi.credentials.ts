import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TavioCrmApi implements ICredentialType {
	name = 'tavioCrmApi';
	displayName = 'Tavio CRM API';
	icon = 'file:../nodes/TavioCrm/tavio-crm.png' as const;
	documentationUrl = 'https://github.com/fabrica-design/n8n-nodes-tavio-crm#credenciais';

	properties: INodeProperties[] = [
		{
			displayName: 'URL da API',
			name: 'baseUrl',
			type: 'string',
			default: 'https://crm.tavio.com.br/api/v1',
			required: true,
			placeholder: 'https://crm.tavio.com.br/api/v1',
			description: 'URL HTTPS da API Tavio CRM, incluindo /api/v1',
		},
		{
			displayName: 'Chave da API',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
			url: '/auth/session',
			method: 'GET',
		},
	};
}
