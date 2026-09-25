import type { IDataObject } from 'n8n-workflow';
import {
  chatwootApiRequest,
  chatwootApiRequestAllItems,
  chatwootApiRequestAllMessages,
  getChatwootErrorHint,
} from '../nodes/Chatwoot/GenericFunctions';
import { createMockExecuteFunctions, runChatwootNode } from './helpers/mockExecuteFunctions';

const cases = [
  { resource: 'webhook', operation: 'getAll', url: '/webhooks', params: {}, body: { payload: { webhooks: [{ id: 7 }] } } },
  { resource: 'webhook', operation: 'create', url: '/webhooks', params: { url: 'https://example.com/hook', subscriptions: ['message_created'] }, body: { payload: { webhook: { id: 7 } } } },
  { resource: 'webhook', operation: 'update', url: '/webhooks/7', params: { webhookId: 7, updateFields: { name: 'New' } }, body: { payload: { webhook: { id: 7 } } } },
  { resource: 'inbox', operation: 'getMembers', url: '/inbox_members/7', params: { inboxId: 7 }, body: { payload: [{ id: 7 }] } },
  { resource: 'helpCenter', operation: 'listPortals', url: '/portals', params: {}, body: { payload: [{ id: 7 }], meta: { portals_count: 1 } } },
  { resource: 'helpCenter', operation: 'listCategories', url: '/portals/docs/categories', params: { portalSlug: 'docs' }, body: { payload: [{ id: 7 }], meta: { categories_count: 1 } } },
  { resource: 'slaPolicy', operation: 'getAll', url: '/sla_policies', params: {}, body: { payload: [{ id: 7 }] } },
];

describe('CW-COMPAT-1 / CW-ADMIN-2 legacy envelopes', () => {
  it.each(cases)('$resource/$operation retains the v0.8.3 response by default', async ({ resource, operation, params, url, body }) => {
    const { output } = await runChatwootNode({ params: { resource, operation, ...params }, responses: [{ url, body }] });
    expect(output[0]).toEqual([{ json: body, pairedItem: { item: 0 } }]);
  });

  it.each(cases)('$resource/$operation explicitly opts into unwrapped output', async ({ resource, operation, params, url, body }) => {
    const { output } = await runChatwootNode({ params: { resource, operation, ...params, simplifyOutput: true }, responses: [{ url, body }] });
    expect(output[0].map((item) => item.json)).toEqual([{ id: 7 }]);
  });

  it.each(cases.filter(({ operation }) => !['create', 'update'].includes(operation)))('$resource/$operation keeps an empty envelope item', async ({ resource, operation, params, url }) => {
    const body = resource === 'webhook' ? { payload: { webhooks: [] } } : { payload: [] };
    const { output } = await runChatwootNode({ params: { resource, operation, ...params }, responses: [{ url, body }] });
    expect(output[0].map((item) => item.json)).toEqual([body]);
  });
});

describe('CW-CORE-2 incremental message pagination', () => {
  const messages = Array.from({ length: 245 }, (_, index) => ({ id: index + 1, created_at: index + 1 }));

  it('returns the oldest limited backlog and resumes without a gap across native pages', async () => {
    const run = (after: number, limit: number) => runChatwootNode({
      params: { resource: 'message', operation: 'getAll', conversationId: 9, options: { after }, limit },
      responses: [{ url: '/conversations/9/messages', times: Infinity, reply: (call) => ({ body: { payload: messages.filter((m) => m.id > Number(call.qs?.after)).slice(0, 100) } }) }],
    });
    const first = await run(10, 120);
    expect(first.output[0].map((item) => item.json.id)).toEqual(messages.slice(10, 130).map((m) => m.id));
    expect(first.calls.map((call) => call.qs?.after)).toEqual([10, 110]);
    const next = await run(130, 120);
    expect(next.output[0].map((item) => item.json.id)).toEqual(messages.slice(130).map((m) => m.id));
  });

  it('public API walks the before-only API to the bound before limiting', async () => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/inboxes/i/contacts/c/conversations/9/messages', api: 'public', times: Infinity, reply: (call) => {
      expect(call.qs?.after).toBeUndefined();
      return { body: messages.slice(0, 45).filter((m) => m.id < Number(call.qs?.before ?? Infinity)).slice(-20) };
    } }] });
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, 20, { after: 10, api: 'public', endpoint: '/inboxes/i/contacts/c/conversations/9/messages' });
    expect(result.map((m) => m.id)).toEqual(messages.slice(10, 30).map((m) => m.id));
    expect(mock.calls).toHaveLength(2);
  });

  it('stops if the native after cursor does not advance', async () => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/conversations/9/messages', times: Infinity, body: { payload: messages.slice(0, 100) } }] });
    const result = await chatwootApiRequestAllMessages.call(mock.ctx, 9, undefined, { after: 10 });
    expect(result).toHaveLength(90);
    expect(mock.calls).toHaveLength(2);
  });
});

describe('CW-CORE-6 pagination budgets', () => {
  it('uses the known total to return more than 1000 pages', async () => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/contacts', times: Infinity, reply: (call) => ({ body: { payload: [{ id: Number(call.qs?.page) }], meta: { count: 1002, per_page: 1 } } }) }] });
    const items = await chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/contacts');
    expect(items).toHaveLength(1002);
    expect(mock.calls).toHaveLength(1002);
  });

  it('still honors an explicit hard cap even when the server reports a larger total', async () => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/contacts', times: Infinity, reply: (call) => ({ body: { payload: [{ id: Number(call.qs?.page) }], meta: { count: 1002 } } }) }] });
    await expect(chatwootApiRequestAllItems.call(mock.ctx, 'GET', '/contacts', {}, {}, 'payload', { maxPages: 2 })).rejects.toThrow('exceeded 2 pages');
    expect(mock.calls).toHaveLength(2);
  });
});

describe('CW-ADMIN-4 / CW-TRIGGER-6 actionable errors', () => {
  it('points invalid member IDs at agents in the account instead of credentials', () => {
    expect(getChatwootErrorHint(401, 'Invalid User IDs')).toContain('Agent → Get Many');
    expect(getChatwootErrorHint(401, 'Invalid User IDs')).not.toContain('token');
  });

  it.each([502, 503, 504])('explains the ambiguous DELETE outcome after %s then 404', async (status) => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/teams/7', status }, { url: '/teams/7', status: 404 }] });
    const error = await chatwootApiRequest.call(mock.ctx, 'DELETE', '/teams/7').catch((reason: unknown) => reason) as { description: string };
    expect(error.description).toContain('An earlier attempt may have completed the deletion');
    mock.http.assertAllConsumed();
  });

  it('does not claim an earlier deletion for a first-attempt 404', async () => {
    const mock = createMockExecuteFunctions({ responses: [{ url: '/teams/7', status: 404 }] });
    const error = await chatwootApiRequest.call(mock.ctx, 'DELETE', '/teams/7').catch((reason: unknown) => reason) as IDataObject;
    expect(error.description).not.toContain('An earlier attempt');
  });
});
