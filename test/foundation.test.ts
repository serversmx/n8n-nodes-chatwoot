import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { IDataObject, ILoadOptionsFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import { ChatwootTrigger } from '../nodes/Chatwoot/ChatwootTrigger.node';
import {
  buildMultipartFormData,
  chatwootApiRequest,
  chatwootApiRequestAllItems,
  chatwootApiRequestAllMessages,
  chatwootApiV2Request,
  chatwootMultipartRequest,
  chatwootPlatformApiRequest,
  chatwootPlatformApiRequestAllItems,
  chatwootPublicApiRequest,
  computeRetryDelay,
  DEFAULT_RETRY_POLICY,
  extractChatwootErrorMessage,
  extractItems,
  getAgents,
  getHttpStatus,
  getPaginationMeta,
  getRetryAfterMs,
  isRetryableRequest,
  MAX_RETRIES_LIMIT,
  normalizeQueryParams,
  resolveRetryPolicy,
} from '../nodes/Chatwoot/GenericFunctions';
import { ChatwootApi } from '../credentials/ChatwootApi.credentials';
import { ChatwootPlatformApi } from '../credentials/ChatwootPlatformApi.credentials';
import { ChatwootPublicApi } from '../credentials/ChatwootPublicApi.credentials';
import {
  binaryItem,
  createMockExecuteFunctions,
  createMockHookFunctions,
  createMockWebhookFunctions,
  httpError,
  mockRetrySleep,
  networkError,
  runChatwootNode,
  serializeQuery,
} from './helpers/mockExecuteFunctions';
import type { MockResponse, RecordedCall } from './helpers/mockExecuteFunctions';

const BASE = 'https://chatwoot.test';
const APP = `${BASE}/api/v1/accounts/1`;

let retrySleep: ReturnType<typeof mockRetrySleep>;
beforeEach(() => {
  retrySleep = mockRetrySleep();
});
afterEach(() => {
  retrySleep.restore();
});

function mockCtx(responses: MockResponse[] = [], items?: INodeExecutionData[]) {
  return createMockExecuteFunctions({ responses, items });
}

async function captureError(promise: Promise<unknown>): Promise<NodeApiError> {
  try {
    await promise;
  } catch (error) {
    return error as NodeApiError;
  }
  throw new Error('Expected the promise to reject');
}

// ============================================================================
// Request core
// ============================================================================

describe('request core', () => {
  it('Application API: account URL, api_access_token header, JSON only when a body is sent', async () => {
    const mock = mockCtx([{ method: 'GET', url: `${APP}/conversations/5`, body: { id: 5 } }]);
    const result = await chatwootApiRequest.call(mock.ctx, 'GET', '/conversations/5');

    expect(result).toEqual({ id: 5 });
    const [call] = mock.calls;
    expect(call.url).toBe(`${APP}/conversations/5`);
    expect(call.headers).toEqual({ api_access_token: 'test-token' });
    expect(call.body).toBeUndefined();
    expect(call.qs).toBeUndefined();
    expect(call.options.json).toBe(true);
  });

  it('Application API v2 uses /api/v2/accounts/{id}', async () => {
    const mock = mockCtx([{ url: `${BASE}/api/v2/accounts/1/reports/summary`, body: {} }]);
    await chatwootApiV2Request.call(mock.ctx, 'GET', '/reports/summary');
    expect(mock.calls[0].path).toBe('/api/v2/accounts/1/reports/summary');
  });

  it('Platform API uses /platform/api/v1 and the platform token', async () => {
    const mock = mockCtx([
      { url: `${BASE}/platform/api/v1/accounts`, method: 'POST', body: { id: 9 } },
    ]);
    await chatwootPlatformApiRequest.call(mock.ctx, 'POST', '/accounts', { name: 'Acme' });
    const [call] = mock.calls;
    expect(call.headers.api_access_token).toBe('platform-token');
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(call.body).toEqual({ name: 'Acme' });
  });

  it('Public API uses /public/api/v1 and sends no auth header', async () => {
    const mock = mockCtx([
      { url: '/public/api/v1/inboxes/abc/contacts', body: { source_id: 's1' } },
    ]);
    await chatwootPublicApiRequest.call(mock.ctx, 'POST', '/inboxes/abc/contacts', {
      name: 'Jane',
    });
    const [call] = mock.calls;
    expect(call.url).toBe(`${BASE}/public/api/v1/inboxes/abc/contacts`);
    expect(call.headers).not.toHaveProperty('api_access_token');
    expect(call.body).toEqual({ name: 'Jane' });
  });

  it('never uses the legacy helpers.request', async () => {
    const mock = mockCtx([{ url: '/agents', body: [] }]);
    await chatwootApiRequest.call(mock.ctx, 'GET', '/agents');
    expect(mock.calls).toHaveLength(1);
    const source = readFileSync(join(__dirname, '../nodes/Chatwoot/GenericFunctions.ts'), 'utf8');
    expect(source).not.toMatch(/helpers\.request\b/);
    expect(source).not.toMatch(/IRequestOptions/);
  });

  it('rejects a Base URL without protocol with a NodeOperationError', async () => {
    const mock = createMockExecuteFunctions({
      credentials: { chatwootApi: { baseUrl: 'chatwoot.test', accountId: 1, apiAccessToken: 't' } },
    });
    await expect(chatwootApiRequest.call(mock.ctx, 'GET', '/agents')).rejects.toBeInstanceOf(
      NodeOperationError,
    );
    expect(mock.calls).toHaveLength(0);
  });

  it('passes extra headers, returnFullResponse and encoding through', async () => {
    const mock = mockCtx([
      { url: '/csat_survey_responses/download', body: 'a,b', headers: { 'x-a': '1' } },
    ]);
    const full = (await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/csat_survey_responses/download',
      {},
      {},
      { returnFullResponse: true, encoding: 'text', headers: { Accept: 'text/csv' } },
    )) as unknown as { body: string; statusCode: number };
    expect(full.body).toBe('a,b');
    expect(full.statusCode).toBe(200);
    expect(mock.calls[0].options.encoding).toBe('text');
    expect(mock.calls[0].headers.Accept).toBe('text/csv');
  });
});

// ============================================================================
// Bodies (DELETE included)
// ============================================================================

describe('request bodies', () => {
  it('sends a non-empty JSON body on DELETE (ADMIN-3 / PLATPUB-2 / RELEASE-4)', async () => {
    const mock = mockCtx([{ method: 'DELETE', url: '/teams/5/team_members', body: {} }]);
    await chatwootApiRequest.call(mock.ctx, 'DELETE', '/teams/5/team_members', {
      user_ids: [1, 2],
    });
    const [call] = mock.calls;
    expect(call.method).toBe('DELETE');
    expect(call.body).toEqual({ user_ids: [1, 2] });
    expect(call.headers['Content-Type']).toBe('application/json');
  });

  it('sends the body on Platform DELETE /accounts/:id/account_users', async () => {
    const mock = mockCtx([{ method: 'DELETE', url: '/platform/api/v1/accounts/3/account_users' }]);
    await chatwootPlatformApiRequest.call(mock.ctx, 'DELETE', '/accounts/3/account_users', {
      user_id: 7,
    });
    expect(mock.calls[0].body).toEqual({ user_id: 7 });
  });

  it('omits an empty body on DELETE and never sends a body on GET', async () => {
    const mock = mockCtx([
      { method: 'DELETE', url: '/labels/1' },
      { method: 'GET', url: '/labels' },
    ]);
    await chatwootApiRequest.call(mock.ctx, 'DELETE', '/labels/1');
    await chatwootApiRequest.call(mock.ctx, 'GET', '/labels', { ignored: true });
    expect(mock.calls[0].body).toBeUndefined();
    expect(mock.calls[0].headers).not.toHaveProperty('Content-Type');
    expect(mock.calls[1].body).toBeUndefined();
  });

  it.each(['POST', 'PUT', 'PATCH'] as const)('sends a non-empty body on %s', async (method) => {
    const mock = mockCtx([{ method, url: '/contacts/1' }]);
    await chatwootApiRequest.call(mock.ctx, method, '/contacts/1', { name: 'x' });
    expect(mock.calls[0].body).toEqual({ name: 'x' });
  });
});

describe('empty responses (Chatwoot `head :ok`)', () => {
  it('resolve to {} instead of the empty string n8n returns', async () => {
    const mock = mockCtx([
      { method: 'DELETE', url: '/teams/5/team_members', body: '' },
      { method: 'POST', url: '/conversations/1/toggle_typing_status' },
    ]);
    await expect(
      chatwootApiRequest.call(mock.ctx, 'DELETE', '/teams/5/team_members', { user_ids: [1] }),
    ).resolves.toEqual({});
    await expect(
      chatwootApiRequest.call(mock.ctx, 'POST', '/conversations/1/toggle_typing_status', {
        typing_status: 'on',
      }),
    ).resolves.toEqual({});
  });

  it('keep raw text / binary / full responses untouched', async () => {
    const mock = mockCtx([{ url: '/download', body: '', times: Infinity }]);
    await expect(
      chatwootApiRequest.call(mock.ctx, 'GET', '/download', {}, {}, { encoding: 'text' }),
    ).resolves.toBe('');
    const full = (await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/download',
      {},
      {},
      { returnFullResponse: true },
    )) as unknown as { body: unknown };
    expect(full.body).toBe('');
  });

  it('execute-level: team deleteAgent with the real empty 200 response emits an object item', async () => {
    const { output } = await runChatwootNode({
      params: { resource: 'team', operation: 'deleteAgent', teamId: 5, userIds: '1' },
      responses: [{ method: 'DELETE', url: '/teams/5/team_members' }],
    });
    // The branch reports what was removed instead of the empty `head :ok` body
    expect(output[0]).toEqual([
      { json: { success: true, teamId: 5, userIds: [1] }, pairedItem: { item: 0 } },
    ]);
  });
});

// ============================================================================
// Query serialization
// ============================================================================

describe('query serialization', () => {
  it("serializes arrays with arrayFormat 'brackets' (labels[]=a&labels[]=b)", async () => {
    const mock = mockCtx([{ url: '/conversations' }]);
    await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/conversations',
      {},
      { labels: ['a', 'b'], page: 1 },
    );
    const [call] = mock.calls;
    expect(call.arrayFormat).toBe('brackets');
    expect(call.queryString).toBe('labels[]=a&labels[]=b&page=1');
  });

  it("normalizes keys that already end in '[]' (GAP-5)", async () => {
    const mock = mockCtx([{ url: '/notifications' }, { url: '/reports/inbox_label_matrix' }]);
    await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/notifications',
      {},
      {
        'includes[]': ['read', 'snoozed'],
      },
    );
    await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/reports/inbox_label_matrix',
      {},
      {
        'inbox_ids[]': [1, 2],
        'label_ids[]': 3,
      },
    );
    expect(mock.calls[0].qs).toEqual({ includes: ['read', 'snoozed'] });
    expect(mock.calls[0].queryString).toBe('includes[]=read&includes[]=snoozed');
    expect(mock.calls[1].queryString).toBe('inbox_ids[]=1&inbox_ids[]=2&label_ids[]=3');
  });

  it('documents the bug being fixed: n8n default indices + [] key', () => {
    expect(serializeQuery({ 'includes[]': ['read'] }, 'indices')).toBe('includes[][0]=read');
    expect(serializeQuery({ 'includes[]': ['read'] }, 'brackets')).toBe('includes[][]=read');
    expect(serializeQuery(normalizeQueryParams({ 'includes[]': ['read'] }), 'brackets')).toBe(
      'includes[]=read',
    );
  });

  it('normalizeQueryParams drops undefined, merges key and key[] and keeps nested objects', () => {
    expect(
      normalizeQueryParams({ a: undefined, 'x[]': ['1'], x: '2', nested: { k: [1] }, page: 2 }),
    ).toEqual({ x: ['1', '2'], nested: { k: [1] }, page: 2 });
  });

  it('respects an explicit arrayFormat without normalizing keys', async () => {
    const mock = mockCtx([{ url: '/x' }]);
    await chatwootApiRequest.call(
      mock.ctx,
      'GET',
      '/x',
      {},
      { ids: [1, 2] },
      { arrayFormat: 'indices' },
    );
    expect(mock.calls[0].queryString).toBe('ids[0]=1&ids[1]=2');
  });

  it('notification getAll (node) sends includes[]=read&includes[]=snoozed', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'getAll',
        returnAll: false,
        limit: 5,
        options: { includes_read: true, includes_snoozed: true },
      },
      responses: [{ url: '/notifications', body: { data: { meta: {}, payload: [{ id: 1 }] } } }],
    });
    expect(calls[0].queryString).toBe('includes[]=read&includes[]=snoozed&page=1');
    expect(output[0].map((item) => item.json)).toEqual([{ id: 1 }]);
  });
});

// ============================================================================
// Multipart
// ============================================================================

describe('multipart', () => {
  const items = [
    {
      json: {},
      binary: {
        ...binaryItem({ content: 'hello', fileName: 'a.txt', mimeType: 'text/plain' }).binary,
        ...binaryItem({
          content: Buffer.from([1, 2, 3]),
          fileName: 'b.png',
          mimeType: 'image/png',
          propertyName: 'data2',
        }).binary,
      },
    },
  ];

  it('sends fields, repeated attachments[] files and a JSON field as multipart/form-data', async () => {
    const mock = mockCtx(
      [{ method: 'POST', url: '/conversations/7/messages', body: { id: 1 } }],
      items,
    );
    const result = await chatwootMultipartRequest.call(
      mock.ctx,
      'POST',
      '/conversations/7/messages',
      0,
      {
        fields: {
          content: 'Hi',
          message_type: 'outgoing',
          private: false,
          echo: 5,
          skipped: undefined,
        },
        jsonFields: { content_attributes: '{"in_reply_to": 42}' },
        files: [
          { fieldName: 'attachments[]', binaryPropertyName: 'data' },
          { fieldName: 'attachments[]', binaryPropertyName: 'data2', fileName: 'renamed.png' },
        ],
      },
    );

    expect(result).toEqual({ id: 1 });
    const [call] = mock.calls;
    expect(call.body).toBeInstanceOf(FormData);
    expect(call.headers).toEqual({ api_access_token: 'test-token' });
    expect(call.formData).toEqual([
      { name: 'content', kind: 'field', value: 'Hi' },
      { name: 'message_type', kind: 'field', value: 'outgoing' },
      { name: 'private', kind: 'field', value: 'false' },
      { name: 'echo', kind: 'field', value: '5' },
      { name: 'content_attributes', kind: 'field', value: '{"in_reply_to":42}' },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'a.txt',
        mimeType: 'text/plain',
        size: 5,
        content: Buffer.from('hello'),
      },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'renamed.png',
        mimeType: 'image/png',
        size: 3,
        content: Buffer.from([1, 2, 3]),
      },
    ]);
  });

  it('appends array fields as repeated name[] entries and objects as JSON', async () => {
    const mock = mockCtx([], items);
    const form = await buildMultipartFormData.call(mock.ctx, 0, {
      fields: { labels: ['a', 'b'], 'ids[]': [1], meta: { a: 1 } },
      jsonFields: { content_attributes: { items: [] } },
    });
    expect([...form.entries()]).toEqual([
      ['labels[]', 'a'],
      ['labels[]', 'b'],
      ['ids[]', '1'],
      ['meta', '{"a":1}'],
      ['content_attributes', '{"items":[]}'],
    ]);
  });

  it('drops a user-provided Content-Type so the multipart boundary is kept', async () => {
    const mock = mockCtx(
      [{ url: '/public/api/v1/inboxes/i/contacts/c/conversations/1/messages' }],
      items,
    );
    await chatwootMultipartRequest.call(
      mock.ctx,
      'POST',
      '/inboxes/i/contacts/c/conversations/1/messages',
      0,
      {
        fields: { content: 'x' },
        files: [{ fieldName: 'attachments[]', binaryPropertyName: 'data' }],
      },
      { api: 'public', headers: { 'content-type': 'application/json' } },
    );
    expect(mock.calls[0].headers).toEqual({});
    expect(mock.calls[0].formData?.[1]).toMatchObject({ kind: 'file', fileName: 'a.txt' });
  });

  it('the positional itemIndex (the item with the files) wins over options.itemIndex', async () => {
    const twoItems = [{ json: {} }, ...items];
    const mock = mockCtx(
      [{ method: 'POST', url: '/conversations/7/messages', status: 422, body: { error: 'bad' } }],
      twoItems,
    );
    const error = await captureError(
      chatwootMultipartRequest.call(
        mock.ctx,
        'POST',
        '/conversations/7/messages',
        1,
        { files: [{ fieldName: 'attachments[]', binaryPropertyName: 'data' }] },
        { itemIndex: 0 },
      ),
    );
    expect(error.context.itemIndex).toBe(1);
    expect(mock.calls[0].formData?.[0]).toMatchObject({ kind: 'file', fileName: 'a.txt' });
  });

  it('reports invalid JSON fields and missing binary data as NodeOperationError with itemIndex', async () => {
    const mock = mockCtx([], items);
    const jsonError = await captureError(
      buildMultipartFormData.call(mock.ctx, 0, { jsonFields: { content_attributes: '{bad' } }),
    );
    expect(jsonError).toBeInstanceOf(NodeOperationError);
    expect(jsonError.message).toContain('Invalid JSON in "content_attributes"');
    expect(jsonError.context.itemIndex).toBe(0);

    const binaryError = await captureError(
      buildMultipartFormData.call(mock.ctx, 0, {
        files: [{ fieldName: 'attachments[]', binaryPropertyName: 'missing' }],
      }),
    );
    expect(binaryError).toBeInstanceOf(NodeOperationError);
    expect(binaryError.message).toContain("no binary field 'missing'");
  });
});

// ============================================================================
// Errors
// ============================================================================

describe('error handling', () => {
  async function failWith(status: number, body: unknown, method: 'GET' | 'POST' = 'GET') {
    const mock = mockCtx([{ url: '/custom_attribute_definitions', status, body, times: Infinity }]);
    const error = await captureError(
      chatwootApiRequest.call(
        mock.ctx,
        method,
        '/custom_attribute_definitions',
        {},
        {},
        {
          itemIndex: 2,
          retry: false,
        },
      ),
    );
    return { error, mock };
  }

  it('401 Invalid Access Token: server message + token hint', async () => {
    const { error } = await failWith(401, { error: 'Invalid Access Token' });
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('Chatwoot API error 401 Unauthorized: Invalid Access Token');
    expect(error.description).toContain('Profile Settings → Access Token');
    expect(error.description).toContain(
      'Request: GET /api/v1/accounts/1/custom_attribute_definitions',
    );
    expect(error.httpCode).toBe('401');
    expect(error.context.itemIndex).toBe(2);
    // legacy numeric statusCode kept for older callers
    expect((error as unknown as { statusCode: number }).statusCode).toBe(401);
  });

  it('401 authorization failure (4.14+) is not reported as an invalid token', async () => {
    const { error } = await failWith(401, { error: 'You are not authorized to do this action' });
    expect(error.message).toBe(
      'Chatwoot API error 401 Unauthorized: You are not authorized to do this action',
    );
    expect(error.description).toContain('administrator');
    expect(error.description).toContain('SLA');
    expect(error.description).not.toMatch(/token was rejected/);
  });

  it('401 without a known message explains both meanings', async () => {
    const { error } = await failWith(401, '');
    expect(error.message).toBe('Chatwoot API error 401 Unauthorized');
    expect(error.description).toContain('both for an invalid or revoked access token');
  });

  it('402 plan limit', async () => {
    const { error } = await failWith(402, {
      error: 'Email transcript is not available on your plan',
    });
    expect(error.message).toContain('402 Payment Required: Email transcript is not available');
    expect(error.description).toContain('plan');
  });

  it('403 feature disabled / plan', async () => {
    const { error } = await failWith(403, { error: 'API access is not enabled for this account' });
    expect(error.message).toBe(
      'Chatwoot API error 403 Forbidden: API access is not enabled for this account',
    );
    expect(error.description).toContain('feature may be disabled');
  });

  it('404 with Chatwoot message', async () => {
    const { error } = await failWith(404, { error: 'Resource could not be found' });
    expect(error.message).toBe('Chatwoot API error 404 Not Found: Resource could not be found');
    expect(error.description).toContain('Account ID');
  });

  it('404 HTML page falls back to the status text', async () => {
    const { error } = await failWith(
      404,
      '<html><body>The page you were looking for</body></html>',
    );
    expect(error.message).toBe('Chatwoot API error 404 Not Found');
  });

  it('does not repeat the status text when the body only carries it (Rails default JSON errors)', async () => {
    const { error } = await failWith(404, { status: 404, error: 'Not Found' });
    expect(error.message).toBe('Chatwoot API error 404 Not Found');
  });

  it('422 RecordInvalid { message, attributes } surfaces validation details', async () => {
    const { error } = await failWith(
      422,
      { message: 'Name has already been taken', attributes: ['name'] },
      'POST',
    );
    expect(error.message).toBe(
      'Chatwoot API error 422 Unprocessable Entity: Name has already been taken (attributes: name)',
    );
    expect(error.description).toContain('validation error');
    expect(error.context.data).toEqual({
      message: 'Name has already been taken',
      attributes: ['name'],
    });
  });

  it('429 rate limit mentions real limits and RACK_ATTACK_ALLOWED_IPS', async () => {
    const { error } = await failWith(429, 'Retry later\n');
    expect(error.message).toBe('Chatwoot API error 429 Too Many Requests: Retry later');
    expect(error.description).toContain('RACK_ATTACK_ALLOWED_IPS');
    expect(error.description).toContain('contact search 100/min');
  });

  it('503 and network errors', async () => {
    const { error } = await failWith(503, '');
    expect(error.description).toContain('temporarily unavailable');

    const mock = mockCtx([{ url: '/agents', error: networkError('ECONNREFUSED') }]);
    const netError = await captureError(chatwootApiRequest.call(mock.ctx, 'GET', '/agents'));
    expect(netError).toBeInstanceOf(NodeApiError);
    // n8n maps transport codes itself (httpCode carries the code, not an HTTP status)
    expect(netError.message).toContain('refused the connection');
    expect(getHttpStatus(netError)).toBeUndefined();
    expect(netError.description).toContain('Could not reach Chatwoot (ECONNREFUSED)');
  });

  it('Platform and Public API errors use their own label and hints', async () => {
    const mock = mockCtx([
      {
        url: '/platform/api/v1/accounts/1',
        status: 401,
        body: { error: 'Non permissible resource' },
      },
      {
        url: '/public/api/v1/inboxes/x/contacts/y',
        status: 404,
        body: { error: 'Resource could not be found' },
      },
    ]);
    const platformError = await captureError(
      chatwootPlatformApiRequest.call(mock.ctx, 'GET', '/accounts/1'),
    );
    expect(platformError.message).toBe(
      'Chatwoot Platform API error 401 Unauthorized: Non permissible resource',
    );
    expect(platformError.description).toContain('Platform App');
    const publicError = await captureError(
      chatwootPublicApiRequest.call(mock.ctx, 'GET', '/inboxes/x/contacts/y'),
    );
    expect(publicError.message).toContain('Chatwoot Public API error 404');
    expect(publicError.description).toContain('inbox identifier');
  });

  it('extractChatwootErrorMessage handles every Chatwoot error shape', () => {
    expect(extractChatwootErrorMessage({ error: 'Invalid participant IDs' })).toBe(
      'Invalid participant IDs',
    );
    expect(extractChatwootErrorMessage({ errors: ['Email is invalid', 'Name is missing'] })).toBe(
      'Email is invalid; Name is missing',
    );
    expect(extractChatwootErrorMessage({ error: { name: ["can't be blank"] } })).toBe(
      "name can't be blank",
    );
    expect(extractChatwootErrorMessage({ error: {}, message: 'boom' })).toBe('boom');
    expect(extractChatwootErrorMessage({ description: 'desc' })).toBe('desc');
    expect(extractChatwootErrorMessage({ attributes: ['email'] })).toBe(
      'Invalid attributes: email',
    );
    expect(extractChatwootErrorMessage('{"error":"json in a string"}')).toBe('json in a string');
    expect(extractChatwootErrorMessage(Buffer.from('{"message":"buffer"}'))).toBe('buffer');
    expect(extractChatwootErrorMessage('<html></html>')).toBeUndefined();
    expect(extractChatwootErrorMessage(undefined)).toBeUndefined();
  });

  it('getHttpStatus reads every error shape (N8N-11)', () => {
    expect(getHttpStatus(httpError(404))).toBe(404);
    expect(getHttpStatus({ statusCode: 500 })).toBe(500);
    expect(getHttpStatus({ httpCode: '422' })).toBe(422);
    expect(getHttpStatus({ httpCode: 'ECONNREFUSED' })).toBeUndefined();
    expect(getHttpStatus({ message: 'wrapped', cause: httpError(429) })).toBe(429);
    expect(getHttpStatus({ response: { statusCode: 403 } })).toBe(403);
    expect(getHttpStatus(networkError())).toBeUndefined();
    expect(getHttpStatus(new Error('plain'))).toBeUndefined();
  });

  it('ChatwootTrigger.checkExists now only swallows 404 (legacy statusCode compat)', async () => {
    const trigger = new ChatwootTrigger();
    const notFound = createMockHookFunctions({
      params: { events: ['message_created'] },
      responses: [
        { url: '/webhooks', status: 404, body: { error: 'Resource could not be found' } },
      ],
    });
    await expect(trigger.webhookMethods.default.checkExists.call(notFound.ctx)).resolves.toBe(
      false,
    );

    const unauthorized = createMockHookFunctions({
      params: { events: ['message_created'] },
      responses: [{ url: '/webhooks', status: 401, body: { error: 'Invalid Access Token' } }],
    });
    await expect(trigger.webhookMethods.default.checkExists.call(unauthorized.ctx)).rejects.toThrow(
      'Invalid Access Token',
    );
  });

  it('loadOptions show errors instead of an empty list (404 still returns [])', async () => {
    const unauthorized = mockCtx([
      { url: '/agents', status: 401, body: { error: 'Invalid Access Token' } },
    ]);
    await expect(
      getAgents.call(unauthorized.ctx as unknown as ILoadOptionsFunctions),
    ).rejects.toThrow('401');
    const missing = mockCtx([{ url: '/agents', status: 404 }]);
    await expect(getAgents.call(missing.ctx as unknown as ILoadOptionsFunctions)).resolves.toEqual(
      [],
    );
  });
});

// ============================================================================
// Retries
// ============================================================================

describe('retries', () => {
  it('retries GET on 503 and succeeds', async () => {
    const mock = mockCtx([
      { url: '/agents', status: 503 },
      { url: '/agents', body: [{ id: 1 }] },
    ]);
    await expect(chatwootApiRequest.call(mock.ctx, 'GET', '/agents')).resolves.toEqual([{ id: 1 }]);
    expect(mock.calls).toHaveLength(2);
    expect(retrySleep.delays).toHaveLength(1);
    expect(retrySleep.delays[0]).toBeGreaterThanOrEqual(500);
    expect(retrySleep.delays[0]).toBeLessThanOrEqual(1000);
  });

  it('does NOT retry POST on 502 (not idempotent)', async () => {
    const mock = mockCtx([{ method: 'POST', url: '/contacts', status: 502, times: Infinity }]);
    const error = await captureError(
      chatwootApiRequest.call(mock.ctx, 'POST', '/contacts', { a: 1 }),
    );
    expect(mock.calls).toHaveLength(1);
    expect(retrySleep.delays).toEqual([]);
    expect(error.httpCode).toBe('502');
    expect(error.description).toContain('Not retried automatically because POST');
  });

  it('does not retry PATCH on 503 nor any method on 500', async () => {
    const mock = mockCtx([
      { method: 'PATCH', url: '/contacts/1', status: 503 },
      { method: 'GET', url: '/contacts/1', status: 500 },
    ]);
    await captureError(chatwootApiRequest.call(mock.ctx, 'PATCH', '/contacts/1', { a: 1 }));
    await captureError(chatwootApiRequest.call(mock.ctx, 'GET', '/contacts/1'));
    expect(mock.calls).toHaveLength(2);
  });

  it.each(['PUT', 'DELETE'] as const)('retries %s on 504', async (method) => {
    const mock = mockCtx([
      { method, url: '/contacts/1', status: 504 },
      { method, url: '/contacts/1', body: { ok: true } },
    ]);
    await chatwootApiRequest.call(mock.ctx, method, '/contacts/1', { a: 1 });
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[1].body).toEqual({ a: 1 });
  });

  it('retries POST on 429 (request was rejected) and honors Retry-After', async () => {
    const mock = mockCtx([
      {
        method: 'POST',
        url: '/conversations',
        status: 429,
        body: 'Retry later',
        headers: { 'Retry-After': '7' },
      },
      { method: 'POST', url: '/conversations', body: { id: 3 } },
    ]);
    await expect(
      chatwootApiRequest.call(mock.ctx, 'POST', '/conversations', { a: 1 }),
    ).resolves.toEqual({ id: 3 });
    expect(retrySleep.delays).toEqual([7000]);
  });

  it('gives up after 3 retries with exponential backoff + jitter', async () => {
    const mock = mockCtx([
      { url: '/contacts/search', status: 429, body: 'Retry later', times: Infinity },
    ]);
    const error = await captureError(chatwootApiRequest.call(mock.ctx, 'GET', '/contacts/search'));
    expect(mock.calls).toHaveLength(4);
    expect(retrySleep.delays).toHaveLength(3);
    const [first, second, third] = retrySleep.delays;
    expect(first).toBeGreaterThanOrEqual(2500);
    expect(first).toBeLessThanOrEqual(5000);
    expect(second).toBeGreaterThanOrEqual(5000);
    expect(second).toBeLessThanOrEqual(10000);
    expect(third).toBeGreaterThanOrEqual(10000);
    expect(third).toBeLessThanOrEqual(20000);
    expect(error.description).toContain('Retried 3 times with exponential backoff');
  });

  it('ignores invalid retry overrides so retries stay bounded (no infinite loop / NaN delays)', async () => {
    for (const retry of [
      { maxRetries: undefined, rateLimitBaseDelayMs: undefined },
      { maxRetries: Number.NaN, maxDelayMs: Number.NaN },
      { maxRetries: -1 },
      { maxRetries: Infinity },
    ]) {
      const delays = retrySleep.delays.length;
      const mock = mockCtx([{ url: '/agents', status: 429, body: 'Retry later', times: Infinity }]);
      await captureError(chatwootApiRequest.call(mock.ctx, 'GET', '/agents', {}, {}, { retry }));
      expect(mock.calls).toHaveLength(4);
      const waited = retrySleep.delays.slice(delays);
      expect(waited.every((ms) => Number.isFinite(ms) && ms >= 0)).toBe(true);
    }
    expect(resolveRetryPolicy({ maxRetries: 1000 })).toMatchObject({
      maxRetries: MAX_RETRIES_LIMIT,
    });
    expect(resolveRetryPolicy({ maxRetries: 2.7, baseDelayMs: 0 })).toMatchObject({
      maxRetries: 2,
      baseDelayMs: 0,
    });
    expect(resolveRetryPolicy(false)).toBe(false);
  });

  it('retry can be disabled or tuned per request', async () => {
    const mock = mockCtx([{ url: '/agents', status: 503, times: Infinity }]);
    await captureError(
      chatwootApiRequest.call(mock.ctx, 'GET', '/agents', {}, {}, { retry: false }),
    );
    expect(mock.calls).toHaveLength(1);
    await captureError(
      chatwootApiRequest.call(mock.ctx, 'GET', '/agents', {}, {}, { retry: { maxRetries: 1 } }),
    );
    expect(mock.calls).toHaveLength(3);
  });

  it('computeRetryDelay: jitter bounds, cap and Retry-After cap', () => {
    const policy = DEFAULT_RETRY_POLICY;
    expect(computeRetryDelay(1, 503, undefined, policy, () => 0)).toBe(500);
    expect(computeRetryDelay(1, 503, undefined, policy, () => 1)).toBe(1000);
    expect(computeRetryDelay(3, 503, undefined, policy, () => 1)).toBe(4000);
    expect(computeRetryDelay(1, 429, undefined, policy, () => 0)).toBe(2500);
    expect(computeRetryDelay(10, 429, undefined, policy, () => 1)).toBe(60000);
    expect(computeRetryDelay(1, 429, 120000, policy)).toBe(60000);
    expect(computeRetryDelay(1, 429, 0, policy)).toBe(0);
  });

  it('isRetryableRequest and getRetryAfterMs', () => {
    expect(isRetryableRequest('POST', 429)).toBe(true);
    expect(isRetryableRequest('POST', 503)).toBe(false);
    expect(isRetryableRequest('GET', 502)).toBe(true);
    expect(isRetryableRequest('HEAD', 504)).toBe(true);
    expect(isRetryableRequest('GET', 500)).toBe(false);
    expect(isRetryableRequest('GET', undefined)).toBe(false);

    expect(getRetryAfterMs(httpError(429, '', { headers: { 'retry-after': '2' } }))).toBe(2000);
    const now = Date.parse('2026-09-25T12:00:00Z');
    expect(
      getRetryAfterMs(
        httpError(429, '', { headers: { 'Retry-After': 'Fri, 25 Sep 2026 12:00:30 GMT' } }),
        now,
      ),
    ).toBe(30000);
    expect(getRetryAfterMs({ response: { headers: { 'retry-after': ['3'] } } })).toBe(3000);
    expect(getRetryAfterMs(httpError(429))).toBeUndefined();
  });

  it('execute-level: node retries transparently and records the sleeps', async () => {
    const { output, calls, sleeps } = await runChatwootNode({
      params: { resource: 'team', operation: 'get', teamId: 4 },
      responses: [
        { url: '/teams/4', status: 502 },
        { url: '/teams/4', body: { id: 4, name: 'Sales' } },
      ],
    });
    expect(calls).toHaveLength(2);
    expect(sleeps).toHaveLength(1);
    expect(output[0][0].json).toEqual({ id: 4, name: 'Sales' });
  });
});

// ============================================================================
// Page-based pagination
// ============================================================================

function range(from: number, to: number): IDataObject[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i }));
}

function pagesResponder(
  pages: IDataObject[][],
  wrap: (items: IDataObject[], page: number) => unknown,
) {
  return (call: RecordedCall) => {
    const page = Number(call.qs?.page ?? 1);
    return { body: wrap(pages[page - 1] ?? [], page) };
  };
}

describe('chatwootApiRequestAllItems', () => {
  it('keeps the legacy (method, endpoint, body, qs, "payload") signature; ends on meta.count', async () => {
    const pages = [range(1, 15), range(16, 30), range(31, 40)];
    const mock = mockCtx([
      {
        url: '/contacts',
        times: Infinity,
        reply: pagesResponder(pages, (payload, page) => ({
          meta: { count: 40, current_page: page },
          payload,
        })),
      },
    ]);
    const qs = { sort: 'name' };
    const result = await chatwootApiRequestAllItems.call(
      mock.ctx,
      'GET',
      '/contacts',
      {},
      qs,
      'payload',
    );
    expect(result.map((item) => item.id)).toEqual(range(1, 40).map((item) => item.id));
    expect(mock.calls.map((call) => call.qs)).toEqual([
      { sort: 'name', page: 1 },
      { sort: 'name', page: 2 },
      { sort: 'name', page: 3 },
    ]);
    expect(qs).toEqual({ sort: 'name' });
  });

  it('auto-detects { data: { meta, payload } } (conversations, CORE-1) and ends on a short page', async () => {
    const pages = [range(1, 25), range(26, 28)];
    const mock = mockCtx([
      {
        url: '/conversations',
        times: Infinity,
        reply: pagesResponder(pages, (payload) => ({ data: { meta: { mine_count: 0 }, payload } })),
      },
    ]);
    const result = await chatwootApiRequestAllItems.call(
      mock.ctx,
      'GET',
      '/conversations',
      {},
      {},
      'payload',
    );
    expect(result).toHaveLength(28);
    expect(mock.calls).toHaveLength(2);
  });

  it('accepts a dotted path or a function extractor (audit logs: total_entries/per_page)', async () => {
    const pages = [range(1, 25), range(26, 50)];
    const mock = mockCtx([
      {
        url: '/audit_logs',
        times: Infinity,
        reply: pagesResponder(pages, (logs, page) => ({
          audit_logs: logs,
          current_page: page,
          per_page: 25,
          total_entries: 50,
        })),
      },
    ]);
    const byPath = await chatwootApiRequestAllItems.call(
      mock.ctx,
      'GET',
      '/audit_logs',
      {},
      {},
      'audit_logs',
    );
    expect(byPath).toHaveLength(50);
    expect(mock.calls).toHaveLength(2);

    const byFunction = await chatwootApiRequestAllItems.call(
      mock.ctx,
      'GET',
      '/audit_logs',
      {},
      {},
      (response) => (response as IDataObject).audit_logs,
    );
    expect(byFunction).toHaveLength(50);
    expect(mock.calls).toHaveLength(4);
  });

  it('meta.has_more wins over page sizes; total_pages/current_page ends', async () => {
    const hasMore = mockCtx([
      {
        url: '/contacts/search',
        body: { meta: { has_more: true, count: 2 }, payload: range(1, 2) },
      },
      {
        url: '/contacts/search',
        body: { meta: { has_more: false, count: 1 }, payload: range(3, 3) },
      },
    ]);
    const searched = await chatwootApiRequestAllItems.call(
      hasMore.ctx,
      'GET',
      '/contacts/search',
      {},
      { q: 'a' },
    );
    expect(searched).toHaveLength(3);

    const totalPages = mockCtx([
      { url: '/calls', body: { meta: { current_page: 1, total_pages: 1 }, payload: range(1, 25) } },
    ]);
    await chatwootApiRequestAllItems.call(totalPages.ctx, 'GET', '/calls');
    expect(totalPages.calls).toHaveLength(1);
  });

  it('limit: collects across pages and returns the first N', async () => {
    const pages = [range(1, 15), range(16, 30), range(31, 45)];
    const mock = mockCtx([
      {
        url: '/contacts',
        times: Infinity,
        reply: pagesResponder(pages, (payload) => ({ meta: {}, payload })),
      },
    ]);
    const result = await chatwootApiRequestAllItems.call(
      mock.ctx,
      'GET',
      '/contacts',
      {},
      {},
      'payload',
      {
        limit: 20,
      },
    );
    expect(result.map((item) => item.id)).toEqual(range(1, 20).map((item) => item.id));
    expect(mock.calls).toHaveLength(2);
  });

  it('page cap: throws instead of silently truncating', async () => {
    const mock = mockCtx([
      {
        url: '/contacts',
        times: Infinity,
        reply: (call) => {
          const page = Number(call.qs?.page);
          return { body: { payload: range((page - 1) * 15 + 1, page * 15) } };
        },
      },
    ]);
    const error = await captureError(
      chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/contacts', {}, {}, 'payload', {
        maxPages: 3,
        itemIndex: 1,
      }),
    );
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('exceeded 3 pages (45 items so far)');
    expect(error.context.itemIndex).toBe(1);
    expect(mock.calls).toHaveLength(3);
  });

  it('stops when an endpoint ignores the page parameter (repeated page) and on an empty page', async () => {
    const repeated = mockCtx([{ url: '/labels', times: Infinity, body: { payload: range(1, 3) } }]);
    const labels = await chatwootApiRequestAllItems.call(repeated.ctx, 'GET', '/labels');
    expect(labels).toHaveLength(3);
    expect(repeated.calls).toHaveLength(2);

    const empty = mockCtx([{ url: '/labels', body: { payload: [] } }]);
    await expect(chatwootApiRequestAllItems.call(empty.ctx, 'GET', '/labels')).resolves.toEqual([]);
  });

  it('stops on a repeated page of items without ids instead of looping until the cap', async () => {
    const rows = [
      { value: '1', timestamp: 100 },
      { value: '2', timestamp: 200 },
    ];
    const mock = mockCtx([{ url: '/reports', times: Infinity, body: rows }]);
    const result = await chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/reports');
    expect(result).toEqual(rows);
    expect(mock.calls).toHaveLength(2);
  });

  it('platform variant uses the Platform API', async () => {
    const mock = mockCtx([
      { url: '/platform/api/v1/agent_bots', body: range(1, 2) },
      { url: '/platform/api/v1/agent_bots', body: [] },
    ]);
    const bots = await chatwootPlatformApiRequestAllItems.call(mock.ctx, 'GET', '/agent_bots');
    expect(bots).toHaveLength(2);
    expect(mock.calls[0].headers.api_access_token).toBe('platform-token');
  });

  it('extractItems / getPaginationMeta helpers', () => {
    expect(extractItems([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(extractItems({ data: { payload: [{ id: 2 }] } }, 'payload')).toEqual([{ id: 2 }]);
    expect(extractItems({ data: [{ id: 3 }] })).toEqual([{ id: 3 }]);
    expect(extractItems({ x: { y: [{ id: 4 }] } }, 'x.y')).toEqual([{ id: 4 }]);
    expect(extractItems({ x: 1 }, () => 'not an array')).toEqual([]);
    expect(getPaginationMeta({ data: { meta: { all_count: 7 } } })).toEqual({ totalCount: 7 });
    expect(getPaginationMeta({ meta: { count: 3, current_page: '2', has_more: false } })).toEqual({
      hasMore: false,
      currentPage: 2,
      totalCount: 3,
    });
    expect(getPaginationMeta({ count: 5 })).toEqual({});
  });

  it('execute-level: conversation getAll returnAll returns data.payload items', async () => {
    const { output } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'getAll', returnAll: true },
      responses: [
        { url: '/conversations', body: { data: { meta: { all_count: 2 }, payload: range(1, 2) } } },
      ],
    });
    expect(output[0].map((item) => item.json.id)).toEqual([1, 2]);
  });
});

// ============================================================================
// Message cursor pagination
// ============================================================================

const TOTAL_MESSAGES = 45;
const allMessages = Array.from({ length: TOTAL_MESSAGES }, (_, i) => ({
  id: i + 1,
  content: `message ${i + 1}`,
  created_at: 1_700_000_000 + (i + 1) * 60,
}));

/** Simulates Chatwoot MessageFinder: 20 before or 100 after, returned ascending. */
function messageFinder(messages = allMessages) {
  return (call: RecordedCall): { body: unknown } => {
    const before = call.qs?.before === undefined ? Infinity : Number(call.qs.before);
    const page = call.qs?.after !== undefined
      ? messages.filter((message) => message.id > Number(call.qs?.after)).slice(0, 100)
      : messages.filter((message) => message.id < before).slice(-20);
    return { body: { meta: {}, payload: page } };
  };
}

function messagesMock(reply = messageFinder()) {
  return mockCtx([{ method: 'GET', url: '/conversations/9/messages', times: Infinity, reply }]);
}

const ids = (messages: IDataObject[]) => messages.map((message) => message.id);

describe('chatwootApiRequestAllMessages', () => {
  it('returns all 45 messages once, chronological ascending, walking back with the smallest id', async () => {
    const mock = messagesMock();
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9);
    expect(ids(result)).toEqual(allMessages.map((message) => message.id));
    expect(mock.calls.map((call) => call.qs?.before)).toEqual([undefined, 26, 6]);
  });

  it('limit=1 returns only the latest message (1 request)', async () => {
    const mock = messagesMock();
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, 1);
    expect(ids(result)).toEqual([45]);
    expect(mock.calls).toHaveLength(1);
  });

  it('limit=25 returns the 25 most recent, ascending (2 requests)', async () => {
    const mock = messagesMock();
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, 25);
    expect(ids(result)).toEqual(Array.from({ length: 25 }, (_, i) => 21 + i));
    expect(mock.calls).toHaveLength(2);
  });

  it('limit larger than the conversation returns everything', async () => {
    const mock = messagesMock();
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, 50);
    expect(result).toHaveLength(45);
    expect(mock.calls).toHaveLength(3);
  });

  it('supports before/after starting cursors and extra qs', async () => {
    const before = messagesMock();
    const older = await chatwootApiRequestAllMessages.call(before.ctx, 9, undefined, {
      before: 30,
      qs: { filter_internal_messages: true },
    });
    expect(ids(older)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    expect(before.calls[0].qs).toEqual({ filter_internal_messages: true, before: 30 });

    const after = messagesMock();
    const newer = await chatwootApiRequestAllMessages.call(after.ctx, 9, undefined, { after: 40 });
    expect(ids(newer)).toEqual([41, 42, 43, 44, 45]);
    expect(after.calls).toHaveLength(1);

    const afterTen = messagesMock();
    const fromEleven = await chatwootApiRequestAllMessages.call(afterTen.ctx, 9, undefined, {
      after: 10,
    });
    expect(ids(fromEleven)).toEqual(Array.from({ length: 35 }, (_, i) => i + 11));
    expect(afterTen.calls).toHaveLength(1);
  });

  it('uses native after and filters the exclusive before bound client-side', async () => {
    const mock = messagesMock();
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, undefined, {
      qs: { after: 20, before: 40, filter_internal_messages: true },
    });
    expect(ids(result)).toEqual(Array.from({ length: 19 }, (_, i) => i + 21));
    expect(mock.calls.map((call) => call.qs)).toEqual([
      { filter_internal_messages: true, after: 20 },
    ]);
  });

  it('Public API without an endpoint fails clearly instead of calling a wrong URL', async () => {
    const mock = messagesMock();
    const error = await captureError(
      chatwootApiRequestAllMessages.call(mock.ctx, 9, 1, { api: 'public', itemIndex: 2 }),
    );
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('needs the full endpoint');
    expect(error.context.itemIndex).toBe(2);
    expect(mock.calls).toHaveLength(0);
  });

  it('stops on a non-decreasing cursor and dedupes (server ignoring before)', async () => {
    const mock = messagesMock(() => ({ body: { payload: allMessages.slice(-20) } }));
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9);
    expect(ids(result)).toEqual(Array.from({ length: 20 }, (_, i) => 26 + i));
    expect(mock.calls).toHaveLength(2);
  });

  it('sorts by created_at even when a page arrives out of order', async () => {
    const shuffled = [
      { id: 3, created_at: 30 },
      { id: 1, created_at: 10 },
      { id: 2, created_at: 20 },
    ];
    const mock = messagesMock(() => ({ body: { payload: shuffled } }));
    expect(ids(await chatwootApiRequestAllMessages.call(mock.ctx, 9))).toEqual([1, 2, 3]);
  });

  it('page cap throws instead of truncating', async () => {
    const mock = messagesMock();
    const error = await captureError(
      chatwootApiRequestAllMessages.call(mock.ctx, 9, undefined, { maxPages: 2 }),
    );
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('exceeded 2 pages (40 messages so far)');
  });

  it('Public API: root-array responses via { api: "public", endpoint }', async () => {
    const mock = mockCtx([
      {
        url: '/public/api/v1/inboxes/i/contacts/c/conversations/9/messages',
        times: Infinity,
        reply: (call) => ({ body: (messageFinder()(call).body as IDataObject).payload }),
      },
    ]);
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, 3, {
      api: 'public',
      endpoint: '/inboxes/i/contacts/c/conversations/9/messages',
    });
    expect(ids(result)).toEqual([43, 44, 45]);
    expect(mock.calls[0].headers).not.toHaveProperty('api_access_token');
  });

  it('execute-level: message getAll with limit 1 returns the latest message', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'getAll',
        conversationId: 9,
        returnAll: false,
        limit: 1,
      },
      responses: [{ url: '/conversations/9/messages', times: Infinity, reply: messageFinder() }],
    });
    expect(output[0].map((item) => item.json.id)).toEqual([45]);
    expect(calls).toHaveLength(1);
  });
});

// ============================================================================
// Execute-level runs through the real Chatwoot node
// ============================================================================

describe('Chatwoot node execute()', () => {
  it('team deleteAgent sends DELETE with { user_ids } body', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'team', operation: 'deleteAgent', teamId: 5, userIds: '1, 2' },
      responses: [{ method: 'DELETE', url: '/teams/5/team_members', body: [] }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${APP}/teams/5/team_members`);
    expect(calls[0].body).toEqual({ user_ids: [1, 2] });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(output[0].map((item) => item.json)).toEqual([
      { success: true, teamId: 5, userIds: [1, 2] },
    ]);
  });

  it('conversationParticipant remove and platform accountUser delete send their bodies', async () => {
    const participants = await runChatwootNode({
      params: {
        resource: 'conversationParticipant',
        operation: 'remove',
        conversationId: 3,
        userIds: '4',
      },
      responses: [{ method: 'DELETE', url: '/conversations/3/participants', body: [] }],
    });
    expect(participants.calls[0].body).toEqual({ user_ids: [4] });

    const accountUser = await runChatwootNode({
      params: { resource: 'accountUser', operation: 'delete', accountId: 2, userId: 8 },
      responses: [{ method: 'DELETE', url: '/platform/api/v1/accounts/2/account_users' }],
    });
    expect(accountUser.calls[0].body).toEqual({ user_id: 8 });
    expect(accountUser.output[0][0].json).toEqual({ success: true, accountId: 2, userId: 8 });
  });

  it('processes every item with its own parameters and pairs the output', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'team', operation: 'get', teamId: 1 },
      itemParams: [undefined, { teamId: 2 }],
      items: [{ json: {} }, { json: {} }],
      responses: [
        { url: '/teams/1', body: { id: 1 } },
        { url: '/teams/2', body: { id: 2 } },
      ],
    });
    expect(calls.map((call) => call.path)).toEqual([
      '/api/v1/accounts/1/teams/1',
      '/api/v1/accounts/1/teams/2',
    ]);
    expect(output[0]).toEqual([
      { json: { id: 1 }, pairedItem: { item: 0 } },
      { json: { id: 2 }, pairedItem: { item: 1 } },
    ]);
  });

  it('throws NodeApiError with the failing itemIndex', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'team', operation: 'get', teamId: 1 },
      itemParams: [undefined, { teamId: 2 }],
      items: [{ json: {} }, { json: {} }],
      responses: [
        { url: '/teams/1', body: { id: 1 } },
        { url: '/teams/2', status: 404, body: { error: 'Resource could not be found' } },
      ],
    });
    const error = await captureError(new Chatwoot().execute.call(mock.ctx));
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe('Chatwoot API error 404 Not Found: Resource could not be found');
    expect(error.context.itemIndex).toBe(1);
  });

  it('continueOnFail returns error, description and httpCode per item', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'team', operation: 'get', teamId: 1 },
      responses: [{ url: '/teams/1', status: 422, body: { error: 'Invalid team' } }],
    });
    const json = output[0][0].json;
    expect(json.error).toBe('Chatwoot API error 422 Unprocessable Entity: Invalid team');
    expect(json.httpCode).toBe('422');
    expect(json.description).toContain('validation error');
    expect(output[0][0].pairedItem).toEqual({ item: 0 });
  });

  it('continueOnFail omits httpCode for network errors (no HTTP status)', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'team', operation: 'get', teamId: 1 },
      responses: [{ url: '/teams/1', error: networkError('ENOTFOUND') }],
    });
    expect(output[0][0].json.error).toBeTruthy();
    expect(output[0][0].json).not.toHaveProperty('httpCode');
    expect(output[0][0].json.description).toContain('Could not reach Chatwoot (ENOTFOUND)');
  });

  it('wraps plain validation errors into NodeOperationError with itemIndex', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'team', operation: 'get', teamId: 0 },
    });
    const error = await captureError(new Chatwoot().execute.call(mock.ctx));
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('Team ID must be a positive integer');
    expect(error.context.itemIndex).toBe(0);
    expect(mock.calls).toHaveLength(0);
  });
});

// ============================================================================
// n8n 2.x hygiene
// ============================================================================

describe('n8n 2.x hygiene (N8N-6)', () => {
  it('uses NodeConnectionTypes.Main and usableAsTool only on the action node', () => {
    const action = new Chatwoot().description;
    const trigger = new ChatwootTrigger().description;
    expect(action.inputs).toEqual(['main']);
    expect(action.outputs).toEqual(['main']);
    expect(action.usableAsTool).toBe(true);
    expect(trigger.inputs).toEqual([]);
    expect(trigger.outputs).toEqual(['main']);
    expect(trigger.usableAsTool).toBeUndefined();
  });

  it('credentials have an icon that resolves from both source and dist layouts', () => {
    for (const credential of [
      new ChatwootApi(),
      new ChatwootPlatformApi(),
      new ChatwootPublicApi(),
    ]) {
      expect(credential.icon).toEqual({
        light: 'file:../nodes/Chatwoot/chatwoot.svg',
        dark: 'file:../nodes/Chatwoot/chatwoot.svg',
      });
      const iconPath = join(__dirname, '../credentials', '../nodes/Chatwoot/chatwoot.svg');
      expect(existsSync(iconPath)).toBe(true);
    }
  });

  it('package.json: n8n-workflow peer dependency is "*" and icons are copied next to the nodes', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    expect(pkg.peerDependencies).toEqual({ 'n8n-workflow': '*' });
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.scripts['copy:icons']).toContain('nodes/Chatwoot/*.svg');
    expect(pkg.scripts['copy:icons']).toContain('dist/nodes/Chatwoot/');
  });
});

// ============================================================================
// Harness self-checks
// ============================================================================

describe('test harness', () => {
  it('getNodeParameter: dotted paths, fallbacks, description defaults and missing params', () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'contact', operation: 'getAll', options: { sort: 'email' } },
    });
    expect(mock.ctx.getNodeParameter('options.sort', 0)).toBe('email');
    expect(mock.ctx.getNodeParameter('options.missing', 0, 'fallback')).toBe('fallback');
    expect(mock.ctx.getNodeParameter('returnAll', 0)).toBe(false);
    expect(mock.ctx.getNodeParameter('limit', 0)).toBe(50);
    expect(() => mock.ctx.getNodeParameter('doesNotExist', 0)).toThrow('Could not get parameter');
  });

  it('drops parameters n8n would drop (unknown, hidden by displayOptions, unknown options)', () => {
    const params = {
      resource: 'contact',
      operation: 'getAll',
      notAParam: 1,
      teamId: 5, // exists, but only for the team resource
      options: { limit: 5, sort: 'email' }, // `limit` is not an option of this collection
    };
    const strict = createMockExecuteFunctions({ description: new Chatwoot().description, params });
    expect(() => strict.ctx.getNodeParameter('notAParam', 0)).toThrow('Could not get parameter');
    expect(() => strict.ctx.getNodeParameter('teamId', 0)).toThrow('Could not get parameter');
    expect(strict.ctx.getNodeParameter('options', 0)).toEqual({ sort: 'email' });

    const loose = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params,
      keepUnknownParams: true,
    });
    expect(loose.ctx.getNodeParameter('teamId', 0)).toBe(5);
  });

  it('matches string URLs exactly (URL, path or endpoint), with an optional api filter', async () => {
    const mock = mockCtx([
      { url: '/agent_bots', api: 'platform', body: [{ id: 'platform' }] },
      { url: '/agent_bots', body: [{ id: 'application' }] },
    ]);
    expect(await chatwootApiRequest.call(mock.ctx, 'GET', '/agent_bots')).toEqual([
      { id: 'application' },
    ]);
    expect(await chatwootPlatformApiRequest.call(mock.ctx, 'GET', '/agent_bots')).toEqual([
      { id: 'platform' },
    ]);
    expect(mock.calls.map((call) => [call.api, call.endpoint])).toEqual([
      ['application', '/agent_bots'],
      ['platform', '/agent_bots'],
    ]);

    // A partial suffix is not an endpoint: '/1' must not match /api/v1/accounts/1/teams/1
    const partial = mockCtx([{ url: '/1', body: {} }]);
    await expect(chatwootApiRequest.call(partial.ctx, 'GET', '/teams/1')).rejects.toThrow(
      'no response queued',
    );
    // The account root itself is not the platform endpoint '/accounts/1'
    const root = mockCtx([{ url: '/accounts/1', body: {} }]);
    await expect(chatwootApiRequest.call(root.ctx, 'GET', '')).rejects.toThrow(
      'no response queued',
    );
  });

  it('shapes bodies like axios: omitted body is "", JSON text is parsed, arraybuffer is a Buffer', async () => {
    const mock = mockCtx([
      { url: '/raw', body: undefined, times: Infinity },
      { url: '/json-text', body: '[1,2]' },
      { url: '/download', body: 'a,b' },
      { url: '/download-error', status: 404, body: { error: 'gone' } },
    ]);
    const raw = await mock.ctx.helpers.httpRequest({ method: 'GET', url: `${APP}/raw` });
    expect(raw).toBe('');
    expect(await mock.ctx.helpers.httpRequest({ method: 'GET', url: `${APP}/json-text` })).toEqual([
      1, 2,
    ]);
    const file = await mock.ctx.helpers.httpRequest({
      method: 'GET',
      url: `${APP}/download`,
      encoding: 'arraybuffer',
    });
    expect(Buffer.isBuffer(file)).toBe(true);
    const error = await captureError(
      mock.ctx.helpers.httpRequest({
        method: 'GET',
        url: `${APP}/download-error`,
        encoding: 'arraybuffer',
      }),
    );
    const data = (error as unknown as { response: { data: unknown } }).response.data;
    expect(Buffer.isBuffer(data)).toBe(true);
    // ...and the Chatwoot helper still decodes the Buffer error body
    const viaHelper = mockCtx([{ url: '/download-error', status: 404, body: { error: 'gone' } }]);
    const helperError = await captureError(
      chatwootApiRequest.call(
        viaHelper.ctx,
        'GET',
        '/download-error',
        {},
        {},
        {
          encoding: 'arraybuffer',
        },
      ),
    );
    expect(helperError.message).toBe('Chatwoot API error 404 Not Found: gone');
  });

  it('records a snapshot of qs/body (later mutations by the caller do not leak in)', async () => {
    const mock = mockCtx([{ url: `${APP}/x`, times: Infinity }]);
    const qs: IDataObject = { page: 1 };
    const body: IDataObject = { ids: [1] };
    await mock.ctx.helpers.httpRequest({ method: 'POST', url: `${APP}/x`, qs, body });
    qs.page = 2;
    (body.ids as number[]).push(2);
    expect(mock.calls[0].qs).toEqual({ page: 1 });
    expect(mock.calls[0].body).toEqual({ ids: [1] });
  });

  it('runChatwootNode fails when a queued response was never requested', async () => {
    const params = { resource: 'team', operation: 'get', teamId: 1 };
    await expect(
      runChatwootNode({
        params,
        responses: [
          { url: '/teams/1', body: { id: 1 } },
          { url: '/teams/2', body: { id: 2 } },
        ],
      }),
    ).rejects.toThrow('1 queued response(s) never requested: * /teams/2');
    const { output } = await runChatwootNode({
      params,
      allowUnusedResponses: true,
      responses: [
        { url: '/teams/1', body: { id: 1 } },
        { url: '/teams/2', body: { id: 2 } },
      ],
    });
    expect(output[0]).toHaveLength(1);
  });

  it('retries never really wait, even after runChatwootNode restored its recorder', async () => {
    // The file-level beforeEach recorder is active; runChatwootNode must put it back afterwards
    await runChatwootNode({
      params: { resource: 'team', operation: 'get', teamId: 1 },
      responses: [{ url: '/teams/1', body: { id: 1 } }],
    });
    const mock = mockCtx([{ url: '/agents', status: 429, body: 'Retry later', times: Infinity }]);
    const started = Date.now();
    await captureError(chatwootApiRequest.call(mock.ctx, 'GET', '/agents'));
    expect(Date.now() - started).toBeLessThan(1000);
    expect(retrySleep.delays).toHaveLength(3);

    // Without any recorder installed by the test, the harness no-op sleep is still in place
    retrySleep.restore();
    const again = mockCtx([{ url: '/agents', status: 503, times: Infinity }]);
    const startedAgain = Date.now();
    await captureError(chatwootApiRequest.call(again.ctx, 'GET', '/agents'));
    expect(Date.now() - startedAgain).toBeLessThan(1000);
    expect(again.calls).toHaveLength(4);
    retrySleep = mockRetrySleep();
  });

  it('fails loudly on unexpected requests', async () => {
    const mock = mockCtx([]);
    const error = await captureError(
      chatwootApiRequest.call(mock.ctx, 'GET', '/agents', {}, { page: 2 }),
    );
    expect(error.message).toContain(
      'MockHttp: no response queued for GET https://chatwoot.test/api/v1/accounts/1/agents?page=2',
    );
  });

  it('webhook mock drives ChatwootTrigger.webhook()', async () => {
    const trigger = new ChatwootTrigger();
    const mock = createMockWebhookFunctions({
      params: { events: ['message_created'], options: { includeRawBody: true, verifySignature: false } },
      body: { event: 'message_created', id: 11 },
      headers: { 'X-Chatwoot-Signature': 'sig' },
    });
    const result = await trigger.webhook.call(mock.ctx);
    expect(result.workflowData?.[0][0].json).toMatchObject({ event: 'message_created', id: 11 });
    expect(mock.ctx.getHeaderData()).toEqual({ 'x-chatwoot-signature': 'sig' });
    expect((mock.ctx.getRequestObject() as unknown as { rawBody: Buffer }).rawBody.toString()).toBe(
      '{"event":"message_created","id":11}',
    );
    mock.ctx.getResponseObject().status(200).send('ok');
    expect(mock.response).toMatchObject({ statusCode: 200, body: 'ok', ended: true });
  });

  it('hook mock keeps workflow static data between lifecycle calls', async () => {
    const trigger = new ChatwootTrigger();
    const hook = createMockHookFunctions({
      params: { events: ['message_created'] },
      staticData: { node: { webhookId: 77 } },
      responses: [{ method: 'DELETE', url: '/webhooks/77' }],
    });
    expect(hook.ctx.getWorkflowStaticData('node')).toEqual({ webhookId: 77 });
    await expect(trigger.webhookMethods.default.delete.call(hook.ctx)).resolves.toBe(true);
    expect(hook.calls[0].path).toBe('/api/v1/accounts/1/webhooks/77');
    expect(hook.staticData.node).toEqual({});
    expect(hook.ctx.getNodeWebhookUrl('default')).toBe(
      'https://n8n.test/webhook/test-webhook-id/webhook',
    );
  });
});
