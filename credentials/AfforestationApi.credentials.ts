import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AfforestationApi implements ICredentialType {
	name = 'afforestationApi';

	displayName = 'Afforestation API';

	icon: Icon = {
		light: 'file:../icons/afforestation.svg',
		dark: 'file:../icons/afforestation.dark.svg',
	};

	documentationUrl = 'https://www.npmjs.com/package/n8n-nodes-afforestation#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your Afforestation.org API key. It starts with afor_ and is under Dashboard > API Keys.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://afforestation.org',
			description: 'Only change this for a staging or local environment',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ ($credentials.baseUrl || "https://afforestation.org").replace(/\\/+$/, "") }}',
			url: '/api/v1/stats',
		},
	};
}
