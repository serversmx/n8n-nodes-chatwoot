/**
 * Execute-level tests for the contact package: Contact, Contact Note, Label, Custom Attribute and
 * Custom Filter. Response bodies follow the Chatwoot 4.18.0 jbuilder views
 * (app/views/api/v1/accounts/contacts/*.json.jbuilder, api/v1/models/_contact.json.jbuilder, ...).
 */
import type { IDataObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import {
  buildWhatsAppLookup,
  isEmptyFilterPayload,
  mergeLabelLists,
  normalizeLabelList,
  rankWhatsAppMatches,
  sortConversationsByActivity,
  subtractLabelLists,
} from '../nodes/Chatwoot/resources/contact/utils';
import {
  binaryItem,
  createMockExecuteFunctions,
  runChatwootNode,
} from './helpers/mockExecuteFunctions';

const API = 'https://chatwoot.test/api/v1/accounts/1';

// ----------------------------------------------------------------------------
// Fixtures (Chatwoot 4.18.0 shapes)
// ----------------------------------------------------------------------------

const inboxSlim = {
  id: 3,
  avatar_url: '',
  channel_id: 2,
  name: 'WhatsApp Evolution',
  channel_type: 'Channel::Api',
  provider: null,
};

/** api/v1/models/_contact.json.jbuilder with contact_inboxes (index/search/filter/show). */
function contact(id: number, overrides: IDataObject = {}): IDataObject {
  return {
    additional_attributes: { city: 'Monterrey', company_name: 'Acme' },
    availability_status: 'offline',
    email: `contact${id}@example.com`,
    id,
    name: `Contact ${id}`,
    phone_number: `+5215500000${String(id).padStart(3, '0')}`,
    blocked: false,
    identifier: null,
    thumbnail: '',
    custom_attributes: {},
    last_activity_at: 1758000000 + id,
    created_at: 1750000000 + id,
    contact_inboxes: [{ source_id: `src-${id}`, inbox: inboxSlim }],
    ...overrides,
  };
}

const contacts = (from: number, count: number) =>
  Array.from({ length: count }, (_, k) => contact(from + k));

/** contacts/index.json.jbuilder and filter.json.jbuilder: meta.count is the TOTAL count. */
const listPage = (payload: IDataObject[], count: number, page: number) => ({
  meta: { count, current_page: String(page) },
  payload,
});

/** contacts/search.json.jbuilder: meta.count is the page size, has_more drives pagination. */
const searchPage = (payload: IDataObject[], page: number, hasMore: boolean) => ({
  meta: { count: payload.length, current_page: String(page), has_more: hasMore },
  payload,
});

/** api/v1/conversations/partials/_conversation.json.jbuilder (subset of meta). */
function conversation(id: number, createdAt: number, lastActivityAt: number): IDataObject {
  return {
    meta: {
      sender: contact(10, { contact_inboxes: undefined }),
      channel: 'Channel::Api',
      hmac_verified: false,
    },
    id,
    messages: [],
    account_id: 1,
    uuid: `00000000-0000-0000-0000-00000000000${id}`,
    additional_attributes: {},
    agent_last_seen_at: 0,
    assignee_last_seen_at: 0,
    can_reply: true,
    contact_info_request: { available: false, reason: null, delivery_mode: null },
    contact_last_seen_at: 0,
    custom_attributes: {},
    inbox_id: 3,
    labels: [],
    muted: false,
    snoozed_until: null,
    status: 'open',
    created_at: createdAt,
    updated_at: lastActivityAt + 0.5,
    timestamp: lastActivityAt,
    first_reply_created_at: 0,
    unread_count: 0,
    last_non_activity_message: null,
    last_activity_at: lastActivityAt,
    priority: null,
    waiting_since: 0,
    sla_policy_id: null,
  };
}

/** api/v1/models/_attachment.json.jbuilder + conversation_id (contacts/attachments/index). */
function attachment(id: number): IDataObject {
  return {
    id,
    message_id: 500 + id,
    thumb_url: '',
    data_url: `https://chatwoot.test/rails/active_storage/blobs/${id}/file.pdf`,
    file_size: 1024,
    file_type: 'file',
    extension: 'pdf',
    width: null,
    height: null,
    created_at: 1758000000 - id,
    sender: { id: 10, name: 'Contact 10', type: 'contact' },
    conversation_id: 42,
  };
}

/** api/v1/models/_custom_attribute_definition.json.jbuilder */
function attributeDefinition(overrides: IDataObject = {}): IDataObject {
  return {
    id: 9,
    attribute_display_name: 'Tax ID',
    attribute_display_type: 'text',
    attribute_description: 'Company tax identifier',
    attribute_key: 'tax_id',
    regex_pattern: '^[A-Z]{4}\\d{6}$',
    regex_cue: 'Use the RFC format',
    attribute_values: [],
    attribute_model: 'company_attribute',
    default_value: null,
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
    ...overrides,
  };
}

/** labels/index.json.jbuilder */
const labelsIndex = {
  payload: [
    { id: 7, title: 'vip', description: 'Top customers', color: '#1f93ff', show_on_sidebar: true },
    { id: 8, title: 'lead', description: '', color: '#ff0000', show_on_sidebar: false },
  ],
};

const run = (
  params: IDataObject,
  responses: Parameters<typeof runChatwootNode>[0]['responses'],
  extra = {},
) => runChatwootNode({ params: { resource: 'contact', ...params }, responses, ...extra });

/** Execute directly and return the thrown error (no request may be left unconsumed). */
async function executeError(params: IDataObject, items?: ReturnType<typeof binaryItem>[]) {
  const mock = createMockExecuteFunctions({
    description: new Chatwoot().description,
    params,
    items,
  });
  let caught: unknown;
  try {
    await new Chatwoot().execute.call(mock.ctx);
  } catch (error) {
    caught = error;
  }
  return { error: caught as Error & { description?: string }, calls: mock.calls };
}

// ============================================================================
// Contact
// ============================================================================

describe('contact create', () => {
  it('POST /contacts with inbox_id + source_id, additional_attributes, avatar_url, blocked and company_id', async () => {
    const created = {
      payload: {
        contact: contact(21, { identifier: '5215512345678@s.whatsapp.net', blocked: true }),
        contact_inbox: {
          inbox: { id: 3, name: 'WhatsApp Evolution', channel_type: 'Channel::Api' },
          source_id: 'wa-1',
        },
      },
    };
    const { output, calls } = await run(
      {
        operation: 'create',
        name: 'Ana López',
        additionalFields: {
          email: 'ana@example.com',
          phone_number: '+5215512345678',
          identifier: '5215512345678@s.whatsapp.net',
          inbox_id: 3,
          source_id: 'wa-1',
          avatar_url: 'https://cdn.example.com/ana.png',
          blocked: true,
          company_id: 12,
          custom_attributes: '{"crm_id": "C-1"}',
          additional_attributes:
            '{"company_name": "Acme", "city": "Monterrey", "country_code": "MX"}',
        },
      },
      [{ method: 'POST', url: '/contacts', body: created }],
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${API}/contacts`);
    expect(calls[0].queryString).toBe('');
    expect(calls[0].body).toEqual({
      name: 'Ana López',
      inbox_id: 3,
      source_id: 'wa-1',
      email: 'ana@example.com',
      phone_number: '+5215512345678',
      identifier: '5215512345678@s.whatsapp.net',
      avatar_url: 'https://cdn.example.com/ana.png',
      blocked: true,
      company_id: 12,
      custom_attributes: { crm_id: 'C-1' },
      additional_attributes: { company_name: 'Acme', city: 'Monterrey', country_code: 'MX' },
    });
    // The response is passed through unchanged (saved workflows read payload.contact)
    expect(output[0]).toHaveLength(1);
    expect(output[0][0].json).toEqual(created);
  });

  it('refuses a Source ID without an Inbox ID and sends nothing', async () => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'create',
      name: 'Ana',
      additionalFields: { source_id: 'wa-1' },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('Source ID requires Inbox ID');
    expect(calls).toHaveLength(0);
  });

  it('refuses custom attributes that are not a JSON object', async () => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'create',
      name: 'Ana',
      additionalFields: { custom_attributes: '["a"]' },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('"custom_attributes" must be a JSON object');
    expect(calls).toHaveLength(0);
  });
});

describe('contact update', () => {
  it('PUT /contacts/:id with additional_attributes (merged by Chatwoot) and company_id', async () => {
    const updated = {
      payload: contact(5, { additional_attributes: { company_name: 'Acme', city: 'CDMX' } }),
    };
    const { output, calls } = await run(
      {
        operation: 'update',
        contactId: 5,
        updateFields: {
          name: 'Ana',
          additional_attributes: { city: 'CDMX' },
          custom_attributes: '{"plan": "pro"}',
          company_id: 12,
          blocked: false,
        },
      },
      [{ method: 'PUT', url: '/contacts/5', body: updated }],
    );
    expect(calls[0].url).toBe(`${API}/contacts/5`);
    expect(calls[0].body).toEqual({
      name: 'Ana',
      blocked: false,
      company_id: 12,
      custom_attributes: { plan: 'pro' },
      additional_attributes: { city: 'CDMX' },
    });
    expect(output[0][0].json).toEqual(updated);
  });
});

describe('contact get / delete / merge / listLabels / contactableInboxes', () => {
  it.each([
    [
      { operation: 'get', contactId: 5 },
      'GET',
      '/contacts/5',
      { payload: contact(5) },
      { payload: contact(5) },
    ],
    [
      { operation: 'delete', contactId: 5 },
      'DELETE',
      '/contacts/5',
      undefined,
      { success: true, id: 5 },
    ],
    [
      { operation: 'merge', baseContactId: 1, mergeeContactId: 2 },
      'POST',
      '/actions/contact_merge',
      contact(1),
      contact(1),
    ],
    [
      { operation: 'listLabels', contactId: 5 },
      'GET',
      '/contacts/5/labels',
      { payload: ['vip'] },
      { payload: ['vip'] },
    ],
    [
      { operation: 'contactableInboxes', contactId: 5 },
      'GET',
      '/contacts/5/contactable_inboxes',
      { payload: [{ inbox: inboxSlim, source_id: 'src-5' }] },
      { payload: [{ inbox: inboxSlim, source_id: 'src-5' }] },
    ],
  ])('%j', async (params, method, endpoint, body, expected) => {
    const { output, calls } = await run(params, [{ method, url: endpoint, body }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe(method);
    expect(calls[0].url).toBe(`${API}${endpoint}`);
    if (params.operation === 'merge') {
      expect(calls[0].body).toEqual({ base_contact_id: 1, mergee_contact_id: 2 });
    }
    expect(output[0][0].json).toEqual(expected);
  });
});

describe('contact getAll (GAP-1: Limit spans pages)', () => {
  it('fetches pages of 15 until Limit is reached and sends sort, labels[] and include_contact_inboxes', async () => {
    const { output, calls } = await run(
      {
        operation: 'getAll',
        limit: 20,
        options: {
          sort: '-last_activity_at',
          labels: ['vip', 'lead'],
          include_contact_inboxes: false,
        },
      },
      [
        { method: 'GET', url: '/contacts', body: listPage(contacts(1, 15), 40, 1) },
        { method: 'GET', url: '/contacts', body: listPage(contacts(16, 15), 40, 2) },
      ],
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${API}/contacts`);
    expect(calls.map((c) => c.qs)).toEqual([
      {
        sort: '-last_activity_at',
        include_contact_inboxes: 'false',
        labels: ['vip', 'lead'],
        page: 1,
      },
      {
        sort: '-last_activity_at',
        include_contact_inboxes: 'false',
        labels: ['vip', 'lead'],
        page: 2,
      },
    ]);
    expect(calls[0].queryString).toBe(
      'sort=-last_activity_at&include_contact_inboxes=false&labels[]=vip&labels[]=lead&page=1',
    );
    expect(output[0]).toHaveLength(20);
    expect(output[0].map((item) => item.json.id)).toEqual(
      Array.from({ length: 20 }, (_, k) => k + 1),
    );
  });

  it('Return All stops when meta.count contacts were collected', async () => {
    const { output, calls } = await run({ operation: 'getAll', returnAll: true }, [
      { url: '/contacts', body: listPage(contacts(1, 15), 32, 1) },
      { url: '/contacts', body: listPage(contacts(16, 15), 32, 2) },
      { url: '/contacts', body: listPage(contacts(31, 2), 32, 3) },
    ]);
    expect(calls.map((c) => c.qs?.page)).toEqual([1, 2, 3]);
    expect(output[0]).toHaveLength(32);
  });
});

describe('contact search', () => {
  it('follows meta.has_more across pages with the Limit', async () => {
    const { output, calls } = await run(
      { operation: 'search', query: 'acme', limit: 50, options: { sort: 'name' } },
      [
        { method: 'GET', url: '/contacts/search', body: searchPage(contacts(1, 15), 1, true) },
        { method: 'GET', url: '/contacts/search', body: searchPage(contacts(16, 3), 2, false) },
      ],
    );
    expect(calls.map((c) => c.url)).toEqual([`${API}/contacts/search`, `${API}/contacts/search`]);
    expect(calls.map((c) => c.qs)).toEqual([
      { q: 'acme', sort: 'name', page: 1 },
      { q: 'acme', sort: 'name', page: 2 },
    ]);
    expect(output[0]).toHaveLength(18);
    expect(output[0][17].json.id).toBe(18);
  });
});

describe('contact filter (GAP-2 / RELEASE-20)', () => {
  it('normalizes the payload for 4.17+ and pages with the body re-sent', async () => {
    const payload = [
      { attribute_key: 'company', filter_operator: 'contains', values: 'acme' },
      {
        attribute_key: 'labels',
        filter_operator: 'equal_to',
        values: ['vip'],
        query_operator: 'or',
      },
      {
        attribute_key: 'created_at',
        filter_operator: 'days_before',
        values: [30],
        query_operator: 'AND',
      },
    ];
    const { output, calls } = await run(
      {
        operation: 'filter',
        limit: 16,
        filterPayload: JSON.stringify(payload),
        options: { sort: '-created_at', include_contact_inboxes: true },
      },
      [
        { method: 'POST', url: '/contacts/filter', body: listPage(contacts(1, 15), 17, 1) },
        { method: 'POST', url: '/contacts/filter', body: listPage(contacts(16, 2), 17, 2) },
      ],
    );
    const expectedBody = {
      payload: [
        {
          attribute_key: 'company_name',
          filter_operator: 'contains',
          values: ['acme'],
          query_operator: 'AND',
        },
        {
          attribute_key: 'labels',
          filter_operator: 'equal_to',
          values: ['vip'],
          query_operator: 'OR',
        },
        {
          attribute_key: 'created_at',
          filter_operator: 'days_before',
          values: [30],
          query_operator: null,
        },
      ],
    };
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${API}/contacts/filter`);
    expect(calls[0].body).toEqual(expectedBody);
    expect(calls[1].body).toEqual(expectedBody);
    expect(calls.map((c) => c.qs)).toEqual([
      { sort: '-created_at', include_contact_inboxes: 'true', page: 1 },
      { sort: '-created_at', include_contact_inboxes: 'true', page: 2 },
    ]);
    expect(output[0]).toHaveLength(16);
  });

  it('accepts the {"payload": [...]} wrapper and sends values: [] for presence operators', async () => {
    // Contacts::FilterService#filter_values reads values[0] for labels: a missing array is a 500
    const { output, calls } = await run(
      {
        operation: 'filter',
        returnAll: true,
        filterPayload:
          '{"payload": [{"attribute_key": "labels", "filter_operator": "is_present", "query_operator": "OR"}, {"attribute_key": "crm_id", "filter_operator": "is_not_present", "values": [null]}]}',
      },
      [{ method: 'POST', url: '/contacts/filter', body: listPage([contact(1)], 1, 1) }],
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}/contacts/filter`);
    expect(calls[0].body).toEqual({
      payload: [
        {
          attribute_key: 'labels',
          filter_operator: 'is_present',
          values: [],
          query_operator: 'OR',
        },
        {
          attribute_key: 'crm_id',
          filter_operator: 'is_not_present',
          values: [],
          query_operator: null,
        },
      ],
    });
    expect(output[0].map((item) => item.json.id)).toEqual([1]);
  });

  it('sends numbers and booleans as strings where Chatwoot needs text, and days_before as an integer', async () => {
    const { calls } = await run(
      {
        operation: 'filter',
        returnAll: true,
        filterPayload: JSON.stringify([
          { attribute_key: 'phone_number', filter_operator: 'equal_to', values: [5215512345678] },
          { attribute_key: 'crm_id', filter_operator: 'contains', values: [42, true] },
          { attribute_key: 'plan_level', filter_operator: 'equal_to', values: [3] },
          { attribute_key: 'blocked', filter_operator: 'equal_to', values: [false] },
          { attribute_key: 'last_activity_at', filter_operator: 'days_before', values: [' 30 '] },
        ]),
      },
      [{ method: 'POST', url: '/contacts/filter', body: listPage([], 0, 1) }],
    );
    expect(calls[0].body).toEqual({
      payload: [
        {
          attribute_key: 'phone_number',
          filter_operator: 'equal_to',
          values: ['5215512345678'],
          query_operator: 'AND',
        },
        {
          attribute_key: 'crm_id',
          filter_operator: 'contains',
          values: ['42', 'true'],
          query_operator: 'AND',
        },
        // custom attributes and booleans keep their JSON type (numeric/checkbox attributes)
        {
          attribute_key: 'plan_level',
          filter_operator: 'equal_to',
          values: [3],
          query_operator: 'AND',
        },
        {
          attribute_key: 'blocked',
          filter_operator: 'equal_to',
          values: [false],
          query_operator: 'AND',
        },
        {
          attribute_key: 'last_activity_at',
          filter_operator: 'days_before',
          values: [30],
          query_operator: null,
        },
      ],
    });
  });

  it('sends an empty condition list as-is (Chatwoot returns every contact, as in 0.8.x)', async () => {
    const { output, calls } = await run({ operation: 'filter', limit: 2, filterPayload: '[]' }, [
      { method: 'POST', url: '/contacts/filter', body: listPage(contacts(1, 15), 40, 1) },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ payload: [] });
    expect(calls[0].qs).toEqual({ sort: 'created_at', page: 1 });
    expect(output[0].map((item) => item.json.id)).toEqual([1, 2]);
  });

  it.each([
    [
      'days_before out of 1..998',
      '[{"attribute_key":"created_at","filter_operator":"days_before","values":[0]}]',
      'between 1 and 998',
    ],
    [
      'invalid query_operator',
      '[{"attribute_key":"name","filter_operator":"contains","values":["a"],"query_operator":"XOR"},{"attribute_key":"email","filter_operator":"is_present"}]',
      'query_operator must be "AND" or "OR"',
    ],
    ['missing values', '[{"attribute_key":"name","filter_operator":"contains"}]', 'needs "values"'],
    [
      'object values',
      '[{"attribute_key":"name","filter_operator":"equal_to","values":[{"id":1}]}]',
      'plain strings',
    ],
    [
      'null values',
      '[{"attribute_key":"name","filter_operator":"equal_to","values":[null]}]',
      'plain strings',
    ],
    [
      'fractional days_before',
      '[{"attribute_key":"created_at","filter_operator":"days_before","values":["30.5"]}]',
      'between 1 and 998',
    ],
    [
      'boolean days_before',
      '[{"attribute_key":"created_at","filter_operator":"days_before","values":[true]}]',
      'between 1 and 998',
    ],
    ['a JSON object without payload', '{"attribute_key":"name"}', 'must be a JSON array'],
    ['invalid JSON', '[{', 'Invalid JSON'],
  ])('rejects %s before calling Chatwoot', async (_label, filterPayload, message) => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'filter',
      returnAll: true,
      filterPayload,
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain(message);
    expect(calls).toHaveLength(0);
  });

  it('surfaces the real Chatwoot 422 message', async () => {
    const { output } = await run(
      {
        operation: 'filter',
        returnAll: true,
        filterPayload:
          '[{"attribute_key":"unknown_key","filter_operator":"equal_to","values":["x"]}]',
      },
      [
        {
          method: 'POST',
          url: '/contacts/filter',
          status: 422,
          body: {
            message: 'Invalid attribute key - [unknown_key]. The allowed keys are [name,email].',
          },
        },
      ],
      { continueOnFail: true },
    );
    expect(output[0][0].json).toMatchObject({
      error: expect.stringContaining('Invalid attribute key - [unknown_key]'),
      httpCode: '422',
    });
  });
});

describe('contact labels (CORE-15)', () => {
  it('Add Labels reads the current labels and posts the union', async () => {
    const { output, calls } = await run(
      { operation: 'appendLabels', contactId: 5, labels: ['vip', 'customer'] },
      [
        { method: 'GET', url: '/contacts/5/labels', body: { payload: ['lead', 'VIP'] } },
        {
          method: 'POST',
          url: '/contacts/5/labels',
          body: { payload: ['customer', 'lead', 'vip'] },
        },
      ],
    );
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `${API}/contacts/5/labels`],
      ['POST', `${API}/contacts/5/labels`],
    ]);
    expect(calls[1].body).toEqual({ labels: ['lead', 'VIP', 'customer'] });
    expect(output[0][0].json).toEqual({ payload: ['customer', 'lead', 'vip'] });
  });

  it('Add Labels skips the write when every label is already present', async () => {
    const { output, calls } = await run({ operation: 'appendLabels', contactId: 5, labels: ['vip'] }, [
      { method: 'GET', url: '/contacts/5/labels', body: { payload: ['lead', 'vip'] } },
    ]);
    expect(calls).toHaveLength(1);
    expect(output[0][0].json).toEqual({ payload: ['lead', 'vip'] });
  });

  it('Remove Labels posts the current labels minus the given ones (case-insensitive)', async () => {
    const { output, calls } = await run(
      { operation: 'removeLabels', contactId: 5, labels: ['VIP', 'missing'] },
      [
        {
          method: 'GET',
          url: '/contacts/5/labels',
          body: { payload: ['customer', 'lead', 'vip'] },
        },
        { method: 'POST', url: '/contacts/5/labels', body: { payload: ['customer', 'lead'] } },
      ],
    );
    expect(calls[1].body).toEqual({ labels: ['customer', 'lead'] });
    expect(output[0][0].json).toEqual({ payload: ['customer', 'lead'] });
  });

  it('Set Labels replaces the list without reading it (comma-separated expression values work)', async () => {
    const { output, calls } = await run(
      { operation: 'setLabels', contactId: 5, labels: 'vip, lead,,vip' },
      [{ method: 'POST', url: '/contacts/5/labels', body: { payload: ['lead', 'vip'] } }],
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ labels: ['vip', 'lead'] });
    expect(output[0][0].json).toEqual({ payload: ['lead', 'vip'] });
  });

  it('processes each input item with its own contact and labels (pairedItem kept)', async () => {
    const { output, calls } = await runChatwootNode({
      items: [{ json: {} }, { json: {} }],
      params: { resource: 'contact', operation: 'appendLabels' },
      itemParams: [
        { contactId: 5, labels: ['vip'] },
        { contactId: 6, labels: 'lead' },
      ],
      responses: [
        { method: 'GET', url: '/contacts/5/labels', body: { payload: [] } },
        { method: 'POST', url: '/contacts/5/labels', body: { payload: ['vip'] } },
        { method: 'GET', url: '/contacts/6/labels', body: { payload: ['vip'] } },
        { method: 'POST', url: '/contacts/6/labels', body: { payload: ['lead', 'vip'] } },
      ],
    });
    expect(calls.map((c) => [c.method, c.endpoint, c.body])).toEqual([
      ['GET', '/contacts/5/labels', undefined],
      ['POST', '/contacts/5/labels', { labels: ['vip'] }],
      ['GET', '/contacts/6/labels', undefined],
      ['POST', '/contacts/6/labels', { labels: ['vip', 'lead'] }],
    ]);
    expect(output[0].map((item) => [item.json, item.pairedItem])).toEqual([
      [{ payload: ['vip'] }, { item: 0 }],
      [{ payload: ['lead', 'vip'] }, { item: 1 }],
    ]);
  });

  it('continueOnFail: a failing item yields an error item and the next item still runs', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      items: [{ json: {} }, { json: {} }],
      params: { resource: 'contact', operation: 'setLabels', labels: ['vip'] },
      itemParams: [{ contactId: 404 }, { contactId: 6 }],
      responses: [
        {
          method: 'POST',
          url: '/contacts/404/labels',
          status: 404,
          body: { error: 'Resource could not be found' },
        },
        { method: 'POST', url: '/contacts/6/labels', body: { payload: ['vip'] } },
      ],
    });
    expect(calls.map((c) => c.endpoint)).toEqual(['/contacts/404/labels', '/contacts/6/labels']);
    expect(output[0][0].json).toMatchObject({
      error: 'Chatwoot API error 404 Not Found: Resource could not be found',
      httpCode: '404',
    });
    expect(output[0][0].pairedItem).toEqual({ item: 0 });
    expect(output[0][1].json).toEqual({ payload: ['vip'] });
  });

  it('Set Labels with an empty list clears the labels', async () => {
    const { calls } = await run({ operation: 'setLabels', contactId: 5, labels: [] }, [
      { method: 'POST', url: '/contacts/5/labels', body: { payload: [] } },
    ]);
    expect(calls[0].body).toEqual({ labels: [] });
  });
});

describe('contact getConversations (CORE-11 / RELEASE-12)', () => {
  it('returns one item per conversation, most recently active first', async () => {
    // 4.18.0 orders by created_at desc; the node re-sorts by last_activity_at desc
    const payload = [
      conversation(12, 1758000300, 1758000400),
      conversation(11, 1758000200, 1758009999),
      conversation(10, 1758000100, 1758000150),
    ];
    const { output, calls } = await run({ operation: 'getConversations', contactId: 5 }, [
      { method: 'GET', url: '/contacts/5/conversations', body: { payload } },
    ]);
    expect(calls[0].url).toBe(`${API}/contacts/5/conversations`);
    expect(calls[0].queryString).toBe('');
    expect(output[0].map((item) => item.json.id)).toEqual([11, 12, 10]);
    expect(output[0][0].json.meta).toMatchObject({ channel: 'Channel::Api' });
  });

  it('returns no items when the contact has no conversations', async () => {
    const { output } = await run({ operation: 'getConversations', contactId: 5 }, [
      { url: '/contacts/5/conversations', body: { payload: [] } },
    ]);
    expect(output[0]).toEqual([]);
  });
});

describe('contact import (CORE-8 / N8N-1)', () => {
  it('uploads the binary CSV as multipart import_file', async () => {
    const csv = 'name,email,phone_number\nAna,ana@example.com,+5215512345678\n';
    const { output, calls } = await run(
      { operation: 'import', binaryPropertyName: 'data' },
      [{ method: 'POST', url: '/contacts/import' }], // head :ok
      { items: [binaryItem({ content: csv, fileName: 'contacts.csv', mimeType: 'text/csv' })] },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${API}/contacts/import`);
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect(calls[0].headers['Content-Type']).toBeUndefined();
    expect(calls[0].formData).toEqual([
      {
        name: 'import_file',
        kind: 'file',
        fileName: 'contacts.csv',
        mimeType: 'text/csv',
        size: Buffer.byteLength(csv),
        content: Buffer.from(csv),
      },
    ]);
    expect(output[0][0].json).toMatchObject({ success: true, fileName: 'contacts.csv' });
  });

  it('sends a generic octet-stream binary as text/csv and names it contacts.csv when unnamed', async () => {
    const item = binaryItem({
      content: 'name\nAna',
      propertyName: 'file',
      mimeType: 'application/octet-stream',
    });
    delete (item.binary!.file as IDataObject).fileName;
    const { calls } = await run(
      { operation: 'import', binaryPropertyName: 'file' },
      [{ method: 'POST', url: '/contacts/import' }],
      { items: [item] },
    );
    expect(calls[0].formData).toEqual([
      expect.objectContaining({
        name: 'import_file',
        fileName: 'contacts.csv',
        mimeType: 'text/csv',
      }),
    ]);
  });

  it('fails without a request when the binary property is missing', async () => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'import',
      binaryPropertyName: 'data',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(calls).toHaveLength(0);
  });
});

describe('contact export (CORE-8)', () => {
  it('sends label (legacy option name "tag"), column_names and a normalized filter payload', async () => {
    const { output, calls } = await run(
      {
        operation: 'export',
        options: {
          tag: ' vip ',
          column_names: 'id, name,email,,labels',
          payload:
            '[{"attribute_key":"company","filter_operator":"equal_to","values":["acme"],"query_operator":"AND"}]',
        },
      },
      [{ method: 'POST', url: '/contacts/export' }], // head :ok
    );
    const body = {
      label: 'vip',
      column_names: ['id', 'name', 'email', 'labels'],
      payload: [
        {
          attribute_key: 'company_name',
          filter_operator: 'equal_to',
          values: ['acme'],
          query_operator: null,
        },
      ],
    };
    expect(calls[0].url).toBe(`${API}/contacts/export`);
    expect(calls[0].body).toEqual(body);
    expect(output[0][0].json).toMatchObject({ success: true, ...body });
    expect(output[0][0].json.message).toContain('email');
  });

  it('omits an empty filter payload', async () => {
    const { calls } = await run({ operation: 'export', options: { payload: '[]', tag: 'vip' } }, [
      { method: 'POST', url: '/contacts/export' },
    ]);
    expect(calls[0].body).toEqual({ label: 'vip' });
  });

  it('does not send a blank label (whitespace only)', async () => {
    const { output, calls } = await run({ operation: 'export', options: { tag: '   ' } }, [
      { method: 'POST', url: '/contacts/export' },
    ]);
    expect(calls[0].body).toBeUndefined();
    expect(output[0][0].json).not.toHaveProperty('label');
  });

  it('exports every contact when no option is set', async () => {
    const { calls } = await run({ operation: 'export' }, [
      { method: 'POST', url: '/contacts/export' },
    ]);
    expect(calls[0].body).toBeUndefined(); // no filter: Chatwoot exports every contact
    expect(calls[0].headers['Content-Type']).toBeUndefined();
  });
});

describe('contact getAttachments (CORE-17, 4.14+)', () => {
  it('pages 100 at a time and stops at meta.total_count', async () => {
    const page1 = {
      meta: { total_count: 120 },
      payload: Array.from({ length: 100 }, (_, k) => attachment(k + 1)),
    };
    const page2 = {
      meta: { total_count: 120 },
      payload: Array.from({ length: 20 }, (_, k) => attachment(k + 101)),
    };
    const { output, calls } = await run({ operation: 'getAttachments', contactId: 5, limit: 150 }, [
      { method: 'GET', url: '/contacts/5/attachments', body: page1 },
      { method: 'GET', url: '/contacts/5/attachments', body: page2 },
    ]);
    expect(calls.map((c) => c.url)).toEqual([
      `${API}/contacts/5/attachments`,
      `${API}/contacts/5/attachments`,
    ]);
    expect(calls.map((c) => c.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0]).toHaveLength(120);
    expect(output[0][0].json).toMatchObject({ id: 1, conversation_id: 42, file_type: 'file' });
  });

  it('Limit below one page makes a single request', async () => {
    const page1 = {
      meta: { total_count: 120 },
      payload: Array.from({ length: 100 }, (_, k) => attachment(k + 1)),
    };
    const { output, calls } = await run({ operation: 'getAttachments', contactId: 5, limit: 2 }, [
      { url: '/contacts/5/attachments', body: page1 },
    ]);
    expect(calls).toHaveLength(1);
    expect(output[0].map((item) => item.json.id)).toEqual([1, 2]);
  });
});

describe('contact linkToInbox (CORE-18)', () => {
  it('POST /contacts/:id/contact_inboxes with inbox_id, source_id and hmac_verified', async () => {
    const response = { source_id: 'crm-1', inbox: inboxSlim }; // contact_inboxes/create.json.jbuilder
    const { output, calls } = await run(
      {
        operation: 'linkToInbox',
        contactId: 5,
        inboxId: 3,
        additionalFields: { source_id: ' crm-1 ', hmac_verified: true },
      },
      [{ method: 'POST', url: '/contacts/5/contact_inboxes', body: response }],
    );
    expect(calls[0].url).toBe(`${API}/contacts/5/contact_inboxes`);
    expect(calls[0].body).toEqual({ inbox_id: 3, source_id: 'crm-1', hmac_verified: true });
    expect(output[0][0].json).toEqual(response);
  });

  it('lets Chatwoot generate the source ID when none is given', async () => {
    const { calls } = await run({ operation: 'linkToInbox', contactId: 5, inboxId: '3' }, [
      {
        method: 'POST',
        url: '/contacts/5/contact_inboxes',
        body: { source_id: 'uuid', inbox: inboxSlim },
      },
    ]);
    expect(calls[0].body).toEqual({ inbox_id: 3 });
  });
});

describe('contact findByWhatsApp (EVOCW-6)', () => {
  it('searches the digits shared by +52/+521 and prefers the contact whose identifier is the JID', async () => {
    const phoneOnly = contact(1, {
      phone_number: '+525512345678',
      identifier: null,
      last_activity_at: 1758009999,
    });
    const byJid = contact(2, {
      phone_number: '+5215512345678',
      identifier: '525512345678@s.whatsapp.net',
    });
    const other = contact(3, { phone_number: '+15125512345678', identifier: null }); // substring hit only
    const { output, calls } = await run(
      { operation: 'findByWhatsApp', whatsappNumber: '5215512345678:12@s.whatsapp.net' },
      [
        {
          method: 'GET',
          url: '/contacts/search',
          body: searchPage([phoneOnly, byJid, other], 1, false),
        },
      ],
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API}/contacts/search`);
    expect(calls[0].qs).toEqual({ q: '5512345678', sort: 'created_at', page: 1 });
    expect(output[0]).toHaveLength(1);
    expect(output[0][0].json).toEqual({
      found: true,
      contact: byJid,
      matchedBy: 'identifier',
      matchedValue: '525512345678@s.whatsapp.net',
      isLid: false,
      otherMatches: [
        {
          id: 1,
          name: 'Contact 1',
          phone_number: '+525512345678',
          identifier: null,
          matchedBy: 'phone_number',
        },
      ],
      searched: {
        input: '5215512345678:12@s.whatsapp.net',
        query: '5512345678',
        phoneNumbers: ['+5215512345678', '+525512345678'],
        identifiers: ['5215512345678@s.whatsapp.net', '525512345678@s.whatsapp.net'],
      },
    });
  });

  it('finds a @lid contact and flags it', async () => {
    const lidContact = contact(4, { identifier: '123456789012345@lid', phone_number: null });
    const { output, calls } = await run(
      { operation: 'findByWhatsApp', whatsappNumber: '123456789012345@lid' },
      [{ url: '/contacts/search', body: searchPage([lidContact], 1, false) }],
    );
    expect(calls[0].qs).toEqual({ q: '123456789012345', sort: 'created_at', page: 1 });
    expect(output[0][0].json).toMatchObject({
      found: true,
      isLid: true,
      matchedBy: 'identifier',
      contact: { id: 4 },
    });
  });

  it('returns found=false (one item) when nothing matches exactly', async () => {
    const { output } = await run(
      { operation: 'findByWhatsApp', whatsappNumber: '+1 (415) 555-0100' },
      [
        {
          url: '/contacts/search',
          body: searchPage([contact(9, { phone_number: '+14155550199' })], 1, false),
        },
      ],
    );
    expect(output[0][0].json).toMatchObject({
      found: false,
      contact: null,
      matchedBy: null,
      otherMatches: [],
      searched: { query: '14155550100', phoneNumbers: ['+14155550100'] },
    });
  });

  it('rejects input that is not a phone number or WhatsApp JID', async () => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'findByWhatsApp',
      whatsappNumber: 'ana@example.com',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('is not a WhatsApp number or JID');
    expect(calls).toHaveLength(0);
  });
});

describe('contact utils', () => {
  it.each([
    ['+52 1 55 1234 5678', 'phone', '5512345678', ['+5215512345678', '+525512345678']],
    ['525512345678', 'phone', '5512345678', ['+525512345678', '+5215512345678']],
    ['5491122334455', 'phone', '1122334455', ['+5491122334455', '+541122334455']],
    ['541122334455', 'phone', '1122334455', ['+541122334455', '+5491122334455']],
    ['5511987654321', 'phone', '87654321', ['+5511987654321', '+551187654321']],
    ['551187654321', 'phone', '87654321', ['+551187654321', '+5511987654321']],
    ['0034 612 345 678', 'phone', '34612345678', ['+34612345678']],
    ['14155550100@c.us', 'phone', '14155550100', ['+14155550100']],
    ['120363012345678901@g.us', 'group', '120363012345678901', []],
  ])('buildWhatsAppLookup(%s)', (input, kind, searchQuery, phoneNumbers) => {
    const lookup = buildWhatsAppLookup(input);
    expect(lookup.kind).toBe(kind);
    expect(lookup.searchQuery).toBe(searchQuery);
    expect(lookup.phoneNumbers).toEqual(phoneNumbers);
    if (kind === 'phone') {
      expect(lookup.identifiers).toEqual(phoneNumbers.map((p) => `${p.slice(1)}@s.whatsapp.net`));
    } else {
      expect(lookup.identifiers).toEqual([`${searchQuery}@g.us`]);
    }
  });

  it.each(['', '12345', '1234567890123456', 'x@example.com', '@lid'])(
    'buildWhatsAppLookup rejects %j',
    (input) => {
      expect(() => buildWhatsAppLookup(input)).toThrow();
    },
  );

  it('rankWhatsAppMatches: identifier > phone, then input variant, then last activity', () => {
    const lookup = buildWhatsAppLookup('+5215512345678');
    const ranked = rankWhatsAppMatches(lookup, [
      contact(1, { phone_number: '+525512345678', last_activity_at: 9 }),
      contact(2, { phone_number: '+5215512345678', last_activity_at: 1 }),
      contact(3, { phone_number: '+5215512345678', last_activity_at: 5 }),
      contact(4, { phone_number: null, identifier: '525512345678@S.WHATSAPP.NET' }),
    ]);
    expect(ranked.map((m) => m.contact.id)).toEqual([4, 3, 2, 1]);
  });

  it('label list helpers', () => {
    expect(normalizeLabelList(' a, b ,A,,c')).toEqual(['a', 'b', 'c']);
    expect(normalizeLabelList(undefined)).toEqual([]);
    expect(mergeLabelLists(['Lead'], ['lead', 'vip'])).toEqual(['Lead', 'vip']);
    expect(subtractLabelLists(['lead', 'vip'], ['VIP'])).toEqual(['lead']);
  });

  it('sortConversationsByActivity and isEmptyFilterPayload', () => {
    expect(
      sortConversationsByActivity([
        { id: 1, last_activity_at: 5 },
        { id: 2, last_activity_at: 9 },
        { id: 3, last_activity_at: 9 },
      ]).map((c) => c.id),
    ).toEqual([3, 2, 1]);
    expect([undefined, null, '', ' [ ] ', []].map(isEmptyFilterPayload)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(isEmptyFilterPayload('[{"a":1}]')).toBe(false);
  });
});

// ============================================================================
// Contact Note
// ============================================================================

describe('contactNote', () => {
  const note = {
    id: 4,
    content: 'Called the customer',
    account_id: null,
    contact_id: null,
    user: { id: 1, name: 'Admin', email: 'admin@example.com' },
    created_at: 1758000000,
    updated_at: 1758000000,
  };

  it.each([
    [{ operation: 'getAll', contactId: 5 }, 'GET', '/contacts/5/notes', [note], undefined],
    [
      { operation: 'create', contactId: 5, content: 'Called the customer' },
      'POST',
      '/contacts/5/notes',
      note,
      { content: 'Called the customer' },
    ],
    [
      { operation: 'update', contactId: 5, noteId: 4, content: 'Updated' },
      'PATCH',
      '/contacts/5/notes/4',
      { ...note, content: 'Updated' },
      { content: 'Updated' },
    ],
  ])('%j', async (params, method, endpoint, body, sentBody) => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'contactNote', ...params },
      responses: [{ method, url: endpoint, body }],
    });
    expect(calls[0].url).toBe(`${API}${endpoint}`);
    if (sentBody) expect(calls[0].body).toEqual(sentBody);
    expect(output[0][0].json).toMatchObject({ id: 4 });
  });

  it('delete returns a success item', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'contactNote', operation: 'delete', contactId: 5, noteId: 4 },
      responses: [{ method: 'DELETE', url: '/contacts/5/notes/4' }],
    });
    expect(calls[0].url).toBe(`${API}/contacts/5/notes/4`);
    expect(output[0][0].json).toEqual({ success: true, id: 4 });
  });
});

// ============================================================================
// Label
// ============================================================================

describe('label', () => {
  it('getAll unwraps payload into one item per label', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'label', operation: 'getAll' },
      responses: [{ method: 'GET', url: '/labels', body: labelsIndex }],
    });
    expect(calls[0].url).toBe(`${API}/labels`);
    expect(output[0].map((item) => item.json.title)).toEqual(['vip', 'lead']);
  });

  it('create posts title and fields', async () => {
    const created = {
      id: 9,
      title: 'urgent',
      description: 'Escalated',
      color: '#ff0000',
      show_on_sidebar: true,
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'label',
        operation: 'create',
        title: 'urgent',
        additionalFields: { description: 'Escalated', color: '#ff0000', show_on_sidebar: true },
      },
      responses: [{ method: 'POST', url: '/labels', body: created }],
    });
    expect(calls[0].body).toEqual({
      title: 'urgent',
      description: 'Escalated',
      color: '#ff0000',
      show_on_sidebar: true,
    });
    expect(output[0][0].json).toEqual(created);
  });

  it('update resolves a title picked from the dropdown to its ID', async () => {
    const updated = { ...labelsIndex.payload[0], color: '#00ff00' };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'label',
        operation: 'update',
        labelId: 'VIP',
        updateFields: { color: '#00ff00' },
      },
      responses: [
        { method: 'GET', url: '/labels', body: labelsIndex },
        { method: 'PATCH', url: '/labels/7', body: updated },
      ],
    });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `${API}/labels`],
      ['PATCH', `${API}/labels/7`],
    ]);
    expect(calls[1].body).toEqual({ color: '#00ff00' });
    expect(output[0][0].json).toEqual(updated);
  });

  it('delete with a numeric ID calls DELETE directly', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'label', operation: 'delete', labelId: 8 },
      responses: [{ method: 'DELETE', url: '/labels/8' }],
    });
    expect(calls).toHaveLength(1);
    expect(output[0][0].json).toEqual({ success: true, id: 8 });
  });

  it('delete with an unknown title fails without deleting anything', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'label', operation: 'delete', labelId: 'nope' },
      responses: [{ method: 'GET', url: '/labels', body: labelsIndex }],
    });
    expect(calls).toHaveLength(1);
    expect(output[0][0].json).toMatchObject({ error: 'Label "nope" not found' });
  });
});

// ============================================================================
// Custom Attribute
// ============================================================================

describe('customAttribute (CORE-19 / GAP-3)', () => {
  it('create supports company_attribute and regex fields, and never sends default_value', async () => {
    const created = attributeDefinition();
    const { output, calls } = await runChatwootNode({
      // keepUnknownParams simulates a workflow saved with the removed Default Value option
      keepUnknownParams: true,
      params: {
        resource: 'customAttribute',
        operation: 'create',
        attributeDisplayName: 'Tax ID',
        attributeKey: 'tax_id',
        attributeModel: 'company_attribute',
        attributeDisplayType: 'text',
        additionalFields: {
          attribute_description: 'Company tax identifier',
          default_value: 'legacy',
          regex_pattern: '^[A-Z]{4}\\d{6}$',
          regex_cue: 'Use the RFC format',
        },
      },
      responses: [{ method: 'POST', url: '/custom_attribute_definitions', body: created }],
    });
    expect(calls[0].url).toBe(`${API}/custom_attribute_definitions`);
    expect(calls[0].body).toEqual({
      attribute_display_name: 'Tax ID',
      attribute_key: 'tax_id',
      attribute_model: 'company_attribute',
      attribute_display_type: 'text',
      attribute_description: 'Company tax identifier',
      regex_pattern: '^[A-Z]{4}\\d{6}$',
      regex_cue: 'Use the RFC format',
    });
    expect(output[0][0].json).toEqual(created);
  });

  it('update sends list values and regex fields', async () => {
    const updated = attributeDefinition({
      attribute_display_type: 'list',
      attribute_values: ['a', 'b'],
    });
    const { calls } = await runChatwootNode({
      params: {
        resource: 'customAttribute',
        operation: 'update',
        customAttributeId: 9,
        updateFields: { attribute_values: 'a, b,', regex_cue: 'Pick one' },
      },
      responses: [{ method: 'PATCH', url: '/custom_attribute_definitions/9', body: updated }],
    });
    expect(calls[0].url).toBe(`${API}/custom_attribute_definitions/9`);
    expect(calls[0].body).toEqual({ attribute_values: ['a', 'b'], regex_cue: 'Pick one' });
  });

  it('getAll filters by attribute_model (company_attribute)', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'customAttribute',
        operation: 'getAll',
        attributeModel: 'company_attribute',
      },
      responses: [
        { method: 'GET', url: '/custom_attribute_definitions', body: [attributeDefinition()] },
      ],
    });
    expect(calls[0].qs).toEqual({ attribute_model: 'company_attribute' });
    expect(output[0]).toHaveLength(1);
  });

  it('get and delete', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'customAttribute', operation: 'get', customAttributeId: 9 },
      responses: [
        { method: 'GET', url: '/custom_attribute_definitions/9', body: attributeDefinition() },
      ],
    });
    expect(calls[0].url).toBe(`${API}/custom_attribute_definitions/9`);
    expect(output[0][0].json.attribute_key).toBe('tax_id');

    const deleted = await runChatwootNode({
      params: { resource: 'customAttribute', operation: 'delete', customAttributeId: 9 },
      responses: [{ method: 'DELETE', url: '/custom_attribute_definitions/9', status: 204 }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 9 });
  });

  it('an agent token gets a 401 with an administrator hint', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'customAttribute', operation: 'delete', customAttributeId: 9 },
      responses: [
        {
          method: 'DELETE',
          url: '/custom_attribute_definitions/9',
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    });
    const error = (await new Chatwoot().execute
      .call(mock.ctx)
      .catch((e: unknown) => e)) as NodeApiError;
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe(
      'Chatwoot API error 401 Unauthorized: You are not authorized to do this action',
    );
    expect(error.description).toContain('requires an administrator');
  });
});

// ============================================================================
// Custom Filter
// ============================================================================

describe('customFilter', () => {
  const saved = {
    id: 3,
    name: 'VIP contacts',
    filter_type: 'contact',
    query: { payload: [{ attribute_key: 'labels', filter_operator: 'equal_to', values: ['vip'] }] },
    created_at: '2026-09-20T10:00:00.000Z',
    updated_at: '2026-09-20T10:00:00.000Z',
  };

  it('create posts name, filter_type and query', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'customFilter',
        operation: 'create',
        name: 'VIP contacts',
        filterType: 'contact',
        query: JSON.stringify(saved.query),
      },
      responses: [{ method: 'POST', url: '/custom_filters', body: saved }],
    });
    expect(calls[0].url).toBe(`${API}/custom_filters`);
    expect(calls[0].body).toEqual({
      name: 'VIP contacts',
      filter_type: 'contact',
      query: { payload: saved.query.payload.map((condition) => ({ ...condition, query_operator: null })) },
    });
    expect(output[0][0].json).toEqual(saved);
  });

  it('wraps a bare condition array in payload and drops the last query_operator', async () => {
    // Rails permits `query: {}` only: an array would be dropped and the filter saved empty
    const conditions = [
      {
        attribute_key: 'labels',
        filter_operator: 'equal_to',
        values: ['vip'],
        query_operator: 'AND',
      },
    ];
    const created = await runChatwootNode({
      params: {
        resource: 'customFilter',
        operation: 'create',
        name: 'VIP contacts',
        filterType: 'contact',
        query: JSON.stringify(conditions),
      },
      responses: [{ method: 'POST', url: '/custom_filters', body: saved }],
    });
    const expectedQuery = { payload: [{ ...conditions[0], query_operator: null }] };
    expect(created.calls[0].url).toBe(`${API}/custom_filters`);
    expect(created.calls[0].body).toEqual({
      name: 'VIP contacts',
      filter_type: 'contact',
      query: expectedQuery,
    });
    expect(created.output[0][0].json).toEqual(saved);

    const updated = await runChatwootNode({
      params: {
        resource: 'customFilter',
        operation: 'update',
        customFilterId: 3,
        updateFields: { query: JSON.stringify(conditions) },
      },
      responses: [
        { method: 'GET', url: '/custom_filters/3', body: saved },
        { method: 'PATCH', url: '/custom_filters/3', body: saved },
      ],
    });
    expect(updated.calls[1].url).toBe(`${API}/custom_filters/3`);
    expect(updated.calls[1].body).toEqual({ query: expectedQuery });
  });

  it('rejects a query that is not a JSON object or array', async () => {
    const { error, calls } = await executeError({
      resource: 'customFilter',
      operation: 'create',
      name: 'Bad',
      filterType: 'contact',
      query: '"open"',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Query must be a JSON object');
    expect(calls).toHaveLength(0);
  });

  it('getAll, get, update and delete', async () => {
    const list = await runChatwootNode({
      params: { resource: 'customFilter', operation: 'getAll', filterType: 'contact' },
      responses: [{ method: 'GET', url: '/custom_filters', body: [saved] }],
    });
    expect(list.calls[0].qs).toEqual({ filter_type: 'contact' });
    expect(list.output[0]).toHaveLength(1);

    const get = await runChatwootNode({
      params: { resource: 'customFilter', operation: 'get', customFilterId: 3 },
      responses: [{ method: 'GET', url: '/custom_filters/3', body: saved }],
    });
    expect(get.output[0][0].json).toEqual(saved);

    const update = await runChatwootNode({
      params: {
        resource: 'customFilter',
        operation: 'update',
        customFilterId: 3,
        updateFields: { name: 'VIPs' },
      },
      responses: [{ method: 'PATCH', url: '/custom_filters/3', body: { ...saved, name: 'VIPs' } }],
    });
    expect(update.calls[0].body).toEqual({ name: 'VIPs' });

    const removed = await runChatwootNode({
      params: { resource: 'customFilter', operation: 'delete', customFilterId: 3 },
      responses: [{ method: 'DELETE', url: '/custom_filters/3', status: 204 }],
    });
    expect(removed.output[0][0].json).toEqual({ success: true, id: 3 });
  });
});

describe('contact deleteCustomAttributes (CORE-18)', () => {
  it('POST /contacts/:id/destroy_custom_attributes with the keys', async () => {
    const response = { payload: contact(5, { custom_attributes: { crm_id: 'C-1' } }) };
    const { output, calls } = await run(
      {
        operation: 'deleteCustomAttributes',
        contactId: 5,
        customAttributeKeys: 'plan, Plan ,,tier',
      },
      [{ method: 'POST', url: '/contacts/5/destroy_custom_attributes', body: response }],
    );
    expect(calls[0].url).toBe(`${API}/contacts/5/destroy_custom_attributes`);
    expect(calls[0].body).toEqual({ custom_attributes: ['plan', 'Plan', 'tier'] });
    expect(output[0][0].json).toEqual(response);
  });

  it('refuses an empty key list', async () => {
    const { error, calls } = await executeError({
      resource: 'contact',
      operation: 'deleteCustomAttributes',
      contactId: 5,
      customAttributeKeys: ' , ',
    });
    expect(error.message).toBe('Custom Attribute Keys is empty');
    expect(calls).toHaveLength(0);
  });
});
