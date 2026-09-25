/**
 * Chatwoot Trigger: webhook lifecycle (checkExists/create/delete) and webhook() delivery handling.
 *
 * Response and payload fixtures follow Chatwoot 4.18.0 (identical in 4.17.1 for everything used here):
 * - app/views/api/v1/accounts/webhooks/{index,create,update}.json.jbuilder + _webhook.json.jbuilder
 * - lib/webhooks/trigger.rb (X-Chatwoot-Delivery / -Timestamp / -Signature)
 * - Message#webhook_data, Conversations::EventDataPresenter#webhook_data, Inbox::EventDataPresenter,
 *   WebhookListener#handle_typing_status, AgentBotListener
 * Signatures are computed here independently with node:crypto.
 */
import { createHmac } from 'crypto';
import type { IDataObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { ChatwootTrigger } from '../nodes/Chatwoot/ChatwootTrigger.node';
import {
  applyTriggerFilters,
  parseIdList,
  parseTriggerFilters,
} from '../nodes/Chatwoot/trigger/filters';
import {
  RECOVERY_INTERVAL_MS,
  RECOVERY_TIMEOUT_MS,
  buildWebhookName,
  clearWebhookRecoveryCache,
  extractWebhook,
  extractWebhookList,
  isPrivateNetworkUrl,
  isSameNodeWebhookPath,
} from '../nodes/Chatwoot/trigger/lifecycle';
import { REDACTED, redactSecrets } from '../nodes/Chatwoot/trigger/redact';
import { verifyChatwootSignature } from '../nodes/Chatwoot/trigger/signature';
import {
  DEFAULT_WEBHOOK_URL,
  createMockHookFunctions,
  createMockWebhookFunctions,
  mockRetrySleep,
  networkError,
} from './helpers/mockExecuteFunctions';
import type {
  MockHookContext,
  MockNodeOptions,
  MockWebhookContext,
  MockWebhookOptions,
} from './helpers/mockExecuteFunctions';

const trigger = new ChatwootTrigger();
const description = trigger.description;
const methods = trigger.webhookMethods.default;

const API_ROOT = 'https://chatwoot.test/api/v1/accounts/1';
const URL_N8N = DEFAULT_WEBHOOK_URL;
const SECRET = 'q5Zb3yN1u8vXr2kLm9Pw0sTa';

// ----------------------------------------------------------------------------
// Fixtures (Chatwoot 4.18.0 shapes)
// ----------------------------------------------------------------------------

/** _webhook.json.jbuilder */
function webhookJson(overrides: IDataObject = {}): IDataObject {
  return {
    id: 12,
    name: 'n8n / Support bot / Chatwoot Trigger',
    url: URL_N8N,
    account_id: 1,
    subscriptions: ['message_created'],
    secret: SECRET,
    ...overrides,
  };
}

/** index.json.jbuilder */
const listResponse = (...webhooks: IDataObject[]) => ({ payload: { webhooks } });
/** create.json.jbuilder / update.json.jbuilder */
const webhookResponse = (webhook: IDataObject) => ({ payload: { webhook } });

const account = { id: 1, name: 'Acme' };
const inbox = { id: 4, name: 'WhatsApp Ventas' };

/** Contact#webhook_data (no `type` key) */
const contactSender = {
  account,
  additional_attributes: {},
  avatar: '',
  custom_attributes: {},
  email: null,
  id: 77,
  identifier: null,
  name: 'Juan Pérez',
  phone_number: '+5215512345678',
  thumbnail: '',
  blocked: false,
};

/** Conversations::EventDataPresenter#webhook_data (flat conversation, id = display_id) */
const conversation = {
  additional_attributes: {},
  can_reply: true,
  channel: 'Channel::Api',
  // the ContactInbox record itself (every column), not a presenter
  contact_inbox: {
    id: 30,
    contact_id: 77,
    inbox_id: 4,
    source_id: '5215512345678',
    created_at: '2026-09-25T10:00:00.000Z',
    updated_at: '2026-09-25T10:00:00.000Z',
    hmac_verified: false,
    pubsub_token: 'Kq2vW8nZ5yX1bR4tP7mS9dLc',
  },
  id: 1234,
  inbox_id: 4,
  messages: [],
  labels: ['ventas'],
  meta: {
    sender: { ...contactSender, type: 'contact' },
    assignee: null,
    assignee_type: null,
    team: null,
    hmac_verified: false,
  },
  status: 'open',
  custom_attributes: {},
  snoozed_until: null,
  unread_count: 1,
  first_reply_created_at: null,
  priority: null,
  waiting_since: 1758794400,
  agent_last_seen_at: 0,
  contact_last_seen_at: 0,
  last_activity_at: 1758794400,
  timestamp: 1758794400,
  created_at: 1758794400,
  updated_at: 1758794400.123,
  account,
};

/** Message#webhook_data merged with event (WebhookListener#message_created) */
function messageEvent(overrides: IDataObject = {}): IDataObject {
  return {
    account,
    additional_attributes: {},
    content_attributes: {},
    content_type: 'text',
    content: 'Hola, necesito ayuda',
    conversation,
    created_at: '2026-09-25T10:00:00.000Z',
    id: 501,
    inbox,
    message_type: 'incoming',
    private: false,
    sender: contactSender,
    source_id: 'WAID:3EB0C7A1B2',
    event: 'message_created',
    ...overrides,
  };
}

/** Inbox::EventDataPresenter#webhook_data for an API channel (4.14.2+: includes account) */
const inboxCreatedEvent = {
  allow_messages_after_resolved: true,
  lock_to_single_conversation: false,
  auto_assignment_config: {},
  enable_auto_assignment: true,
  enable_email_collect: true,
  greeting_enabled: false,
  greeting_message: null,
  csat_survey_enabled: false,
  business_name: null,
  sender_name_type: 'friendly',
  timezone: 'America/Mexico_City',
  out_of_office_message: null,
  working_hours_enabled: false,
  working_hours: [],
  created_at: '2026-09-25T10:00:00.000Z',
  updated_at: '2026-09-25T10:00:00.000Z',
  channel: {
    id: 9,
    webhook_url: 'https://evolution.example.com/chatwoot/webhook/ventas',
    account_id: 1,
    created_at: '2026-09-25T10:00:00.000Z',
    updated_at: '2026-09-25T10:00:00.000Z',
    hmac_mandatory: false,
    additional_attributes: {},
    hmac_token: 'hmacTOKENvalue123',
    identifier: 'aB3dEf6hIjKl',
    secret: 'channelSecretValue',
  },
  account,
  event: 'inbox_created',
};

/** Ruby's to_json escapes <, > and & (ActiveSupport), so the raw bytes differ from JSON.stringify. */
function rubyJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function sign(raw: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return {
    'X-Chatwoot-Delivery': '7f1c7a5e-1c1e-4f0e-9b4d-2d9a3c1b0e11',
    'X-Chatwoot-Timestamp': String(timestamp),
    'X-Chatwoot-Signature': `sha256=${signature}`,
    'Content-Type': 'application/json',
  };
}

function hook(options: MockNodeOptions): MockHookContext {
  return createMockHookFunctions({ description, ...options });
}

/** Signed delivery of `payload` (raw body = Ruby-style JSON). */
function delivery(
  payload: IDataObject,
  options: Omit<MockWebhookOptions, 'body' | 'rawBody'> & {
    secret?: string;
    unsigned?: boolean;
  } = {},
): MockWebhookContext {
  const raw = rubyJson(payload);
  const { secret, unsigned, headers, ...rest } = options;
  return createMockWebhookFunctions({
    description,
    body: JSON.parse(raw) as IDataObject,
    rawBody: raw,
    headers: { ...(unsigned ? {} : sign(raw, secret ?? SECRET)), ...(headers ?? {}) },
    ...rest,
  });
}

const storedStatic = (overrides: IDataObject = {}) => ({
  node: { webhookId: 12, webhookSecret: SECRET, webhookUrl: URL_N8N, ...overrides },
});

beforeEach(() => clearWebhookRecoveryCache());

// ============================================================================
// Description
// ============================================================================

describe('ChatwootTrigger description', () => {
  it('keeps version 1 and the legacy parameter names, with Account Webhook as the default source', () => {
    expect(description.version).toBe(1);
    const names = description.properties.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'source',
        'events',
        'manualEvents',
        'signingSecret',
        'filters',
        'options',
      ]),
    );
    expect(description.properties.find((p) => p.name === 'source')?.default).toBe('accountWebhook');
    const options = description.properties.find((p) => p.name === 'options');
    expect((options?.options as Array<{ name: string }>).map((o) => o.name)).toEqual([
      'includeDeliveryInfo',
      'includeRawBody',
      'redactChannelSecrets',
      'signatureTolerance',
      'verifySignature',
    ]);
  });

  it('offers the 12 account webhook events (inbox_* included), sorted by name', () => {
    const events = description.properties.find((p) => p.name === 'events');
    const opts = events?.options as Array<{ name: string; value: string; description: string }>;
    expect(opts.map((o) => o.value)).toEqual([
      'contact_created',
      'contact_updated',
      'conversation_created',
      'conversation_status_changed',
      'conversation_typing_off',
      'conversation_typing_on',
      'conversation_updated',
      'inbox_created',
      'inbox_updated',
      'message_created',
      'message_updated',
      'webwidget_triggered',
    ]);
    const sorted = [...opts].sort((a, b) => a.name.localeCompare(b.name));
    expect(opts.map((o) => o.name)).toEqual(sorted.map((o) => o.name));
    for (const opt of opts) expect(opt.description).toBeTruthy();
    expect(opts.find((o) => o.value === 'inbox_created')?.description).toContain(
      'ENABLE_INBOX_EVENTS',
    );
  });

  it('offers agent bot events in manual mode and only asks for credentials in account mode', () => {
    const manual = description.properties.find((p) => p.name === 'manualEvents');
    const values = (manual?.options as Array<{ value: string }>).map((o) => o.value);
    const manualOpts = manual?.options as Array<{
      name: string;
      value: string;
      description: string;
    }>;
    expect(manualOpts.map((o) => o.name)).toEqual(
      [...manualOpts].sort((a, b) => a.name.localeCompare(b.name)).map((o) => o.name),
    );
    // WebhookListener#deliver_api_inbox_webhooks only serves Channel::Api inboxes; widget events come from
    // website inboxes, so API channels never receive webwidget_triggered
    expect(manualOpts.find((o) => o.value === 'webwidget_triggered')?.description).toContain(
      'API channels never receive it',
    );
    // AgentBotListener sends conversation_opened/resolved; account webhooks cannot subscribe to them
    expect(manualOpts.find((o) => o.value === 'conversation_opened')?.description).toContain(
      'Agent bots only',
    );
    expect(values).toEqual(
      expect.arrayContaining([
        'conversation_opened',
        'conversation_resolved',
        'message_created',
        'webwidget_triggered',
      ]),
    );
    expect(description.credentials).toEqual([
      {
        name: 'chatwootApi',
        required: true,
        displayOptions: { show: { source: ['accountWebhook'] } },
      },
    ]);
    const notice = description.properties.find((p) => p.name === 'privateNetworkNotice');
    expect(notice?.type).toBe('notice');
    expect(notice?.displayName).toContain('SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true');
  });
});

// ============================================================================
// Lifecycle
// ============================================================================

describe('checkExists (account webhook)', () => {
  it('returns false when no webhook has this URL (GET /webhooks payload.webhooks)', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ id: 3, url: 'https://other.example.com/hook' })),
        },
      ],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(false);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].method).toBe('GET');
    expect(mock.calls[0].url).toBe(`${API_ROOT}/webhooks`);
    expect(mock.calls[0].headers).toEqual({ api_access_token: 'test-token' });
    expect(mock.calls[0].qs).toBeUndefined();
    expect(mock.calls[0].queryString).toBe('');
    expect(mock.calls[0].body).toBeUndefined();
    expect(mock.staticData.node ?? {}).toEqual({});
  });

  it('adopts the webhook registered for this URL and recovers id + secret (workflows activated with 0.8.x)', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [{ method: 'GET', url: '/webhooks', body: listResponse(webhookJson()) }],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls).toHaveLength(1); // subscriptions and name already match: no PATCH
    expect(mock.staticData.node).toEqual({
      webhookId: 12,
      webhookSecret: SECRET,
      webhookUrl: URL_N8N,
    });
  });

  it('PATCHes subscriptions (and an empty name) when they differ from the node', async () => {
    const existing = webhookJson({ name: null, subscriptions: ['message_created'] });
    const updated = webhookJson({
      name: 'n8n / Chatwoot Trigger',
      subscriptions: ['message_created', 'conversation_status_changed'],
      secret: 'rotatedSecret',
    });
    const mock = hook({
      params: { events: ['message_created', 'conversation_status_changed'] },
      responses: [
        { method: 'GET', url: '/webhooks', body: listResponse(existing) },
        { method: 'PATCH', url: '/webhooks/12', body: webhookResponse(updated) },
      ],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls[1].url).toBe(`${API_ROOT}/webhooks/12`);
    expect(mock.calls[1].method).toBe('PATCH');
    expect(mock.calls[1].qs).toBeUndefined();
    expect(mock.calls[1].body).toEqual({
      subscriptions: ['message_created', 'conversation_status_changed'],
      name: 'n8n / Chatwoot Trigger',
    });
    expect(mock.staticData.node).toEqual({
      webhookId: 12,
      webhookSecret: 'rotatedSecret',
      webhookUrl: URL_N8N,
    });
  });

  it('deletes a webhook stored for an older n8n URL, then asks n8n to create a new one', async () => {
    const oldUrl = 'https://old-n8n.example.com/webhook/test-webhook-id/webhook';
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: { node: { webhookId: 5, webhookSecret: 'old', webhookUrl: oldUrl } },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ id: 5, url: oldUrl })),
        },
        { method: 'DELETE', url: '/webhooks/5' },
      ],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(false);
    expect(mock.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual([
      'GET /webhooks',
      'DELETE /webhooks/5',
    ]);
    expect(mock.staticData.node).toEqual({});
  });

  it('never deletes a stored webhook of another node (static data copied from another workflow)', async () => {
    const otherNodeUrl = 'https://n8n.test/webhook/other-node-webhook-id/webhook';
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: { node: { webhookId: 5, webhookSecret: 'other', webhookUrl: otherNodeUrl } },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ id: 5, url: otherNodeUrl, secret: 'other' })),
        },
      ],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(false);
    expect(mock.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual(['GET /webhooks']);
    expect(mock.staticData.node).toEqual({});
  });

  it('never deletes the production webhook from a test registration ("Listen for test event")', async () => {
    const testUrl = 'https://n8n.test/webhook-test/test-webhook-id/webhook';
    const mock = hook({
      params: { events: ['message_created'] },
      webhookUrl: testUrl,
      // the production registration of this same node (same webhook path tail as the test URL)
      staticData: storedStatic(),
      responses: [{ method: 'GET', url: '/webhooks', body: listResponse(webhookJson()) }],
    });
    (mock.ctx as unknown as { getMode: () => string }).getMode = () => 'manual';
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(false);
    expect(mock.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual(['GET /webhooks']);
  });

  it('never deletes a stored webhook whose URL was changed by hand in Chatwoot', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: {
        node: { webhookId: 5, webhookSecret: 'old', webhookUrl: 'https://old-n8n.example.com/x' },
      },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ id: 5, url: 'https://crm.example.com/hook' })),
        },
      ],
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(false);
    expect(mock.calls).toHaveLength(1);
    expect(mock.staticData.node).toEqual({});
  });

  it('surfaces 401 (non-administrator token) instead of swallowing it', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    });
    const promise = methods.checkExists.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeApiError);
    await expect(promise).rejects.toThrow(
      'Chatwoot API error 401 Unauthorized: You are not authorized to do this action',
    );
  });

  it('validates events and filters before calling Chatwoot', async () => {
    const noEvents = hook({ params: { events: [] } });
    await expect(methods.checkExists.call(noEvents.ctx)).rejects.toThrow(
      'Select at least one event',
    );
    const badFilter = hook({
      params: { events: ['message_created'], filters: { inboxIds: '4, abc' } },
    });
    await expect(methods.checkExists.call(badFilter.ctx)).rejects.toThrow(
      'Inbox IDs must be a comma-separated list of numeric IDs (got "abc")',
    );
    expect(noEvents.calls).toHaveLength(0);
    expect(badFilter.calls).toHaveLength(0);
  });
});

describe('create (account webhook)', () => {
  it('POSTs name, url and subscriptions and stores payload.webhook id + secret', async () => {
    const mock = hook({
      params: { events: ['message_created', 'inbox_created'] },
      responses: [
        {
          method: 'POST',
          url: '/webhooks',
          body: webhookResponse(
            webhookJson({ id: 44, subscriptions: ['message_created', 'inbox_created'] }),
          ),
        },
      ],
    });
    (mock.ctx as unknown as { getWorkflow: () => IDataObject }).getWorkflow = () => ({
      id: 'wf1',
      name: 'Support bot',
      active: true,
    });
    await expect(methods.create.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].qs).toBeUndefined();
    expect(mock.calls[0].method).toBe('POST');
    expect(mock.calls[0].url).toBe(`${API_ROOT}/webhooks`);
    expect(mock.calls[0].headers).toEqual({
      api_access_token: 'test-token',
      'Content-Type': 'application/json',
    });
    expect(mock.calls[0].body).toEqual({
      name: 'n8n / Support bot / Chatwoot Trigger',
      url: URL_N8N,
      subscriptions: ['message_created', 'inbox_created'],
    });
    expect(mock.staticData.node).toEqual({
      webhookId: 44,
      webhookSecret: SECRET,
      webhookUrl: URL_N8N,
    });
  });

  it('marks test registrations in the webhook name', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      webhookUrl: 'https://n8n.test/webhook-test/test-webhook-id/webhook',
      responses: [
        { method: 'POST', url: '/webhooks', body: webhookResponse(webhookJson({ id: 45 })) },
      ],
    });
    (mock.ctx as unknown as { getMode: () => string }).getMode = () => 'manual';
    await methods.create.call(mock.ctx);
    expect((mock.calls[0].body as IDataObject).name).toBe('n8n / Chatwoot Trigger (test)');
  });

  it('stores an empty secret when the server returns none (Chatwoot < 4.12, unsigned)', async () => {
    const legacy = webhookJson({ id: 46 });
    delete legacy.secret;
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [{ method: 'POST', url: '/webhooks', body: webhookResponse(legacy) }],
    });
    await methods.create.call(mock.ctx);
    expect(mock.staticData.node).toEqual({ webhookId: 46, webhookSecret: '', webhookUrl: URL_N8N });
  });

  it('reuses the webhook when Chatwoot answers 422 "Url has already been taken"', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'POST',
          url: '/webhooks',
          status: 422,
          body: { message: 'Url has already been taken', attributes: ['url'] },
        },
        { method: 'GET', url: '/webhooks', body: listResponse(webhookJson({ id: 13 })) },
      ],
    });
    await expect(methods.create.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual([
      'POST /webhooks',
      'GET /webhooks',
    ]);
    expect(mock.staticData.node).toEqual({
      webhookId: 13,
      webhookSecret: SECRET,
      webhookUrl: URL_N8N,
    });
  });

  it('rethrows other 422 validation errors', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'POST',
          url: '/webhooks',
          status: 422,
          body: { message: 'Subscriptions Invalid events', attributes: ['subscriptions'] },
        },
        { method: 'GET', url: '/webhooks', body: listResponse() },
      ],
    });
    const promise = methods.create.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeApiError);
    await expect(promise).rejects.toThrow('Chatwoot API error 422');
  });

  it('fails loudly when the response has no webhook instead of returning false', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [{ method: 'POST', url: '/webhooks', body: { payload: {} } }],
    });
    const promise = methods.create.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeOperationError);
    await expect(promise).rejects.toThrow('Chatwoot did not return the created webhook');
  });

  it('warns when the n8n URL is on a private network (Chatwoot 4.14+ SafeFetch)', async () => {
    const privateUrl = 'http://n8n:5678/webhook/test-webhook-id/webhook';
    const mock = hook({
      params: { events: ['message_created'] },
      webhookUrl: privateUrl,
      responses: [
        {
          method: 'POST',
          url: '/webhooks',
          body: webhookResponse(webhookJson({ url: privateUrl })),
        },
      ],
    });
    const warn = jest.spyOn(mock.ctx.logger, 'warn');
    await methods.create.call(mock.ctx);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true'),
    );
  });
});

describe('delete (account webhook)', () => {
  it('DELETEs the stored webhook and clears the static data', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      responses: [{ method: 'DELETE', url: '/webhooks/12' }],
    });
    await expect(methods.delete.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls[0].url).toBe(`${API_ROOT}/webhooks/12`);
    expect(mock.calls[0].method).toBe('DELETE');
    expect(mock.calls[0].qs).toBeUndefined();
    expect(mock.calls[0].body).toBeUndefined();
    expect(mock.staticData.node).toEqual({});
  });

  it('treats 404 (already deleted in Chatwoot) as success', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      responses: [
        {
          method: 'DELETE',
          url: '/webhooks/12',
          status: 404,
          body: { error: 'Resource could not be found' },
        },
      ],
    });
    await expect(methods.delete.call(mock.ctx)).resolves.toBe(true);
    expect(mock.staticData.node).toEqual({});
  });

  it('throws other errors and keeps the stored id for a later retry', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      responses: [{ method: 'DELETE', url: '/webhooks/12', status: 500, body: { error: 'boom' } }],
    });
    await expect(methods.delete.call(mock.ctx)).rejects.toThrow('Chatwoot API error 500');
    expect(mock.staticData.node).toEqual(storedStatic().node);
  });

  it('finds the orphan by URL when no id was stored (0.8.x never stored it)', async () => {
    const mock = hook({
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(
            webhookJson({ id: 3, url: 'https://x.example.com' }),
            webhookJson({ id: 12 }),
          ),
        },
        { method: 'DELETE', url: '/webhooks/12' },
      ],
    });
    await expect(methods.delete.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual([
      'GET /webhooks',
      'DELETE /webhooks/12',
    ]);
  });
});

describe('activate -> deactivate -> reactivate', () => {
  it('never POSTs a duplicate URL (the 0.8.3 bug) and leaves no orphan', async () => {
    const staticData: Record<string, IDataObject> = {};
    const params = { events: ['message_created'] };
    let registered: IDataObject | undefined;
    const reply = (call: { method: string; body: unknown }) => {
      if (call.method === 'GET') return { body: listResponse(...(registered ? [registered] : [])) };
      if (call.method === 'POST') {
        if (registered) return { status: 422, body: { message: 'Url has already been taken' } };
        registered = webhookJson({ id: 90, secret: 'secret-90' });
        return { body: webhookResponse(registered) };
      }
      registered = undefined; // DELETE
      return { body: '' };
    };
    const activate = async () => {
      const ctx = hook({
        params,
        staticData,
        responses: [{ url: /\/webhooks(\/\d+)?$/, times: Infinity, reply }],
      });
      if (!(await methods.checkExists.call(ctx.ctx))) await methods.create.call(ctx.ctx);
      return ctx;
    };
    const deactivate = async () => {
      const ctx = hook({
        params,
        staticData,
        responses: [{ url: /\/webhooks(\/\d+)?$/, times: Infinity, reply }],
      });
      await methods.delete.call(ctx.ctx);
      return ctx;
    };

    const first = await activate();
    expect(first.calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(staticData.node).toEqual({
      webhookId: 90,
      webhookSecret: 'secret-90',
      webhookUrl: URL_N8N,
    });

    const off = await deactivate();
    expect(off.calls.map((c) => `${c.method} ${c.endpoint}`)).toEqual(['DELETE /webhooks/90']);
    expect(registered).toBeUndefined();

    const again = await activate();
    expect(again.calls.map((c) => c.method)).toEqual(['GET', 'POST']);

    // Republish while active: the webhook is reused, not re-created
    const republish = await activate();
    expect(republish.calls.map((c) => c.method)).toEqual(['GET']);
  });
});

describe('manual source lifecycle', () => {
  it('registers nothing in Chatwoot', async () => {
    const mock = hook({
      params: { source: 'manual', manualEvents: [], signingSecret: 'bot-secret' },
    });
    await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(true);
    await expect(methods.create.call(mock.ctx)).resolves.toBe(true);
    await expect(methods.delete.call(mock.ctx)).resolves.toBe(true);
    expect(mock.calls).toHaveLength(0);
  });

  it('requires the signing secret unless verification is turned off', async () => {
    const missing = hook({ params: { source: 'manual' } });
    await expect(methods.checkExists.call(missing.ctx)).rejects.toThrow(
      'Signing Secret is required',
    );
    const off = hook({ params: { source: 'manual', options: { verifySignature: false } } });
    await expect(methods.checkExists.call(off.ctx)).resolves.toBe(true);
  });
});

// ============================================================================
// webhook(): signature verification
// ============================================================================

function output(result: Awaited<ReturnType<ChatwootTrigger['webhook']>>): IDataObject[] {
  return (result.workflowData?.[0] ?? []).map((item) => item.json);
}

describe('webhook() signature verification (account webhook)', () => {
  it('accepts a correctly signed delivery (HMAC over the raw body, not the parsed JSON)', async () => {
    const payload = messageEvent({ content: 'Precio <$100> & envío' });
    const mock = delivery(payload, {
      params: {
        events: ['message_created'],
        options: { includeRawBody: true, includeDeliveryInfo: true },
      },
      staticData: storedStatic(),
    });
    const raw = rubyJson(payload);
    expect(raw).toContain('\\u003c$100\\u003e \\u0026'); // bytes differ from JSON.stringify(parsed)
    const result = await trigger.webhook.call(mock.ctx);
    const [item] = output(result);
    expect(item).toMatchObject({
      event: 'message_created',
      id: 501,
      content: 'Precio <$100> & envío',
    });
    expect(item.rawBody).toBe(raw);
    const sent = mock.ctx.getHeaderData() as IDataObject;
    const timestamp = Number(sent['x-chatwoot-timestamp']);
    // a Code node can re-verify with rawBody + webhookDelivery (e.g. with Verify Signature turned off)
    const expected = createHmac('sha256', SECRET).update(`${timestamp}.${raw}`).digest('hex');
    expect(item.webhookDelivery).toEqual({
      id: '7f1c7a5e-1c1e-4f0e-9b4d-2d9a3c1b0e11',
      timestamp,
      signature: `sha256=${expected}`,
      signatureVerified: true,
      source: 'accountWebhook',
    });
    expect(mock.calls).toHaveLength(0);
    expect(mock.response.ended).toBe(false); // n8n answers (responseMode onReceived)
  });

  it.each([
    // a mismatch triggers one (rate-limited) reload of the secret, in case it was reset in Chatwoot
    ['a wrong secret', { secret: 'attacker-guess' }, ['/webhooks']],
    ['a missing signature', { unsigned: true }, []],
    [
      'a tampered signature',
      { headers: { 'X-Chatwoot-Signature': 'sha256=' + 'a'.repeat(64) } },
      ['/webhooks'],
    ],
    ['a malformed signature', { headers: { 'X-Chatwoot-Signature': 'v1=abc' } }, []],
  ])('rejects %s with 401', async (_label, extra, endpoints) => {
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      responses: [
        { method: 'GET', url: '/webhooks', body: listResponse(webhookJson()), times: Infinity },
      ],
      ...(extra as IDataObject),
    });
    const result = await trigger.webhook.call(mock.ctx);
    expect(result).toEqual({ noWebhookResponse: true });
    expect(mock.response).toMatchObject({ statusCode: 401, ended: true });
    expect(mock.response.body).toEqual({ message: 'Unauthorized: invalid X-Chatwoot-Signature' });
    expect(mock.calls.map((c) => c.endpoint)).toEqual(endpoints);
  });

  it('rejects replayed deliveries outside the timestamp tolerance (configurable, 0 = off)', async () => {
    const payload = messageEvent();
    const raw = rubyJson(payload);
    const old = Math.floor(Date.now() / 1000) - 600;
    const replay = createMockWebhookFunctions({
      description,
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      body: payload,
      rawBody: raw,
      headers: sign(raw, SECRET, old),
    });
    await trigger.webhook.call(replay.ctx);
    expect(replay.response.statusCode).toBe(401);

    const relaxed = createMockWebhookFunctions({
      description,
      params: { events: ['message_created'], options: { signatureTolerance: 0 } },
      staticData: storedStatic(),
      body: payload,
      rawBody: raw,
      headers: sign(raw, SECRET, old),
    });
    expect(output(await trigger.webhook.call(relaxed.ctx))).toHaveLength(1);
  });

  it('can be turned off (servers that do not sign)', async () => {
    const mock = delivery(messageEvent(), {
      params: {
        events: ['message_created'],
        options: { verifySignature: false, includeDeliveryInfo: true },
      },
      unsigned: true,
    });
    const [item] = output(await trigger.webhook.call(mock.ctx));
    expect(item.webhookDelivery).toEqual({
      id: null,
      timestamp: null,
      signature: null,
      signatureVerified: false,
      source: 'accountWebhook',
    });
    expect(mock.calls).toHaveLength(0);
  });

  it('accepts unsigned deliveries from a webhook without secret (Chatwoot < 4.12)', async () => {
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData: storedStatic({ webhookSecret: '' }),
      unsigned: true,
    });
    expect(output(await trigger.webhook.call(mock.ctx))).toHaveLength(1);
  });

  it('recovers the secret from GET /webhooks when static data has none (active workflows upgraded from 0.8.x)', async () => {
    const staticData: Record<string, IDataObject> = {};
    const first = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData,
      responses: [{ method: 'GET', url: '/webhooks', body: listResponse(webhookJson()) }],
    });
    expect(output(await trigger.webhook.call(first.ctx))).toHaveLength(1);
    expect(first.calls[0].url).toBe(`${API_ROOT}/webhooks`);
    expect(staticData.node).toEqual({ webhookId: 12, webhookSecret: SECRET, webhookUrl: URL_N8N });

    const second = delivery(messageEvent({ id: 502 }), {
      params: { events: ['message_created'] },
      staticData,
    });
    expect(output(await trigger.webhook.call(second.ctx))[0].id).toBe(502);
    expect(second.calls).toHaveLength(0);
  });

  it('rejects signed deliveries when no webhook is registered for this URL', async () => {
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ url: 'https://other.example.com' })),
        },
      ],
    });
    await trigger.webhook.call(mock.ctx);
    expect(mock.response.statusCode).toBe(401);
  });

  it('keeps legacy workflows running (unverified) when the Chatwoot API is unreachable, at most one lookup per minute', async () => {
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'], options: { includeDeliveryInfo: true } },
      responses: [{ method: 'GET', url: '/webhooks', error: networkError('ECONNREFUSED') }],
    });
    const warn = jest.spyOn(mock.ctx.logger, 'warn');
    const [item] = output(await trigger.webhook.call(mock.ctx));
    expect(item.webhookDelivery).toMatchObject({ signatureVerified: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('accepting an unverified delivery'));

    const again = delivery(messageEvent(), { params: { events: ['message_created'] } });
    expect(output(await trigger.webhook.call(again.ctx))).toHaveLength(1);
    expect(again.calls).toHaveLength(0); // cached for RECOVERY_INTERVAL_MS
    expect(RECOVERY_INTERVAL_MS).toBe(60_000);
  });

  it('never retries the secret lookup and bounds it with a timeout (Chatwoot waits at most WEBHOOK_TIMEOUT)', async () => {
    const sleep = mockRetrySleep();
    try {
      const mock = delivery(messageEvent(), {
        params: { events: ['message_created'], options: { includeDeliveryInfo: true } },
        responses: [
          {
            method: 'GET',
            url: '/webhooks',
            status: 429,
            body: { error: 'Retry later' },
            times: 1,
          },
        ],
      });
      const [item] = output(await trigger.webhook.call(mock.ctx));
      // one request, no backoff (the default policy would wait 2.5 s to 35 s on a 429)
      expect(mock.calls).toHaveLength(1);
      expect(mock.calls[0].url).toBe(`${API_ROOT}/webhooks`);
      expect(mock.calls[0].options.timeout).toBe(RECOVERY_TIMEOUT_MS);
      expect(RECOVERY_TIMEOUT_MS).toBeLessThan(5_000);
      expect(sleep.delays).toEqual([]);
      // legacy workflow: accepted unverified instead of failing
      expect(item.webhookDelivery).toMatchObject({ signatureVerified: false });
    } finally {
      sleep.restore();
    }
  });

  it('activation still retries GET /webhooks with the default policy', async () => {
    const sleep = mockRetrySleep();
    try {
      const mock = hook({
        params: { events: ['message_created'] },
        responses: [
          { method: 'GET', url: '/webhooks', status: 503 },
          { method: 'GET', url: '/webhooks', body: listResponse(webhookJson()) },
        ],
      });
      await expect(methods.checkExists.call(mock.ctx)).resolves.toBe(true);
      expect(mock.calls).toHaveLength(2);
      expect(mock.calls[0].options.timeout).toBeUndefined();
      expect(sleep.delays).toHaveLength(1);
    } finally {
      sleep.restore();
    }
  });

  it('logs (does not swallow) a failed secret reload after a signature mismatch', async () => {
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData: storedStatic(),
      secret: 'attacker-guess',
      responses: [{ method: 'GET', url: '/webhooks', error: networkError('ECONNREFUSED') }],
    });
    const warn = jest.spyOn(mock.ctx.logger, 'warn');
    await trigger.webhook.call(mock.ctx);
    expect(mock.response.statusCode).toBe(401);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('could not reload the webhook secret'),
    );
  });

  it('reloads the secret once when it was reset in Chatwoot after activation', async () => {
    const staticData = storedStatic({ webhookSecret: 'secret-before-reset' });
    const mock = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData,
      secret: 'secret-after-reset',
      responses: [
        {
          method: 'GET',
          url: '/webhooks',
          body: listResponse(webhookJson({ secret: 'secret-after-reset' })),
        },
      ],
    });
    expect(output(await trigger.webhook.call(mock.ctx))).toHaveLength(1);
    expect(staticData.node.webhookSecret).toBe('secret-after-reset');
  });

  it('keeps verifying with a secret stored under an older n8n URL, and recovers by URL on mismatch', async () => {
    const oldUrl = 'https://old-n8n.example.com/webhook/test-webhook-id/webhook';
    // WEBHOOK_URL changed but the old URL still routes to n8n: the stored webhook still signs with SECRET
    const stale = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData: storedStatic({ webhookUrl: oldUrl }),
    });
    expect(output(await trigger.webhook.call(stale.ctx))).toHaveLength(1);
    expect(stale.calls).toHaveLength(0);

    // A request signed by the webhook registered for the current URL (different secret)
    const staticData = storedStatic({ webhookUrl: oldUrl, webhookSecret: 'old-secret' });
    const current = delivery(messageEvent(), {
      params: { events: ['message_created'] },
      staticData,
      responses: [{ method: 'GET', url: '/webhooks', body: listResponse(webhookJson()) }],
    });
    expect(output(await trigger.webhook.call(current.ctx))).toHaveLength(1);
    expect(current.calls).toHaveLength(1);
    expect(staticData.node).toEqual({ webhookId: 12, webhookSecret: SECRET, webhookUrl: URL_N8N });
  });
});

// ============================================================================
// webhook(): event selection, filters, output
// ============================================================================

describe('webhook() event selection and filters', () => {
  const run = async (payload: IDataObject, params: IDataObject) => {
    const mock = delivery(payload, {
      params: { events: ['message_created'], ...params },
      staticData: storedStatic(),
    });
    const result = await trigger.webhook.call(mock.ctx);
    return { mock, result, items: output(result) };
  };

  it('answers 200 right away for events that were not selected (no hanging request)', async () => {
    const { mock, result } = await run(messageEvent({ event: 'message_updated' }), {});
    expect(result).toEqual({ noWebhookResponse: true });
    expect(mock.response).toMatchObject({
      statusCode: 200,
      ended: true,
      body: { received: true, ignored: true },
    });
  });

  it('filters by inbox ID (message inbox.id, conversation inbox_id, typing conversation.inbox_id)', async () => {
    expect((await run(messageEvent(), { filters: { inboxIds: '4' } })).items).toHaveLength(1);
    const other = await run(messageEvent({ inbox: { id: 9, name: 'Web' } }), {
      filters: { inboxIds: '4, 5' },
    });
    expect(other.items).toHaveLength(0);
    expect(other.mock.response.statusCode).toBe(200);

    const conv = { ...conversation, inbox_id: 9, event: 'conversation_status_changed' };
    expect(
      (await run(conv, { events: ['conversation_status_changed'], filters: { inboxIds: '4' } }))
        .items,
    ).toHaveLength(0);

    const typing = {
      event: 'conversation_typing_on',
      user: { id: 1, name: 'Ana', email: 'ana@acme.io', type: 'user' },
      conversation,
      is_private: false,
    };
    expect(
      (await run(typing, { events: ['conversation_typing_on'], filters: { inboxIds: '4' } })).items,
    ).toHaveLength(1);

    // contact_* carry no inbox: not affected
    const contact = { ...contactSender, event: 'contact_created' };
    expect(
      (await run(contact, { events: ['contact_created'], filters: { inboxIds: '99' } })).items,
    ).toHaveLength(1);
  });

  it('filters by message type, private notes and sender type', async () => {
    const outgoingByAgent = messageEvent({
      message_type: 'outgoing',
      sender: { id: 3, name: 'Ana', email: 'ana@acme.io', type: 'user' },
      source_id: null,
    });
    expect(
      (await run(outgoingByAgent, { filters: { messageTypes: ['incoming'] } })).items,
    ).toHaveLength(0);
    expect(
      (await run(messageEvent(), { filters: { messageTypes: ['incoming'] } })).items,
    ).toHaveLength(1);

    const note = messageEvent({
      private: true,
      message_type: 'outgoing',
      sender: { id: 3, name: 'Ana', email: 'ana@acme.io', type: 'user' },
    });
    expect((await run(note, { filters: { privateNotes: 'exclude' } })).items).toHaveLength(0);
    expect((await run(note, { filters: { privateNotes: 'only' } })).items).toHaveLength(1);
    expect((await run(messageEvent(), { filters: { privateNotes: 'only' } })).items).toHaveLength(
      0,
    );

    const byBot = messageEvent({
      message_type: 'outgoing',
      sender: { id: 2, name: 'Bot', type: 'agent_bot' },
    });
    expect(
      (await run(byBot, { filters: { senderTypes: ['contact', 'user'] } })).items,
    ).toHaveLength(0);
    expect(
      (await run(messageEvent(), { filters: { senderTypes: ['contact'] } })).items,
    ).toHaveLength(1);
    expect(
      (await run(messageEvent({ sender: null }), { filters: { senderTypes: ['contact'] } })).items,
    ).toHaveLength(0);
  });

  it('avoids loops: own API user and Evolution WAID: echoes', async () => {
    const ownReply = messageEvent({
      message_type: 'outgoing',
      sender: { id: 3, name: 'API user', email: 'bot@acme.io', type: 'user' },
      source_id: null,
    });
    expect((await run(ownReply, { filters: { ignoreUserIds: '3' } })).items).toHaveLength(0);
    const otherAgent = {
      ...ownReply,
      sender: { id: 8, name: 'Luis', email: 'luis@acme.io', type: 'user' },
    };
    expect((await run(otherAgent, { filters: { ignoreUserIds: '3' } })).items).toHaveLength(1);
    // contact 3 is not user 3
    expect(
      (
        await run(messageEvent({ sender: { ...contactSender, id: 3 } }), {
          filters: { ignoreUserIds: '3' },
        })
      ).items,
    ).toHaveLength(1);

    const phoneEcho = messageEvent({
      message_type: 'outgoing',
      source_id: 'WAID:3EB0FF',
      sender: null,
    });
    expect((await run(phoneEcho, { filters: { ignoreWhatsAppEchoes: true } })).items).toHaveLength(
      0,
    );
    // incoming WhatsApp messages also carry WAID: and must still pass
    expect(
      (await run(messageEvent(), { filters: { ignoreWhatsAppEchoes: true } })).items,
    ).toHaveLength(1);
  });

  it('redacts channel secrets of inbox events and never adds the raw body for them', async () => {
    const { items } = await run(inboxCreatedEvent, {
      events: ['inbox_created'],
      options: { includeRawBody: true },
    });
    expect(items).toHaveLength(1);
    const channel = items[0].channel as IDataObject;
    expect(channel).toMatchObject({
      secret: REDACTED,
      hmac_token: REDACTED,
      identifier: 'aB3dEf6hIjKl',
      webhook_url: 'https://evolution.example.com/chatwoot/webhook/ventas',
    });
    expect(items[0].rawBody).toBeUndefined();
    expect(items[0].account).toEqual(account);

    const raw = await run(inboxCreatedEvent, {
      events: ['inbox_created'],
      options: { redactChannelSecrets: false },
    });
    expect((raw.items[0].channel as IDataObject).secret).toBe('channelSecretValue');
  });
});

describe('webhook() manual source (agent bot / API channel)', () => {
  /** AgentBotListener#conversation_resolved: conversation webhook_data + event */
  const resolved = { ...conversation, status: 'resolved', event: 'conversation_resolved' };

  it('verifies with the pasted signing secret and accepts agent bot events', async () => {
    const mock = delivery(resolved, {
      params: {
        source: 'manual',
        signingSecret: 'bot-secret',
        manualEvents: ['conversation_resolved'],
        options: { includeDeliveryInfo: true },
      },
      secret: 'bot-secret',
    });
    const [item] = output(await trigger.webhook.call(mock.ctx));
    expect(item).toMatchObject({ event: 'conversation_resolved', id: 1234, status: 'resolved' });
    expect(item.webhookDelivery).toMatchObject({ signatureVerified: true, source: 'manual' });
    expect(mock.calls).toHaveLength(0); // no credential, no API call
  });

  it('ignores whitespace around a pasted signing secret', async () => {
    const mock = delivery(resolved, {
      params: { source: 'manual', signingSecret: '  bot-secret\n' },
      secret: 'bot-secret',
    });
    expect(output(await trigger.webhook.call(mock.ctx))).toHaveLength(1);
    expect(mock.response.ended).toBe(false); // n8n answers (not a 401 written by the node)

    const blank = hook({ params: { source: 'manual', signingSecret: ' \n' } });
    await expect(methods.checkExists.call(blank.ctx)).rejects.toThrow('Signing Secret is required');
  });

  it('rejects a delivery signed with another secret', async () => {
    const mock = delivery(resolved, {
      params: { source: 'manual', signingSecret: 'bot-secret' },
      secret: 'other-secret',
    });
    await trigger.webhook.call(mock.ctx);
    expect(mock.response.statusCode).toBe(401);
  });

  it('accepts every event when none is selected and answers 200 to unselected ones', async () => {
    const all = delivery(messageEvent(), { params: { source: 'manual', signingSecret: SECRET } });
    expect(output(await trigger.webhook.call(all.ctx))).toHaveLength(1);

    const some = delivery(messageEvent(), {
      params: { source: 'manual', signingSecret: SECRET, manualEvents: ['conversation_opened'] },
    });
    await trigger.webhook.call(some.ctx);
    expect(some.response).toMatchObject({ statusCode: 200, ended: true });
  });
});

// ============================================================================
// Pure helpers
// ============================================================================

describe('trigger helpers', () => {
  it('verifyChatwootSignature follows lib/webhooks/trigger.rb', () => {
    const raw = '{"event":"message_created","id":1}';
    const now = 1_758_794_400_000;
    const ts = String(now / 1000);
    const signature = `sha256=${createHmac('sha256', 's').update(`${ts}.${raw}`).digest('hex')}`;
    expect(
      verifyChatwootSignature({ secret: 's', signature, timestamp: ts, rawBody: raw, now }),
    ).toEqual({ valid: true });
    expect(
      verifyChatwootSignature({
        secret: 's',
        signature: signature.toUpperCase().replace('SHA256', 'sha256'),
        timestamp: ts,
        rawBody: Buffer.from(raw),
        now,
      }),
    ).toEqual({ valid: true });
    expect(
      verifyChatwootSignature({ secret: 's', signature, timestamp: ts, rawBody: raw + ' ', now }),
    ).toEqual({ valid: false, reason: 'signature_mismatch' });
    expect(
      verifyChatwootSignature({ secret: '', signature, timestamp: ts, rawBody: raw, now }),
    ).toEqual({ valid: false, reason: 'missing_secret' });
    expect(
      verifyChatwootSignature({ secret: 's', signature, timestamp: undefined, rawBody: raw, now }),
    ).toEqual({ valid: false, reason: 'missing_timestamp' });
    expect(
      verifyChatwootSignature({
        secret: 's',
        signature,
        timestamp: ts,
        rawBody: raw,
        now: now + 301_000,
      }),
    ).toEqual({ valid: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('extracts webhooks from the wrapped 4.x shapes and flat fallbacks', () => {
    expect(extractWebhookList(listResponse(webhookJson())).map((w) => w.id)).toEqual([12]);
    expect(extractWebhookList({ payload: [webhookJson({ id: 1 })] }).map((w) => w.id)).toEqual([1]);
    expect(extractWebhookList([webhookJson({ id: 2 })]).map((w) => w.id)).toEqual([2]);
    expect(extractWebhookList({ payload: { webhooks: 'x' } })).toEqual([]);
    expect(extractWebhook(webhookResponse(webhookJson()))?.id).toBe(12);
    expect(extractWebhook({ payload: webhookJson({ id: 3 }) })?.id).toBe(3);
    expect(extractWebhook({ payload: {} })).toBeUndefined();
  });

  it('detects obviously private n8n URLs', () => {
    for (const url of [
      'http://localhost:5678/w',
      'http://n8n:5678/w',
      'http://10.0.0.5/w',
      'http://172.20.1.2/w',
      'http://192.168.1.10/w',
      'http://127.0.0.1/w',
      'http://[::1]/w',
      'http://n8n.internal/w',
    ]) {
      expect(isPrivateNetworkUrl(url)).toBe(true);
    }
    for (const url of [
      'https://n8n.example.com/w',
      'https://8.8.8.8/w',
      'http://172.32.0.1/w',
      'not a url',
    ]) {
      expect(isPrivateNetworkUrl(url)).toBe(false);
    }
  });

  it('recognizes URLs of the same trigger node across base URL changes', () => {
    const tail = 'e3b0c442-98fc-1c14-9afb-f4c8996fb924/webhook';
    expect(
      isSameNodeWebhookPath(
        `https://old.example.com/webhook/${tail}`,
        `https://n8n.acme.io/webhook/${tail}`,
      ),
    ).toBe(true);
    // custom N8N_ENDPOINT_WEBHOOK
    expect(
      isSameNodeWebhookPath(`http://n8n:5678/hooks/${tail}`, `https://n8n.acme.io/webhook/${tail}`),
    ).toBe(true);
    expect(
      isSameNodeWebhookPath(
        'https://n8n.acme.io/webhook/other-node-id/webhook',
        `https://n8n.acme.io/webhook/${tail}`,
      ),
    ).toBe(false);
    expect(isSameNodeWebhookPath('https://crm.example.com/hook', 'https://n8n.acme.io/hook')).toBe(
      false,
    );
    expect(isSameNodeWebhookPath('not a url', 'not a url')).toBe(false);
  });

  it('builds a recognizable webhook name', () => {
    expect(buildWebhookName('Support bot', 'Chatwoot Trigger', false)).toBe(
      'n8n / Support bot / Chatwoot Trigger',
    );
    expect(buildWebhookName(undefined, 'Chatwoot Trigger', true)).toBe(
      'n8n / Chatwoot Trigger (test)',
    );
    expect(buildWebhookName('x'.repeat(300), 'y', false)).toHaveLength(255);
  });

  it('parses ID lists and filters', () => {
    expect(parseIdList('1, 2 3,,2', 'Inbox IDs')).toEqual([1, 2, 3]);
    expect(parseIdList(undefined, 'Inbox IDs')).toEqual([]);
    expect(() => parseIdList('0', 'Inbox IDs')).toThrow('got "0"');
    expect(parseTriggerFilters({ privateNotes: 'bogus' }).privateNotes).toBe('include');
    // numeric message_type (push_event_data shape) is understood too
    const filters = parseTriggerFilters({ messageTypes: ['incoming'] });
    expect(applyTriggerFilters({ event: 'message_created', message_type: 0 }, filters)).toEqual({
      pass: true,
    });
    expect(
      applyTriggerFilters({ event: 'message_created', message_type: 1 }, filters),
    ).toMatchObject({ pass: false });
  });

  it('redacts nested provider secrets but keeps timestamps and the public widget token', () => {
    expect(
      redactSecrets({
        provider_config: { api_key: 'k', phone_number_id: '1', webhook_verify_token: 't' },
        imap_password: 'p',
        smtp_password: '',
        refresh_token_expires_at: '2026-10-01',
        website_token: 'public',
        bot_token: null,
      }),
    ).toEqual({
      provider_config: { api_key: REDACTED, phone_number_id: '1', webhook_verify_token: REDACTED },
      imap_password: REDACTED,
      smtp_password: '',
      refresh_token_expires_at: '2026-10-01',
      website_token: 'public',
      bot_token: null,
    });
  });
});
