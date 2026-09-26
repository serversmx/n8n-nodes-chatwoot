/**
 * Execute-level tests for the automation package: Automation Rule, Macro, Campaign, Canned Response
 * and Notification. Response bodies mirror Chatwoot 4.18 jbuilder views / controller renders.
 */
import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import { getCampaignInboxes } from '../nodes/Chatwoot/resources/campaign';
import {
  buildCampaignAudience,
  buildTriggerRules,
  needsCurrentTriggerRules,
  parseTemplateParams,
  toIsoTimestamp,
} from '../nodes/Chatwoot/resources/campaign/helpers';
import {
  renameLegacyConditionKeys,
  resolveExecutionDelay,
} from '../nodes/Chatwoot/resources/automationRule/helpers';
import { toUnixSeconds } from '../nodes/Chatwoot/resources/notification/helpers';
import { createMockExecuteFunctions, runChatwootNode } from './helpers/mockExecuteFunctions';
import type { MockResponse, RecordedCall } from './helpers/mockExecuteFunctions';

const APP = 'https://chatwoot.test/api/v1/accounts/1';
const JSON_HEADERS = { api_access_token: 'test-token', 'Content-Type': 'application/json' };
const NO_BODY_HEADERS = { api_access_token: 'test-token' };

async function runExpectingError(params: Record<string, unknown>, responses: MockResponse[] = []) {
  const mock = createMockExecuteFunctions({
    description: new Chatwoot().description,
    params,
    responses,
  });
  let caught: unknown;
  try {
    await new Chatwoot().execute.call(mock.ctx);
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error('Expected execute() to throw');
  return { error: caught as NodeOperationError | NodeApiError, calls: mock.calls };
}

// ============================================================================
// Fixtures (Chatwoot 4.18 shapes)
// ============================================================================

// app/views/api/v1/accounts/automation_rules/partials/_automation_rule.json.jbuilder
const automationRule = (overrides: IDataObject = {}): IDataObject => ({
  id: 7,
  account_id: 1,
  name: 'Route billing',
  description: 'Billing questions go to the billing team',
  event_name: 'conversation_created',
  conditions: [
    {
      attribute_key: 'content',
      filter_operator: 'contains',
      values: ['invoice'],
      query_operator: null,
    },
  ],
  actions: [{ action_name: 'assign_team', action_params: [2] }],
  created_on: 1758800000,
  active: true,
  execution_delay: null,
  ...overrides,
});

// app/views/api/v1/models/_agent.json.jbuilder
const agent = {
  id: 1,
  account_id: 1,
  availability_status: 'online',
  auto_offline: true,
  confirmed: true,
  email: 'admin@example.com',
  provider: 'email',
  available_name: 'Admin',
  name: 'Admin',
  role: 'administrator',
  thumbnail: '',
};

// app/views/api/v1/models/_macro.json.jbuilder
const macro = (overrides: IDataObject = {}): IDataObject => ({
  id: 4,
  name: 'Escalate',
  visibility: 'global',
  created_by: agent,
  updated_by: agent,
  account_id: 1,
  actions: [{ action_name: 'assign_team', action_params: [2] }],
  ...overrides,
});

// app/views/api/v1/models/_inbox.json.jbuilder (subset)
const inbox = (id: number, name: string, channelType: string): IDataObject => ({
  id,
  avatar_url: '',
  channel_id: id,
  name,
  channel_type: channelType,
  greeting_enabled: false,
  working_hours_enabled: false,
  enable_auto_assignment: true,
  timezone: 'UTC',
});

// app/views/api/v1/models/_campaign.json.jbuilder (one-off WhatsApp campaign)
const whatsappCampaign = (overrides: IDataObject = {}): IDataObject => ({
  id: 5,
  title: 'October promo',
  description: null,
  account_id: 1,
  inbox: inbox(9, 'WhatsApp Sales', 'Channel::Whatsapp'),
  sender: {},
  message: 'Hi {{1}}, our October promo is live',
  template_params: {
    name: 'october_promo',
    language: 'en',
    category: 'MARKETING',
    processed_params: { body: { '1': '{{ contact.name }}' } },
  },
  campaign_status: 'active',
  enabled: true,
  campaign_type: 'one_off',
  scheduled_at: 1790866800,
  started_at: null,
  completed_at: null,
  audience: [{ id: 3, type: 'Label' }],
  trigger_rules: {},
  trigger_only_during_business_hours: false,
  created_at: '2026-09-25T10:00:00.000Z',
  updated_at: '2026-09-25T10:00:00.000Z',
  ...overrides,
});

// Ongoing Website campaign (no scheduled_at/audience keys for ongoing campaigns)
const websiteCampaign = (overrides: IDataObject = {}): IDataObject => ({
  id: 2,
  title: 'Pricing help',
  description: 'Shown on the pricing page',
  account_id: 1,
  inbox: inbox(3, 'Website', 'Channel::WebWidget'),
  sender: agent,
  message: 'Need help choosing a plan?',
  template_params: null,
  campaign_status: 'active',
  enabled: true,
  campaign_type: 'ongoing',
  trigger_rules: { url: 'https://example.com/pricing', time_on_page: 10 },
  trigger_only_during_business_hours: false,
  created_at: '2026-09-25T10:00:00.000Z',
  updated_at: '2026-09-25T10:00:00.000Z',
  ...overrides,
});

// app/views/api/v1/accounts/notifications/index.json.jbuilder (one payload entry)
const notificationItem = (id: number): IDataObject => ({
  id,
  notification_type: 'conversation_assignment',
  push_message_title: `Conversation #${id} has been assigned to you`,
  push_message_body: 'Hello',
  primary_actor_type: 'Conversation',
  primary_actor_id: 1000 + id,
  primary_actor: { id, inbox_id: 1, status: 'open', priority: null, unread_count: 1 },
  read_at: null,
  secondary_actor: null,
  user: {
    id: 1,
    name: 'Admin',
    available_name: 'Admin',
    avatar_url: '',
    type: 'user',
    availability_status: 'online',
    thumbnail: '',
  },
  created_at: 1758800000 + id,
  last_activity_at: 1758800000 + id,
  snoozed_until: null,
  meta: {},
});

// `render json: @notification` (model attributes)
const notificationModel = (overrides: IDataObject = {}): IDataObject => ({
  id: 31,
  user_id: 1,
  notification_type: 'conversation_assignment',
  primary_actor_type: 'Conversation',
  primary_actor_id: 1031,
  read_at: null,
  secondary_actor_type: null,
  secondary_actor_id: null,
  created_at: '2026-09-25T10:00:00.000Z',
  updated_at: '2026-09-25T10:00:00.000Z',
  account_id: 1,
  snoozed_until: null,
  last_activity_at: '2026-09-25T10:00:00.000Z',
  meta: {},
  ...overrides,
});

// app/views/api/v1/accounts/notification_settings/show.json.jbuilder
const ALL_EMAIL_FLAGS = [
  'email_conversation_creation',
  'email_conversation_assignment',
  'email_assigned_conversation_new_message',
  'email_conversation_mention',
  'email_participating_conversation_new_message',
  'email_sla_missed_first_response',
  'email_sla_missed_next_response',
  'email_sla_missed_resolution',
];
const settingsBody = (overrides: IDataObject = {}): IDataObject => ({
  id: 1,
  user_id: 1,
  account_id: 1,
  all_email_flags: ALL_EMAIL_FLAGS,
  selected_email_flags: ['email_conversation_assignment'],
  all_push_flags: ALL_EMAIL_FLAGS.map((flag) => flag.replace('email_', 'push_')),
  selected_push_flags: ['push_conversation_assignment', 'push_conversation_mention'],
  ...overrides,
});

// `render json: @canned_response` (model attributes)
const cannedResponse = (overrides: IDataObject = {}): IDataObject => ({
  id: 12,
  account_id: 1,
  short_code: 'greeting',
  content: 'Hello {{contact.name}}, how can we help?',
  created_at: '2026-09-25T10:00:00.000Z',
  updated_at: '2026-09-25T10:00:00.000Z',
  ...overrides,
});

// ============================================================================
// Automation Rule
// ============================================================================

describe('automationRule', () => {
  it('getAll: GET /automation_rules returns the { payload } body as one item', async () => {
    const body = { payload: [automationRule(), automationRule({ id: 8, name: 'Other' })] };
    const { calls, output } = await runChatwootNode({
      params: { resource: 'automationRule', operation: 'getAll' },
      responses: [{ method: 'GET', url: '/automation_rules', body }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`${APP}/automation_rules`);
    expect(calls[0].qs ?? {}).toEqual({});
    expect(output[0].map((item) => item.json)).toEqual([body]);
  });

  it('get: GET /automation_rules/:id', async () => {
    const body = { payload: automationRule() };
    const { calls, output } = await runChatwootNode({
      params: { resource: 'automationRule', operation: 'get', automationRuleId: 7 },
      responses: [{ method: 'GET', url: '/automation_rules/7', body }],
    });
    expect(calls[0].url).toBe(`${APP}/automation_rules/7`);
    expect(output[0][0].json).toEqual(body);
  });

  it('create: conversation_resolved event, execution_delay and legacy "company" condition mapping', async () => {
    const created = automationRule({ event_name: 'conversation_resolved', execution_delay: 240 });
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'automationRule',
        operation: 'create',
        name: 'Follow up resolved',
        eventName: 'conversation_resolved',
        conditions: JSON.stringify([
          {
            attribute_key: 'company',
            filter_operator: 'equal_to',
            values: ['Acme'],
            query_operator: 'and',
          },
          {
            attribute_key: 'company',
            filter_operator: 'equal_to',
            values: ['Acme'],
            query_operator: null,
            custom_attribute_type: 'contact_attribute',
          },
        ]),
        actions: '[{"action_name":"send_message","action_params":["Thanks!"]}]',
        additionalFields: { description: 'Delayed follow-up', active: false, execution_delay: 240 },
      },
      responses: [{ method: 'POST', url: '/automation_rules', body: created }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/automation_rules`);
    expect(calls[0].headers).toEqual(JSON_HEADERS);
    expect(calls[0].body).toEqual({
      name: 'Follow up resolved',
      event_name: 'conversation_resolved',
      conditions: [
        {
          attribute_key: 'company_name',
          filter_operator: 'equal_to',
          values: ['Acme'],
          query_operator: 'and',
        },
        // custom attribute named "company" is left alone
        {
          attribute_key: 'company',
          filter_operator: 'equal_to',
          values: ['Acme'],
          query_operator: null,
          custom_attribute_type: 'contact_attribute',
        },
      ],
      actions: [{ action_name: 'send_message', action_params: ['Thanks!'] }],
      description: 'Delayed follow-up',
      active: false,
      execution_delay: 240,
    });
    expect(output[0][0].json).toEqual(created);
  });

  it.each(['[]', '{}', 'null'])('create rejects unsafe Conditions %s before an API call', async (conditions) => {
    const { error, calls } = await runExpectingError({
      resource: 'automationRule', operation: 'create', name: 'Rule', eventName: 'message_created', conditions,
      actions: '[{"action_name":"resolve_conversation","action_params":[]}]',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Add at least one condition');
    expect(error.context.itemIndex).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('rejects the default empty Conditions and explicit empty updates', async () => {
    for (const params of [
      { resource: 'automationRule', operation: 'create', name: 'Rule', eventName: 'message_created' },
      { resource: 'automationRule', operation: 'update', automationRuleId: 7, updateFields: { conditions: '[]' } },
    ]) {
      const { error, calls } = await runExpectingError(params);
      expect(error.message).toContain('without conditions runs on every event');
      expect(calls).toHaveLength(0);
    }
  });

  it('create: an execution delay of 0 is not sent', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'automationRule',
        operation: 'create',
        name: 'Instant',
        eventName: 'message_created',
        conditions: JSON.stringify(automationRule().conditions),
        actions: '[]',
        additionalFields: { execution_delay: 0 },
      },
      responses: [{ method: 'POST', url: '/automation_rules', body: automationRule() }],
    });
    expect(calls[0].body).toEqual({
      name: 'Instant',
      event_name: 'message_created',
      conditions: automationRule().conditions,
      actions: [],
    });
  });

  it('create: rejects an execution delay outside 10..43200 minutes before calling Chatwoot', async () => {
    const { error, calls } = await runExpectingError({
      resource: 'automationRule',
      operation: 'create',
      name: 'Too short',
      eventName: 'conversation_updated',
      conditions: JSON.stringify(automationRule().conditions),
      actions: '[]',
      additionalFields: { execution_delay: 5 },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('between 10 and 43200 minutes');
    expect(error.context.itemIndex).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('create: surfaces the 422 of accounts without delayed automations', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'automationRule',
        operation: 'create',
        name: 'Delayed',
        eventName: 'conversation_updated',
        conditions: JSON.stringify(automationRule().conditions),
        actions: '[]',
        additionalFields: { execution_delay: 60 },
      },
      responses: [
        {
          method: 'POST',
          url: '/automation_rules',
          status: 422,
          body: { error: 'Delayed automations are not enabled for this account.' },
        },
      ],
    });
    expect(output[0][0].json).toMatchObject({
      error:
        'Chatwoot API error 422 Unprocessable Entity: Delayed automations are not enabled for this account.',
      httpCode: '422',
    });
  });

  it('update: sends only the added fields; delay 0 clears it (null); conditions are mapped', async () => {
    const updated = {
      payload: automationRule({ name: 'Renamed', event_name: 'conversation_opened' }),
    };
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'automationRule',
        operation: 'update',
        automationRuleId: 7,
        updateFields: {
          name: 'Renamed',
          event_name: 'conversation_opened',
          execution_delay: 0,
          conditions:
            '[{"attribute_key":"company","filter_operator":"contains","values":["Acme"],"query_operator":null}]',
          actions: '[{"action_name":"add_label","action_params":["vip"]}]',
        },
      },
      responses: [{ method: 'PATCH', url: '/automation_rules/7', body: updated }],
    });
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe(`${APP}/automation_rules/7`);
    expect(calls[0].body).toEqual({
      name: 'Renamed',
      event_name: 'conversation_opened',
      conditions: [
        {
          attribute_key: 'company_name',
          filter_operator: 'contains',
          values: ['Acme'],
          query_operator: null,
        },
      ],
      actions: [{ action_name: 'add_label', action_params: ['vip'] }],
      execution_delay: null,
    });
    expect(output[0][0].json).toEqual(updated);
  });

  it('shows an execution hint when a legacy "company" condition was rewritten', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'automationRule',
        operation: 'update',
        automationRuleId: 7,
        updateFields: {
          conditions: [
            {
              attribute_key: 'company',
              filter_operator: 'equal_to',
              values: ['Acme'],
              query_operator: null,
            },
          ],
        },
      },
      responses: [
        { method: 'PATCH', url: '/automation_rules/7', body: { payload: automationRule() } },
      ],
    });
    const addExecutionHints = jest.fn();
    Object.assign(mock.ctx, { addExecutionHints });
    await new Chatwoot().execute.call(mock.ctx);
    expect(mock.calls[0].body).toEqual({
      conditions: [
        {
          attribute_key: 'company_name',
          filter_operator: 'equal_to',
          values: ['Acme'],
          query_operator: null,
        },
      ],
    });
    expect(addExecutionHints).toHaveBeenCalledTimes(1);
    expect(addExecutionHints.mock.calls[0][0]).toMatchObject({ type: 'warning' });
    expect(addExecutionHints.mock.calls[0][0].message).toContain('company_name');
  });

  it('adds the legacy "company" hint once per execution, not once per item', async () => {
    const legacy = {
      attribute_key: 'company',
      filter_operator: 'equal_to',
      values: ['Acme'],
      query_operator: null,
    };
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      items: [{ json: {} }, { json: {} }],
      params: {
        resource: 'automationRule',
        operation: 'update',
        automationRuleId: 7,
        updateFields: { conditions: [legacy] },
      },
      responses: [
        {
          method: 'PATCH',
          url: '/automation_rules/7',
          body: { payload: automationRule() },
          times: 2,
        },
      ],
    });
    const addExecutionHints = jest.fn();
    Object.assign(mock.ctx, { addExecutionHints });
    const output = await new Chatwoot().execute.call(mock.ctx);
    expect(mock.calls).toHaveLength(2);
    for (const call of mock.calls) {
      expect(call.body).toEqual({ conditions: [{ ...legacy, attribute_key: 'company_name' }] });
    }
    expect(output[0]).toHaveLength(2);
    expect(addExecutionHints).toHaveBeenCalledTimes(1);

    // A new execution (new context) gets its own hint
    const next = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'automationRule',
        operation: 'update',
        automationRuleId: 7,
        updateFields: { conditions: [legacy] },
      },
      responses: [
        { method: 'PATCH', url: '/automation_rules/7', body: { payload: automationRule() } },
      ],
    });
    const nextHints = jest.fn();
    Object.assign(next.ctx, { addExecutionHints: nextHints });
    await new Chatwoot().execute.call(next.ctx);
    expect(nextHints).toHaveBeenCalledTimes(1);
  });

  it('update: a blank Execution Delay is not sent (not read as 0), and no hint without legacy keys', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'automationRule',
        operation: 'update',
        automationRuleId: 7,
        updateFields: {
          execution_delay: '  ',
          conditions:
            '[{"attribute_key":"company_name","filter_operator":"equal_to","values":["Acme"],"query_operator":null}]',
        },
      },
      responses: [
        { method: 'PATCH', url: '/automation_rules/7', body: { payload: automationRule() } },
      ],
    });
    const addExecutionHints = jest.fn();
    Object.assign(mock.ctx, { addExecutionHints });
    await new Chatwoot().execute.call(mock.ctx);
    // "  " (e.g. an expression that resolved to blank) must not become 0 (which would send execution_delay: null and clear the delay)
    expect(mock.calls[0].body).toEqual({
      conditions: [
        {
          attribute_key: 'company_name',
          filter_operator: 'equal_to',
          values: ['Acme'],
          query_operator: null,
        },
      ],
    });
    expect(addExecutionHints).not.toHaveBeenCalled();
  });

  it('clone: POST /automation_rules/:id/clone without a body', async () => {
    const cloned = { payload: automationRule({ id: 11 }) };
    const { calls, output } = await runChatwootNode({
      params: { resource: 'automationRule', operation: 'clone', automationRuleId: 7 },
      responses: [{ method: 'POST', url: '/automation_rules/7/clone', body: cloned }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/automation_rules/7/clone`);
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].headers).toEqual(NO_BODY_HEADERS);
    expect(output[0][0].json).toEqual(cloned);
  });

  it('clone: surfaces the 422 of a delayed rule when the account lost delayed_automations', async () => {
    const { error, calls } = await runExpectingError(
      { resource: 'automationRule', operation: 'clone', automationRuleId: 7 },
      [
        {
          method: 'POST',
          url: '/automation_rules/7/clone',
          status: 422,
          body: { error: 'Delayed automations are not enabled for this account.' },
        },
      ],
    );
    expect(calls).toHaveLength(1); // POST is not retried
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe(
      'Chatwoot API error 422 Unprocessable Entity: Delayed automations are not enabled for this account.',
    );
  });

  it('delete: DELETE /automation_rules/:id emits { success, id }', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'automationRule', operation: 'delete', automationRuleId: 7 },
      responses: [{ method: 'DELETE', url: '/automation_rules/7' }],
    });
    expect(calls[0].method).toBe('DELETE');
    expect(output[0][0].json).toEqual({ success: true, id: 7 });
  });

  it('description: offers conversation_resolved and the Clone operation', () => {
    const properties = new Chatwoot().description.properties;
    const eventName = properties.find(
      (p) => p.name === 'eventName' && p.displayOptions?.show?.resource?.includes('automationRule'),
    );
    const values = (eventName?.options as Array<{ value: string }>).map((o) => o.value);
    expect(values).toEqual(
      expect.arrayContaining([
        'conversation_created',
        'conversation_opened',
        'conversation_resolved',
        'conversation_updated',
        'message_created',
      ]),
    );
    const operations = properties.find(
      (p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('automationRule'),
    );
    expect((operations?.options as Array<{ value: string }>).map((o) => o.value)).toContain(
      'clone',
    );
  });
});

// ============================================================================
// Macro
// ============================================================================

describe('macro', () => {
  it('getAll / get: GET /macros and /macros/:id', async () => {
    const list = { payload: [macro(), macro({ id: 6, visibility: 'personal' })] };
    const { calls, output } = await runChatwootNode({
      params: { resource: 'macro', operation: 'getAll' },
      responses: [{ method: 'GET', url: '/macros', body: list }],
    });
    expect(calls[0].url).toBe(`${APP}/macros`);
    expect(output[0][0].json).toEqual(list);

    const single = await runChatwootNode({
      params: { resource: 'macro', operation: 'get', macroId: 4 },
      responses: [{ method: 'GET', url: '/macros/4', body: { payload: macro() } }],
    });
    expect(single.calls[0].url).toBe(`${APP}/macros/4`);
    expect(single.output[0][0].json).toEqual({ payload: macro() });
  });

  it('create: always sends visibility (personal by default, never NULL)', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'macro',
        operation: 'create',
        name: 'Escalate',
        actions: '[{"action_name":"assign_team","action_params":[2]}]',
      },
      responses: [
        { method: 'POST', url: '/macros', body: { payload: macro({ visibility: 'personal' }) } },
      ],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/macros`);
    expect(calls[0].body).toEqual({
      name: 'Escalate',
      actions: [{ action_name: 'assign_team', action_params: [2] }],
      visibility: 'personal',
    });
    expect(output[0][0].json).toEqual({ payload: macro({ visibility: 'personal' }) });

    const global = await runChatwootNode({
      params: {
        resource: 'macro',
        operation: 'create',
        name: 'Escalate',
        actions: '[]',
        additionalFields: { visibility: 'global' },
      },
      responses: [{ method: 'POST', url: '/macros', body: { payload: macro() } }],
    });
    expect(global.calls[0].body).toEqual({ name: 'Escalate', actions: [], visibility: 'global' });
  });

  it('update without Visibility: reads the macro first and resends its visibility', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'macro',
        operation: 'update',
        macroId: 4,
        updateFields: { name: 'Escalate v2' },
      },
      responses: [
        { method: 'GET', url: '/macros/4', body: { payload: macro() } },
        { method: 'PATCH', url: '/macros/4', body: { payload: macro({ name: 'Escalate v2' }) } },
      ],
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${APP}/macros/4`,
      `PATCH ${APP}/macros/4`,
    ]);
    expect(calls[1].body).toEqual({ name: 'Escalate v2', visibility: 'global' });
    expect(output[0][0].json).toEqual({ payload: macro({ name: 'Escalate v2' }) });
  });

  it('update with Visibility: a single PATCH', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'macro',
        operation: 'update',
        macroId: 4,
        updateFields: {
          visibility: 'personal',
          actions: '[{"action_name":"resolve_conversation","action_params":[]}]',
        },
      },
      responses: [
        { method: 'PATCH', url: '/macros/4', body: { payload: macro({ visibility: 'personal' }) } },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      visibility: 'personal',
      actions: [{ action_name: 'resolve_conversation', action_params: [] }],
    });
  });

  it('update of a global macro by an agent surfaces the 401 (admin-only since 4.14)', async () => {
    const { error } = await runExpectingError(
      {
        resource: 'macro',
        operation: 'update',
        macroId: 4,
        updateFields: { name: 'x', visibility: 'global' },
      },
      [
        {
          method: 'PATCH',
          url: '/macros/4',
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    );
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toBe(
      'Chatwoot API error 401 Unauthorized: You are not authorized to do this action',
    );
  });

  it('execute: sends every conversation id and reports "queued" (Chatwoot answers head :ok)', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'macro',
        operation: 'execute',
        macroId: 4,
        conversationId: 5,
        options: { additionalConversationIds: '12, 15,5, ' },
      },
      responses: [{ method: 'POST', url: '/macros/4/execute' }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/macros/4/execute`);
    expect(calls[0].body).toEqual({ conversation_ids: [5, 12, 15] });
    expect(output[0].map((item) => item.json)).toEqual([
      { success: true, status: 'queued', macroId: 4, conversationIds: [5, 12, 15] },
    ]);
  });

  it('execute: invalid additional conversation id fails before the request', async () => {
    const { error, calls } = await runExpectingError({
      resource: 'macro',
      operation: 'execute',
      macroId: 4,
      conversationId: 5,
      options: { additionalConversationIds: '12, abc' },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('Additional Conversation IDs must be a positive integer');
    expect(calls).toHaveLength(0);
  });

  it('delete: DELETE /macros/:id', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'macro', operation: 'delete', macroId: 4 },
      responses: [{ method: 'DELETE', url: '/macros/4' }],
    });
    expect(calls[0].url).toBe(`${APP}/macros/4`);
    expect(output[0][0].json).toEqual({ success: true, id: 4 });
  });
});

// ============================================================================
// Notification
// ============================================================================

describe('notification', () => {
  const page = (from: number, count: number, total: number, currentPage: number) => ({
    data: {
      meta: { unread_count: total, count: total, current_page: String(currentPage) },
      payload: Array.from({ length: count }, (_, k) => notificationItem(from + k)),
    },
  });

  it('getAll (Return All): pages through data.payload with includes[] and sort_order', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'getAll',
        returnAll: true,
        options: { includes_read: true, includes_snoozed: true, sort_order: 'asc' },
      },
      responses: [
        { method: 'GET', url: '/notifications', body: page(1, 15, 18, 1) },
        { method: 'GET', url: '/notifications', body: page(16, 3, 18, 2) },
      ],
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${APP}/notifications`);
    expect(calls[0].qs).toEqual({ includes: ['read', 'snoozed'], sort_order: 'asc', page: 1 });
    expect(calls[0].queryString).toBe('includes[]=read&includes[]=snoozed&sort_order=asc&page=1');
    expect(calls[1].qs).toMatchObject({ page: 2 });
    expect(output[0]).toHaveLength(18);
    expect(output[0][0].json).toEqual(notificationItem(1));
    expect(output[0][17].json.id).toBe(18);
  });

  it('getAll (Limit): stops once the limit is reached', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'getAll', returnAll: false, limit: 5 },
      responses: [{ method: 'GET', url: '/notifications', body: page(1, 15, 40, 1) }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].qs).toEqual({ page: 1 });
    expect(output[0].map((item) => item.json.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('snooze: converts the date/time to Unix seconds', async () => {
    const snoozed = notificationModel({ snoozed_until: '2026-10-01T15:00:00.000Z' });
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'snooze',
        notificationId: 31,
        snoozedUntil: '2026-10-01T15:00:00Z',
      },
      responses: [{ method: 'POST', url: '/notifications/31/snooze', body: snoozed }],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/notifications/31/snooze`);
    expect(calls[0].body).toEqual({ snoozed_until: 1790866800 });
    expect(output[0][0].json).toEqual(snoozed);
  });

  it('snooze: accepts Unix timestamps (seconds or milliseconds) and rejects garbage', async () => {
    const ms = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'snooze',
        notificationId: 31,
        snoozedUntil: '1790866800000',
      },
      responses: [{ method: 'POST', url: '/notifications/31/snooze', body: notificationModel() }],
    });
    expect(ms.calls[0].body).toEqual({ snoozed_until: 1790866800 });

    const { error, calls } = await runExpectingError({
      resource: 'notification',
      operation: 'snooze',
      notificationId: 31,
      snoozedUntil: 'tomorrow-ish',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Snoozed Until must be a date/time');
    expect(calls).toHaveLength(0);
  });

  it('markRead / markUnread / delete', async () => {
    const read = await runChatwootNode({
      params: { resource: 'notification', operation: 'markRead', notificationId: 31 },
      responses: [
        {
          method: 'PATCH',
          url: '/notifications/31',
          body: notificationModel({ read_at: '2026-09-25T11:00:00.000Z' }),
        },
      ],
    });
    expect(read.calls[0].method).toBe('PATCH');
    expect(read.calls[0].body).toBeUndefined();
    expect(read.output[0][0].json.read_at).toBe('2026-09-25T11:00:00.000Z');

    const unread = await runChatwootNode({
      params: { resource: 'notification', operation: 'markUnread', notificationId: 31 },
      responses: [{ method: 'POST', url: '/notifications/31/unread', body: notificationModel() }],
    });
    expect(unread.calls[0].url).toBe(`${APP}/notifications/31/unread`);

    const deleted = await runChatwootNode({
      params: { resource: 'notification', operation: 'delete', notificationId: 31 },
      responses: [{ method: 'DELETE', url: '/notifications/31' }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 31 });
  });

  it('readAll: POST /notifications/read_all emits { success: true } (head :ok)', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'readAll' },
      responses: [{ method: 'POST', url: '/notifications/read_all' }],
    });
    expect(calls[0].url).toBe(`${APP}/notifications/read_all`);
    expect(calls[0].body).toBeUndefined();
    expect(output[0].map((item) => item.json)).toEqual([{ success: true }]);
  });

  it('unreadCount: wraps the bare number Chatwoot renders', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'unreadCount' },
      responses: [{ method: 'GET', url: '/notifications/unread_count', body: '7' }],
    });
    expect(calls[0].url).toBe(`${APP}/notifications/unread_count`);
    expect(output[0].map((item) => item.json)).toEqual([{ unread_count: 7 }]);
  });

  it('unreadCount: a count of 0 is kept (not treated as an empty body)', async () => {
    const { output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'unreadCount' },
      responses: [{ method: 'GET', url: '/notifications/unread_count', body: '0' }],
    });
    expect(output[0].map((item) => item.json)).toEqual([{ unread_count: 0 }]);
  });

  it('getAll (Return All): stops on data.meta.count when the last page is full (no extra request)', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'getAll', returnAll: true },
      responses: [
        { method: 'GET', url: '/notifications', body: page(1, 15, 30, 1) },
        { method: 'GET', url: '/notifications', body: page(16, 15, 30, 2) },
      ],
    });
    expect(calls.map((c) => c.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0].map((item) => item.json.id)).toEqual(
      Array.from({ length: 30 }, (_, k) => k + 1),
    );
  });

  it('deleteAll: POST /notifications/destroy_all with the type', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'deleteAll', deleteType: 'all' },
      responses: [{ method: 'POST', url: '/notifications/destroy_all' }],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/notifications/destroy_all`);
    expect(calls[0].body).toEqual({ type: 'all' });
    expect(output[0][0].json).toEqual({ success: true, status: 'queued', type: 'all' });

    const readOnly = await runChatwootNode({
      params: { resource: 'notification', operation: 'deleteAll' },
      responses: [{ method: 'POST', url: '/notifications/destroy_all' }],
    });
    expect(readOnly.calls[0].body).toEqual({ type: 'read' });
  });

  it('getSettings: GET /notification_settings', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'notification', operation: 'getSettings' },
      responses: [{ method: 'GET', url: '/notification_settings', body: settingsBody() }],
    });
    expect(calls[0].url).toBe(`${APP}/notification_settings`);
    expect(output[0][0].json).toEqual(settingsBody());
  });

  it('updateSettings: keeps the list the user did not set (Chatwoot would clear it)', async () => {
    const updated = settingsBody({ selected_email_flags: ['email_conversation_mention'] });
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'updateSettings',
        notificationSettings: { selected_email_flags: ['email_conversation_mention'] },
      },
      responses: [
        { method: 'GET', url: '/notification_settings', body: settingsBody() },
        { method: 'PATCH', url: '/notification_settings', body: updated },
      ],
    });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH']);
    expect(calls[1].url).toBe(`${APP}/notification_settings`);
    expect(calls[1].body).toEqual({
      notification_settings: {
        selected_email_flags: ['email_conversation_mention'],
        selected_push_flags: ['push_conversation_assignment', 'push_conversation_mention'],
      },
    });
    expect(output[0][0].json).toEqual(updated);
  });

  it('updateSettings: both lists (an empty list turns a channel off) -> single PATCH; none -> error', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'notification',
        operation: 'updateSettings',
        notificationSettings: {
          selected_email_flags: [],
          selected_push_flags: ['push_conversation_creation'],
        },
      },
      responses: [{ method: 'PATCH', url: '/notification_settings', body: settingsBody() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      notification_settings: {
        selected_email_flags: [],
        selected_push_flags: ['push_conversation_creation'],
      },
    });

    const { error } = await runExpectingError({
      resource: 'notification',
      operation: 'updateSettings',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Add Email Notifications and/or Push Notifications');
  });
});

// ============================================================================
// Campaign
// ============================================================================

describe('campaign', () => {
  it('getAll / get / delete', async () => {
    const list = [websiteCampaign(), whatsappCampaign()];
    const all = await runChatwootNode({
      params: { resource: 'campaign', operation: 'getAll' },
      responses: [{ method: 'GET', url: '/campaigns', body: list }],
    });
    expect(all.calls[0].url).toBe(`${APP}/campaigns`);
    expect(all.output[0].map((item) => item.json)).toEqual(list);

    const one = await runChatwootNode({
      params: { resource: 'campaign', operation: 'get', campaignId: 5 },
      responses: [{ method: 'GET', url: '/campaigns/5', body: whatsappCampaign() }],
    });
    expect(one.calls[0].url).toBe(`${APP}/campaigns/5`);
    expect(one.output[0][0].json).toEqual(whatsappCampaign());

    const deleted = await runChatwootNode({
      params: { resource: 'campaign', operation: 'delete', campaignId: 5 },
      responses: [{ method: 'DELETE', url: '/campaigns/5' }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 5 });
  });

  it('create (Website): inbox, trigger rules, sender, enabled and business hours', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'create',
        title: 'Pricing help',
        message: 'Need help choosing a plan?',
        inboxId: 3,
        additionalFields: {
          description: 'Shown on the pricing page',
          trigger_url: 'https://example.com/pricing',
          time_on_page: 10,
          sender_id: 1,
          enabled: true,
          trigger_only_during_business_hours: true,
        },
      },
      responses: [{ method: 'POST', url: '/campaigns', body: websiteCampaign() }],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/campaigns`);
    expect(calls[0].headers).toEqual(JSON_HEADERS);
    expect(calls[0].body).toEqual({
      title: 'Pricing help',
      message: 'Need help choosing a plan?',
      inbox_id: 3,
      description: 'Shown on the pricing page',
      enabled: true,
      trigger_only_during_business_hours: true,
      sender_id: 1,
      trigger_rules: { url: 'https://example.com/pricing', time_on_page: 10 },
    });
    expect(output[0][0].json).toEqual(websiteCampaign());
  });

  it('create (WhatsApp): audience labels (merged, deduplicated), template params and ISO scheduled_at', async () => {
    const templateParams = {
      name: 'october_promo',
      language: 'en',
      category: 'MARKETING',
      processed_params: { body: { '1': '{{ contact.name }}' } },
    };
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'create',
        title: 'October promo',
        message: 'Hi {{1}}, our October promo is live',
        inboxId: 9,
        additionalFields: {
          audienceLabelIds: '3, 7',
          audience: '[7, {"type":"Label","id":9}]',
          template_params: JSON.stringify(templateParams),
          scheduled_at: '2026-10-01T15:00:00Z',
        },
      },
      responses: [{ method: 'POST', url: '/campaigns', body: whatsappCampaign() }],
    });
    expect(calls[0].body).toEqual({
      title: 'October promo',
      message: 'Hi {{1}}, our October promo is live',
      inbox_id: 9,
      scheduled_at: '2026-10-01T15:00:00.000Z',
      audience: [
        { type: 'Label', id: 3 },
        { type: 'Label', id: 7 },
        { type: 'Label', id: 9 },
      ],
      template_params: templateParams,
    });
    expect(output[0][0].json).toEqual(whatsappCampaign());
  });

  it('create: falls back to the legacy Additional Fields > Inbox ID (pre-0.9.0 workflows)', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'create',
        title: 'SMS blast',
        message: 'Sale today',
        additionalFields: { inbox_id: 4, audienceLabelIds: '3' },
      },
      responses: [{ method: 'POST', url: '/campaigns', body: whatsappCampaign({ id: 6 }) }],
    });
    expect(calls[0].body).toEqual({
      title: 'SMS blast',
      message: 'Sale today',
      inbox_id: 4,
      audience: [{ type: 'Label', id: 3 }],
    });
  });

  it('create: without an inbox fails with a clear error and no request', async () => {
    const { error, calls } = await runExpectingError({
      resource: 'campaign',
      operation: 'create',
      title: 'x',
      message: 'y',
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('Inbox is required to create a campaign');
    expect(calls).toHaveLength(0);
  });

  it('create: template params without name/language and non-label audiences are rejected', async () => {
    const template = await runExpectingError({
      resource: 'campaign',
      operation: 'create',
      title: 'x',
      message: 'y',
      inboxId: 9,
      additionalFields: { template_params: '{"name":"october_promo"}' },
    });
    expect(template.error.message).toContain('"name" and "language"');
    expect(template.calls).toHaveLength(0);

    const audience = await runExpectingError({
      resource: 'campaign',
      operation: 'create',
      title: 'x',
      message: 'y',
      inboxId: 9,
      additionalFields: { audience: '[{"attribute_key":"country","values":["MX"]}]' },
    });
    expect(audience.error.message).toBe('Audience label ID must be a positive integer');
    expect(audience.calls).toHaveLength(0);
  });

  it('create: a 422 for an API-channel inbox is surfaced with the Chatwoot message', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'campaign', operation: 'create', title: 'x', message: 'y', inboxId: 20 },
      responses: [
        {
          method: 'POST',
          url: '/campaigns',
          status: 422,
          body: { message: 'Inbox Unsupported Inbox type', attributes: ['inbox'] },
        },
      ],
    });
    expect(output[0][0].json).toMatchObject({ httpCode: '422' });
    expect(output[0][0].json.error).toContain('Unsupported Inbox type');
  });

  it('update: only Trigger URL -> reads the campaign and keeps time_on_page', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'update',
        campaignId: 2,
        updateFields: { trigger_url: 'https://example.com/plans', enabled: false, description: '' },
      },
      responses: [
        { method: 'GET', url: '/campaigns/2', body: websiteCampaign() },
        {
          method: 'PATCH',
          url: '/campaigns/2',
          body: websiteCampaign({
            enabled: false,
            trigger_rules: { url: 'https://example.com/plans', time_on_page: 10 },
          }),
        },
      ],
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${APP}/campaigns/2`,
      `PATCH ${APP}/campaigns/2`,
    ]);
    expect(calls[1].body).toEqual({
      description: '',
      enabled: false,
      trigger_rules: { url: 'https://example.com/plans', time_on_page: 10 },
    });
    expect(output[0][0].json.enabled).toBe(false);
  });

  it('update: audience, template params, title and scheduled_at in one PATCH', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'update',
        campaignId: 5,
        updateFields: {
          title: 'November promo',
          audienceLabelIds: '4',
          template_params: { name: 'november_promo', language: 'es' },
          scheduled_at: '2026-11-01T09:30:00-06:00',
        },
      },
      responses: [
        {
          method: 'PATCH',
          url: '/campaigns/5',
          body: whatsappCampaign({ title: 'November promo' }),
        },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      title: 'November promo',
      scheduled_at: '2026-11-01T15:30:00.000Z',
      audience: [{ type: 'Label', id: 4 }],
      template_params: { name: 'november_promo', language: 'es' },
    });
  });

  it('create: an added-but-empty Trigger URL is not sent (Chatwoot answers "Url invalid")', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'create',
        title: 'Pricing help',
        message: 'Need help?',
        inboxId: 3,
        additionalFields: { trigger_url: '   ', time_on_page: 5 },
      },
      responses: [{ method: 'POST', url: '/campaigns', body: websiteCampaign() }],
    });
    expect(calls[0].body).toEqual({
      title: 'Pricing help',
      message: 'Need help?',
      inbox_id: 3,
      trigger_rules: { time_on_page: 5 },
    });
  });

  it('update: Time on Page with an empty Trigger URL reads the campaign and keeps its URL', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'update',
        campaignId: 2,
        updateFields: { trigger_url: '', time_on_page: 30 },
      },
      responses: [
        { method: 'GET', url: '/campaigns/2', body: websiteCampaign() },
        { method: 'PATCH', url: '/campaigns/2', body: websiteCampaign() },
      ],
    });
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH']);
    expect(calls[1].body).toEqual({
      trigger_rules: { url: 'https://example.com/pricing', time_on_page: 30 },
    });
  });

  it('update: a Trigger URL is trimmed; both trigger values -> no extra GET', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'update',
        campaignId: 2,
        updateFields: { trigger_url: ' https://example.com/plans ', time_on_page: 15 },
      },
      responses: [{ method: 'PATCH', url: '/campaigns/2', body: websiteCampaign() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      trigger_rules: { url: 'https://example.com/plans', time_on_page: 15 },
    });
  });

  it('description: Create Additional Fields are sorted and keep the legacy inbox_id option', () => {
    const properties = new Chatwoot().description.properties;
    const additional = properties.find(
      (p) =>
        p.name === 'additionalFields' &&
        p.displayOptions?.show?.resource?.includes('campaign') &&
        p.displayOptions?.show?.operation?.includes('create'),
    );
    const names = (additional?.options as Array<{ displayName: string; name: string }>).map(
      (o) => o.displayName,
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect((additional?.options as Array<{ name: string }>).map((o) => o.name)).toEqual(
      expect.arrayContaining(['inbox_id', 'audience', 'scheduled_at']),
    );
  });

  it('update: nothing to send -> error before the request', async () => {
    const { error, calls } = await runExpectingError({
      resource: 'campaign',
      operation: 'update',
      campaignId: 5,
    });
    expect(error.message).toBe('Add at least one field to update in "Update Fields"');
    expect(calls).toHaveLength(0);
  });

  it('getMetrics: GET /campaigns/:id/analytics/metrics (4.17+ Enterprise)', async () => {
    const metrics = {
      audience: 120,
      sent: 118,
      delivered: 110,
      read: 80,
      failed: 2,
      skipped: 2,
      status_counts: { queued: 0, skipped: 2, sent: 8, delivered: 30, read: 80, failed: 2 },
    };
    const { calls, output } = await runChatwootNode({
      params: { resource: 'campaign', operation: 'getMetrics', campaignId: 5 },
      responses: [{ method: 'GET', url: '/campaigns/5/analytics/metrics', body: metrics }],
    });
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`${APP}/campaigns/5/analytics/metrics`);
    expect(output[0][0].json).toEqual(metrics);
  });

  it('getMetrics: a non-WhatsApp campaign answers 401 (Pundit) and it is surfaced', async () => {
    const { error } = await runExpectingError(
      { resource: 'campaign', operation: 'getMetrics', campaignId: 2 },
      [
        {
          method: 'GET',
          url: '/campaigns/2/analytics/metrics',
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    );
    expect(error).toBeInstanceOf(NodeApiError);
    expect(error.message).toContain('401');
  });

  it('getRecipients: paginates payload with the status filter until total_pages', async () => {
    const recipient = (id: number): IDataObject => ({
      contact: {
        id,
        name: `Contact ${id}`,
        phone_number: `+52155500${String(id).padStart(4, '0')}`,
      },
      status: 'failed',
      message_content: 'Hi, our October promo is live',
      error_code: 131026,
      error_title: 'Message undeliverable',
      error_message: 'Receiver is incapable of receiving this message',
    });
    const reply = (call: RecordedCall) => {
      const current = Number(call.qs?.page);
      const ids = current === 1 ? Array.from({ length: 25 }, (_, k) => k + 1) : [26, 27];
      return {
        body: {
          payload: ids.map(recipient),
          meta: { current_page: current, total_pages: 2, total_count: 27 },
        },
      };
    };
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'campaign',
        operation: 'getRecipients',
        campaignId: 5,
        returnAll: true,
        options: { status: 'failed' },
      },
      responses: [{ method: 'GET', url: '/campaigns/5/analytics/contacts', times: 2, reply }],
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`${APP}/campaigns/5/analytics/contacts`);
    expect(calls.map((c) => c.qs)).toEqual([
      { status: 'failed', page: 1 },
      { status: 'failed', page: 2 },
    ]);
    expect(output[0]).toHaveLength(27);
    expect(output[0][26].json).toEqual(recipient(27));
  });

  it('getRecipients: Limit returns the first N from one page', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'campaign', operation: 'getRecipients', campaignId: 5, limit: 2 },
      responses: [
        {
          method: 'GET',
          url: '/campaigns/5/analytics/contacts',
          body: {
            payload: [1, 2, 3].map((id) => ({
              contact: { id, name: `C${id}`, phone_number: null },
              status: 'read',
              message_content: 'Hi',
              error_code: null,
              error_title: null,
              error_message: null,
            })),
            meta: { current_page: 1, total_pages: 1, total_count: 3 },
          },
        },
      ],
    });
    expect(calls[0].qs).toEqual({ page: 1 });
    expect(output[0].map((item) => (item.json.contact as IDataObject).id)).toEqual([1, 2]);
  });

  it('loadOptions getCampaignInboxes lists only Website, SMS, Twilio SMS and WhatsApp inboxes', async () => {
    const mock = createMockExecuteFunctions({
      responses: [
        {
          method: 'GET',
          url: '/inboxes',
          body: {
            payload: [
              inbox(3, 'Website', 'Channel::WebWidget'),
              inbox(4, 'SMS', 'Channel::Sms'),
              inbox(5, 'Twilio', 'Channel::TwilioSms'),
              inbox(9, 'WhatsApp Sales', 'Channel::Whatsapp'),
              inbox(20, 'Evolution', 'Channel::Api'),
              inbox(21, 'Support mail', 'Channel::Email'),
            ],
          },
        },
      ],
    });
    const options = await getCampaignInboxes.call(mock.ctx as unknown as ILoadOptionsFunctions);
    expect(options).toEqual([
      { name: 'Website (Channel::WebWidget)', value: 3 },
      { name: 'SMS (Channel::Sms)', value: 4 },
      { name: 'Twilio (Channel::TwilioSms)', value: 5 },
      { name: 'WhatsApp Sales (Channel::Whatsapp)', value: 9 },
    ]);

    const missing = createMockExecuteFunctions({ responses: [{ url: '/inboxes', status: 404 }] });
    await expect(
      getCampaignInboxes.call(missing.ctx as unknown as ILoadOptionsFunctions),
    ).resolves.toEqual([]);
    const denied = createMockExecuteFunctions({
      responses: [{ url: '/inboxes', status: 401, body: { error: 'Invalid Access Token' } }],
    });
    await expect(
      getCampaignInboxes.call(denied.ctx as unknown as ILoadOptionsFunctions),
    ).rejects.toThrow('401');
  });

  it('the node registers getCampaignInboxes', () => {
    expect(new Chatwoot().methods.loadOptions.getCampaignInboxes).toBe(getCampaignInboxes);
  });
});

// ============================================================================
// Canned Response
// ============================================================================

describe('cannedResponse', () => {
  it('getAll: GET /canned_responses with search, one item per response', async () => {
    const list = [
      cannedResponse(),
      cannedResponse({ id: 13, short_code: 'greet_es', content: 'Hola' }),
    ];
    const { calls, output } = await runChatwootNode({
      params: { resource: 'cannedResponse', operation: 'getAll', options: { search: 'greet' } },
      responses: [{ method: 'GET', url: '/canned_responses', body: list }],
    });
    expect(calls[0].url).toBe(`${APP}/canned_responses`);
    expect(calls[0].qs).toEqual({ search: 'greet' });
    expect(output[0].map((item) => item.json)).toEqual(list);
  });

  it('create: POST /canned_responses { short_code, content }', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'cannedResponse',
        operation: 'create',
        shortCode: 'greeting',
        content: 'Hello {{contact.name}}, how can we help?',
      },
      responses: [{ method: 'POST', url: '/canned_responses', body: cannedResponse() }],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({
      short_code: 'greeting',
      content: 'Hello {{contact.name}}, how can we help?',
    });
    expect(output[0][0].json).toEqual(cannedResponse());
  });

  it('update: PATCH only the non-empty fields; nothing to update -> error', async () => {
    const { calls, output } = await runChatwootNode({
      params: {
        resource: 'cannedResponse',
        operation: 'update',
        cannedResponseId: 12,
        updateFields: { content: 'Hi there!', short_code: '' },
      },
      responses: [
        {
          method: 'PATCH',
          url: '/canned_responses/12',
          body: cannedResponse({ content: 'Hi there!' }),
        },
      ],
    });
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe(`${APP}/canned_responses/12`);
    expect(calls[0].body).toEqual({ content: 'Hi there!' });
    expect(output[0][0].json.content).toBe('Hi there!');

    const { error, calls: none } = await runExpectingError({
      resource: 'cannedResponse',
      operation: 'update',
      cannedResponseId: 12,
    });
    expect(error.message).toBe('Add Short Code and/or Content to update');
    expect(none).toHaveLength(0);
  });

  it('delete: DELETE /canned_responses/:id', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'cannedResponse', operation: 'delete', cannedResponseId: 12 },
      responses: [{ method: 'DELETE', url: '/canned_responses/12' }],
    });
    expect(calls[0].url).toBe(`${APP}/canned_responses/12`);
    expect(output[0][0].json).toEqual({ success: true, id: 12 });
  });
});

// ============================================================================
// Pure helpers
// ============================================================================

describe('automation helpers', () => {
  it('renameLegacyConditionKeys only rewrites standard "company" conditions (upstream migration predicate)', () => {
    expect(renameLegacyConditionKeys('not-an-array')).toEqual({
      conditions: 'not-an-array',
      renamed: 0,
    });
    const result = renameLegacyConditionKeys([
      { attribute_key: 'company', values: ['a'] },
      { attribute_key: 'company', custom_attribute_type: 'conversation_attribute' },
      { attribute_key: 'company', custom_attribute_type: '', attribute_model: 'standard' },
      { attribute_key: 'company', attribute_model: 'customer_attributes' },
      { attribute_key: 'email' },
      null,
    ]);
    expect(result.renamed).toBe(2);
    expect(result.conditions).toEqual([
      { attribute_key: 'company_name', values: ['a'] },
      { attribute_key: 'company', custom_attribute_type: 'conversation_attribute' },
      { attribute_key: 'company_name', custom_attribute_type: '', attribute_model: 'standard' },
      { attribute_key: 'company', attribute_model: 'customer_attributes' },
      { attribute_key: 'email' },
      null,
    ]);
  });

  it('resolveExecutionDelay', () => {
    expect(resolveExecutionDelay(undefined, 'create')).toBeUndefined();
    expect(resolveExecutionDelay(0, 'create')).toBeUndefined();
    expect(resolveExecutionDelay(0, 'update')).toBeNull();
    expect(resolveExecutionDelay(10, 'create')).toBe(10);
    expect(resolveExecutionDelay('43200', 'update')).toBe(43200);
    expect(() => resolveExecutionDelay(43201, 'create')).toThrow('between 10 and 43200');
    expect(() => resolveExecutionDelay(12.5, 'create')).toThrow('whole number');
    expect(resolveExecutionDelay('  ', 'update')).toBeUndefined();
    expect(resolveExecutionDelay('', 'update')).toBeUndefined();
  });

  it('toUnixSeconds', () => {
    expect(toUnixSeconds('2026-10-01T15:00:00Z', 'x')).toBe(1790866800);
    expect(toUnixSeconds('2026-10-01T09:00:00-06:00', 'x')).toBe(1790866800);
    expect(toUnixSeconds(new Date('2026-10-01T15:00:00Z'), 'x')).toBe(1790866800);
    expect(toUnixSeconds(1790866800, 'x')).toBe(1790866800);
    expect(toUnixSeconds('1790866800123', 'x')).toBe(1790866800);
    expect(() => toUnixSeconds('', 'Snoozed Until')).toThrow('Snoozed Until is required');
  });

  it('campaign helpers', () => {
    expect(buildCampaignAudience('', '[]')).toBeUndefined();
    expect(buildCampaignAudience(undefined, [{ type: 'label', id: '2' }])).toEqual([
      { type: 'Label', id: 2 },
    ]);
    expect(() => buildCampaignAudience('', '{"type":"Label"}')).toThrow('must be an array');
    expect(() => buildCampaignAudience('', '[{"type":"Contact","id":1}]')).toThrow(
      'only target labels',
    );
    expect(parseTemplateParams('')).toBeUndefined();
    expect(() => parseTemplateParams('[]')).toThrow('must be an object');
    expect(toIsoTimestamp('1790866800', 'x')).toBe('2026-10-01T15:00:00.000Z');
    expect(toIsoTimestamp('1790866800000', 'x')).toBe('2026-10-01T15:00:00.000Z');
    expect(toIsoTimestamp(new Date('2026-10-01T15:00:00Z'), 'x')).toBe('2026-10-01T15:00:00.000Z');
    expect(toIsoTimestamp('2026-10-01T09:00:00-06:00', 'x')).toBe('2026-10-01T15:00:00.000Z');
    expect(() => toIsoTimestamp('soon', 'Scheduled At')).toThrow(
      'Scheduled At must be a date/time',
    );
    expect(buildTriggerRules({})).toBeUndefined();
    expect(buildTriggerRules({ trigger_url: '' })).toBeUndefined();
    expect(needsCurrentTriggerRules({ trigger_url: '', time_on_page: 5 })).toBe(true);
    expect(needsCurrentTriggerRules({ trigger_url: 'https://a.io', time_on_page: 5 })).toBe(false);
    expect(needsCurrentTriggerRules({})).toBe(false);
    expect(
      buildTriggerRules({ time_on_page: 5 }, { url: 'https://a.io', time_on_page: 10 }),
    ).toEqual({
      url: 'https://a.io',
      time_on_page: 5,
    });
  });
});
