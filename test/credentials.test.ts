import { describe, expect, it } from 'vitest';
import { AfforestationApi } from '../credentials/AfforestationApi.credentials';

describe('AfforestationApi credential', () => {
	const c = new AfforestationApi();

	it('is named afforestationApi', () => expect(c.name).toBe('afforestationApi'));

	it('sends a bearer token', () =>
		expect(c.authenticate).toMatchObject({
			type: 'generic',
			properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
		}));

	it('tests against /api/v1/stats', () => expect(c.test.request.url).toBe('/api/v1/stats'));

	it('defaults baseUrl', () =>
		expect(c.properties.find((p) => p.name === 'baseUrl')?.default).toBe(
			'https://afforestation.org',
		));
});
