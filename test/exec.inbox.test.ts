/**
 * Execute-level tests for the admin resources: inbox, webhook, agentBot, integration, account,
 * profile, agent and team. Response fixtures mirror the Chatwoot 4.18.0 jbuilder views
 * (app/views/api/v1/models/_inbox, _agent, _agent_bot, _user, _hook, _team, webhooks/_webhook,
 * accounts/show, branded_email_layouts/show).
 */
import type { IDataObject, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import { accountOperations, accountFields } from '../nodes/Chatwoot/resources/account';
import { agentOperations, agentFields } from '../nodes/Chatwoot/resources/agent';
import { agentBotOperations, agentBotFields } from '../nodes/Chatwoot/resources/agentBot';
import { inboxOperations, inboxFields } from '../nodes/Chatwoot/resources/inbox';
import { integrationOperations, integrationFields } from '../nodes/Chatwoot/resources/integration';
import { profileOperations, profileFields } from '../nodes/Chatwoot/resources/profile';
import { teamOperations, teamFields } from '../nodes/Chatwoot/resources/team';
import { webhookOperations, webhookFields } from '../nodes/Chatwoot/resources/webhook';
import { parseUserIds } from '../nodes/Chatwoot/resources/inbox/helpers';
import { runChatwootNode } from './helpers/mockExecuteFunctions';

const BASE = 'https://chatwoot.test';
const APP = `${BASE}/api/v1/accounts/1`;

const json = (output: Awaited<ReturnType<typeof runChatwootNode>>['output']) =>
  output[0].map((item) => item.json);

// ---------------------------------------------------------------------------------------------
// Fixtures (Chatwoot 4.18.0 response shapes)
// ---------------------------------------------------------------------------------------------

const WEEKLY_SCHEDULE = [
  {
    day_of_week: 0,
    closed_all_day: true,
    open_hour: null,
    open_minutes: null,
    close_hour: null,
    close_minutes: null,
    open_all_day: false,
  },
  {
    day_of_week: 1,
    closed_all_day: false,
    open_hour: 9,
    open_minutes: 0,
    close_hour: 17,
    close_minutes: 0,
    open_all_day: false,
  },
];

/** _inbox.json.jbuilder for an API channel inbox, rendered for an administrator. */
function apiInbox(overrides: IDataObject = {}): IDataObject {
  return {
    id: 3,
    avatar_url: '',
    channel_id: 2,
    name: 'Evolution',
    channel_type: 'Channel::Api',
    greeting_enabled: false,
    greeting_message: null,
    working_hours_enabled: false,
    enable_email_collect: true,
    csat_survey_enabled: false,
    csat_config: {},
    enable_auto_assignment: true,
    auto_assignment_config: {},
    out_of_office_message: null,
    working_hours: WEEKLY_SCHEDULE,
    timezone: 'UTC',
    callback_webhook_url: null,
    allow_messages_after_resolved: true,
    lock_to_single_conversation: false,
    sender_name_type: 'friendly',
    business_name: null,
    allowed_domains: null,
    widget_color: null,
    website_url: null,
    hmac_mandatory: false,
    welcome_title: null,
    welcome_tagline: null,
    web_widget_script: null,
    website_token: null,
    selected_feature_flags: null,
    reply_time: null,
    messaging_service_sid: null,
    phone_number: null,
    hmac_token: 'hmacToken111',
    secret: 'webhookSecret111',
    webhook_url: 'https://evolution.example.com/chatwoot/webhook/main',
    inbox_identifier: 'kd8Qz1B2',
    additional_attributes: {},
    provider: null,
    ...overrides,
  };
}

/** _agent.json.jbuilder */
function agent(id: number, overrides: IDataObject = {}): IDataObject {
  return {
    id,
    account_id: 1,
    availability_status: 'online',
    auto_offline: true,
    confirmed: true,
    email: `agent${id}@example.com`,
    provider: 'email',
    available_name: `Agent ${id}`,
    name: `Agent ${id}`,
    role: 'agent',
    thumbnail: '',
    ...overrides,
  };
}

/** webhooks/_webhook.json.jbuilder */
function webhook(overrides: IDataObject = {}): IDataObject {
  return {
    id: 9,
    name: 'n8n',
    url: 'https://n8n.example.com/webhook/abc',
    account_id: 1,
    subscriptions: ['message_created'],
    secret: 'whSecret123',
    ...overrides,
  };
}

/** _agent_bot.json.jbuilder rendered for an administrator */
function agentBot(overrides: IDataObject = {}): IDataObject {
  return {
    id: 4,
    name: 'Bot',
    description: 'Support bot',
    thumbnail: '',
    outgoing_url: 'https://bot.example.com/hook',
    bot_type: 'webhook',
    bot_config: {},
    account_id: 1,
    access_token: 'botAccessToken',
    secret: 'botSecret',
    system_bot: false,
    ...overrides,
  };
}

/** _user.json.jbuilder (profile endpoints) */
function userProfile(overrides: IDataObject = {}): IDataObject {
  return {
    access_token: 'test-token',
    account_id: 1,
    available_name: 'Renato',
    avatar_url: '',
    confirmed: true,
    display_name: null,
    message_signature: null,
    email: 'renato@example.com',
    id: 1,
    inviter_id: null,
    name: 'Renato',
    provider: 'email',
    pubsub_token: 'pubsub',
    role: 'administrator',
    ui_settings: {},
    uid: 'renato@example.com',
    type: 'User',
    accounts: [
      {
        id: 1,
        name: 'Acme',
        status: 'active',
        active_at: '2026-09-25T10:00:00.000Z',
        role: 'administrator',
        permissions: ['administrator'],
        availability: 'online',
        availability_status: 'online',
        auto_offline: true,
        api_and_webhooks: true,
      },
    ],
    ...overrides,
  };
}

/** _hook.json.jbuilder rendered for an administrator (settings filtered to visible_properties) */
function hook(overrides: IDataObject = {}): IDataObject {
  return {
    id: 12,
    app_id: 'dyte',
    status: true,
    inbox: null,
    account_id: 1,
    hook_type: 'account',
    settings: { account_id: 'cf-account', app_id: 'rtk-app' },
    reference_id: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------------------------

const RESOURCES: Array<{ name: string; operations: INodeProperties; fields: INodeProperties[] }> = [
  { name: 'account', operations: accountOperations, fields: accountFields },
  { name: 'agent', operations: agentOperations, fields: agentFields },
  { name: 'agentBot', operations: agentBotOperations, fields: agentBotFields },
  { name: 'inbox', operations: inboxOperations, fields: inboxFields },
  { name: 'integration', operations: integrationOperations, fields: integrationFields },
  { name: 'profile', operations: profileOperations, fields: profileFields },
  { name: 'team', operations: teamOperations, fields: teamFields },
  { name: 'webhook', operations: webhookOperations, fields: webhookFields },
];

describe('admin resource definitions', () => {
  describe.each(RESOURCES)('$name', ({ name, operations, fields }) => {
    const options = operations.options as INodePropertyOptions[];

    it('has complete, unique and alphabetically sorted operations', () => {
      for (const option of options) {
        expect(option).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            value: expect.any(String),
            description: expect.any(String),
            action: expect.any(String),
          }),
        );
      }
      const values = options.map((o) => o.value);
      expect(new Set(values).size).toBe(values.length);
      const names = options.map((o) => o.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('only defines fields for its own resource and existing operations', () => {
      const values = options.map((o) => o.value);
      for (const field of fields) {
        expect(field.displayOptions?.show?.resource).toEqual([name]);
        for (const op of (field.displayOptions?.show?.operation ?? []) as string[]) {
          expect(values).toContain(op);
        }
      }
    });
  });

  it('inbox exposes the 4.18 operations', () => {
    expect((inboxOperations.options as INodePropertyOptions[]).map((o) => o.value)).toEqual([
      'addAgent',
      'create',
      'delete',
      'deleteAgent',
      'get',
      'getAgentBot',
      'getAll',
      'getMembers',
      'getMessageTemplates',
      'resetSecret',
      'rotateHmacToken',
      'setAgentBot',
      'syncTemplates',
      'update',
      'updateAgents',
    ]);
  });

  it('webhook subscriptions list every Webhook::ALLOWED_WEBHOOK_EVENTS value', () => {
    const allowed = [
      'conversation_status_changed',
      'conversation_updated',
      'conversation_created',
      'contact_created',
      'contact_updated',
      'message_created',
      'message_updated',
      'webwidget_triggered',
      'inbox_created',
      'inbox_updated',
      'conversation_typing_on',
      'conversation_typing_off',
    ].sort();
    const create = webhookFields.find((f) => f.name === 'subscriptions') as INodeProperties;
    const update = webhookFields.find((f) => f.name === 'updateFields') as INodeProperties;
    const updateSubs = (update.options as INodeProperties[]).find(
      (o) => o.name === 'subscriptions',
    ) as INodeProperties;
    for (const property of [create, updateSubs]) {
      expect((property.options as INodePropertyOptions[]).map((o) => o.value).sort()).toEqual(
        allowed,
      );
    }
  });

  it('url fields warn about SafeFetch private-network blocking', () => {
    const descriptions = [
      (webhookFields.find((f) => f.name === 'url') as INodeProperties).description,
      (
        (agentBotFields.find((f) => f.name === 'additionalFields') as INodeProperties)
          .options as INodeProperties[]
      ).find((o) => o.name === 'outgoing_url')?.description,
      (
        (inboxFields.find((f) => f.name === 'channelSettings') as INodeProperties)
          .options as INodeProperties[]
      ).find((o) => o.name === 'webhook_url')?.description,
    ];
    for (const description of descriptions) {
      expect(description).toContain('SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true');
    }
  });

  it('node description still loads', () => {
    expect(new Chatwoot().description.properties.length).toBeGreaterThan(0);
  });
});

describe('parseUserIds', () => {
  it('accepts comma lists, numbers and arrays', () => {
    expect(parseUserIds('1, 2,,3 ')).toEqual([1, 2, 3]);
    expect(parseUserIds(7)).toEqual([7]);
    expect(parseUserIds(['4', 5])).toEqual([4, 5]);
  });

  it('rejects invalid or empty lists', () => {
    expect(() => parseUserIds('1, abc')).toThrow('"abc"');
    expect(() => parseUserIds('0')).toThrow('positive integers');
    expect(() => parseUserIds(' , ')).toThrow('at least one');
  });
});

// ---------------------------------------------------------------------------------------------
// Profile (ADMIN-1): /api/v1/profile is not account-scoped
// ---------------------------------------------------------------------------------------------

describe('profile', () => {
  it('fetch calls GET /api/v1/profile (user API root) with the token', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'profile', operation: 'fetch' },
      responses: [{ method: 'GET', url: `${BASE}/api/v1/profile`, body: userProfile() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/api/v1/profile`);
    expect(calls[0].headers).toEqual({ api_access_token: 'test-token' });
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([userProfile()]);
  });

  it('update wraps the profile fields under { profile } and uses PUT /api/v1/profile', async () => {
    const updated = userProfile({ display_name: 'Rena', message_signature: '-- R' });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'profile',
        operation: 'update',
        updateFields: {
          name: 'Renato A',
          display_name: 'Rena',
          message_signature: '-- R',
          phone_number: '+5215512345678',
        },
      },
      responses: [{ method: 'PUT', url: `${BASE}/api/v1/profile`, body: updated }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].body).toEqual({
      profile: {
        name: 'Renato A',
        display_name: 'Rena',
        message_signature: '-- R',
        phone_number: '+5215512345678',
      },
    });
    expect(json(output)).toEqual([updated]);
  });

  it('update applies availability and auto_offline through their endpoints with the account_id', async () => {
    const finalProfile = userProfile({ name: 'final' });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'profile',
        operation: 'update',
        updateFields: { availability: 'busy', auto_offline: false },
      },
      credentials: { chatwootApi: { baseUrl: BASE, accountId: 7, apiAccessToken: 'test-token' } },
      responses: [
        { method: 'POST', url: `${BASE}/api/v1/profile/availability`, body: userProfile() },
        { method: 'POST', url: `${BASE}/api/v1/profile/auto_offline`, body: finalProfile },
      ],
    });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${BASE}/api/v1/profile/availability`,
      `POST ${BASE}/api/v1/profile/auto_offline`,
    ]);
    expect(calls[0].body).toEqual({ profile: { account_id: 7, availability: 'busy' } });
    expect(calls[1].body).toEqual({ profile: { account_id: 7, auto_offline: false } });
    expect(json(output)).toEqual([finalProfile]);
  });

  it('update with no fields fails clearly without calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'profile', operation: 'update', updateFields: {} },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toBe('Add at least one field to update');
  });

  it('set availability sends { profile: { account_id, availability } }', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'profile', operation: 'availability', availability: 'offline' },
      responses: [
        { method: 'POST', url: `${BASE}/api/v1/profile/availability`, body: userProfile() },
      ],
    });
    expect(calls[0].url).toBe(`${BASE}/api/v1/profile/availability`);
    expect(calls[0].body).toEqual({ profile: { account_id: 1, availability: 'offline' } });
    expect(json(output)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------------------------

describe('inbox members (ADMIN-2)', () => {
  it('add agent POSTs the collection route with { inbox_id, user_ids } and emits one item per member', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'addAgent', inboxId: 3, userIds: '1, 2' },
      responses: [
        { method: 'POST', url: '/inbox_members', body: { payload: [agent(1), agent(2)] } },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/inbox_members`);
    expect(calls[0].body).toEqual({ inbox_id: 3, user_ids: [1, 2] });
    expect(json(output)).toEqual([agent(1), agent(2)]);
  });

  it('update agents PATCHes /inbox_members (replaces the members)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'updateAgents', inboxId: 3, userIds: '2' },
      responses: [{ method: 'PATCH', url: '/inbox_members', body: { payload: [agent(2)] } }],
    });
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe(`${APP}/inbox_members`);
    expect(calls[0].body).toEqual({ inbox_id: 3, user_ids: [2] });
    expect(json(output)).toEqual([agent(2)]);
  });

  it('delete agent sends DELETE /inbox_members with a body and reports what was removed', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'deleteAgent', inboxId: 3, userIds: '1,2' },
      responses: [{ method: 'DELETE', url: '/inbox_members' }], // head :ok
    });
    expect(calls[0].url).toBe(`${APP}/inbox_members`);
    expect(calls[0].body).toEqual({ inbox_id: 3, user_ids: [1, 2] });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(json(output)).toEqual([{ success: true, inboxId: 3, userIds: [1, 2] }]);
  });

  it('get members keeps GET /inbox_members/:inbox_id and unwraps payload', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'getMembers', inboxId: 3, simplifyOutput: true },
      responses: [{ method: 'GET', url: '/inbox_members/3', body: { payload: [agent(1)] } }],
    });
    expect(calls[0].url).toBe(`${APP}/inbox_members/3`);
    expect(json(output)).toEqual([agent(1)]);
  });

  it('rejects invalid user IDs before calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'inbox', operation: 'deleteAgent', inboxId: 3, userIds: '1, two' },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toContain('"two"');
  });
});

describe('inbox create (ADMIN-4, ADMIN-11, EVOCW-12)', () => {
  const created = apiInbox();

  it('API channel: webhook_url/hmac_mandatory/additional_attributes nested in channel, inbox fields at root', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'Evolution',
        channelType: 'api',
        channelSettings: {
          webhook_url: 'https://evolution.example.com/chatwoot/webhook/main',
          hmac_mandatory: true,
          additional_attributes: '{"agent_reply_time_window": 24}',
        },
        additionalFields: {
          greeting_enabled: true,
          greeting_message: 'Hola',
          lock_to_single_conversation: true,
          timezone: 'America/Mexico_City',
          enable_auto_assignment: false,
          portal_id: 0,
        },
      },
      responses: [{ method: 'POST', url: '/inboxes', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes`);
    expect(calls[0].body).toEqual({
      name: 'Evolution',
      greeting_enabled: true,
      greeting_message: 'Hola',
      lock_to_single_conversation: true,
      timezone: 'America/Mexico_City',
      enable_auto_assignment: false,
      channel: {
        type: 'api',
        webhook_url: 'https://evolution.example.com/chatwoot/webhook/main',
        hmac_mandatory: true,
        additional_attributes: { agent_reply_time_window: 24 },
      },
    });
    expect(json(output)).toEqual([created]);
  });

  it('drops channel settings of other channel types and the obsolete avatar_url (as n8n does)', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'Evolution',
        channelType: 'api',
        channelSettings: {
          webhook_url: 'https://evo.test/hook',
          welcome_title: 'widget only',
          imap_port: 993,
        },
        additionalFields: { avatar_url: 'https://ignored.test/a.png' },
      },
      responses: [{ method: 'POST', url: '/inboxes', body: apiInbox() }],
    });
    expect(calls[0].body).toEqual({
      name: 'Evolution',
      channel: { type: 'api', webhook_url: 'https://evo.test/hook' },
    });
  });

  it('web widget: website_url is required and widget settings go inside channel', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'Site',
        channelType: 'web_widget',
        websiteUrl: 'https://acme.test',
        channelSettings: {
          welcome_title: 'Hi',
          welcome_tagline: 'We reply fast',
          widget_color: '#ff0000',
          reply_time: 'in_a_few_hours',
          selected_feature_flags: ['attachments', 'emoji_picker'],
        },
        additionalFields: { avatar_url: 'https://ignored.test/a.png', csat_survey_enabled: true },
      },
      responses: [
        { method: 'POST', url: '/inboxes', body: apiInbox({ channel_type: 'Channel::WebWidget' }) },
      ],
    });
    expect(calls[0].body).toEqual({
      name: 'Site',
      csat_survey_enabled: true,
      channel: {
        type: 'web_widget',
        website_url: 'https://acme.test',
        welcome_title: 'Hi',
        welcome_tagline: 'We reply fast',
        widget_color: '#ff0000',
        reply_time: 'in_a_few_hours',
        selected_feature_flags: ['attachments', 'emoji_picker'],
      },
    });
  });

  it('email: email is required, IMAP/SMTP settings go inside channel', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'Support',
        channelType: 'email',
        email: 'support@acme.test',
        channelSettings: {
          imap_enabled: true,
          imap_address: 'imap.acme.test',
          imap_port: 993,
          smtp_enabled: false,
        },
      },
      responses: [
        { method: 'POST', url: '/inboxes', body: apiInbox({ channel_type: 'Channel::Email' }) },
      ],
    });
    expect(calls[0].body).toEqual({
      name: 'Support',
      channel: {
        type: 'email',
        email: 'support@acme.test',
        imap_enabled: true,
        imap_address: 'imap.acme.test',
        imap_port: 993,
        smtp_enabled: false,
      },
    });
  });

  it('whatsapp cloud: phone_number, provider and provider_config', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'WA',
        channelType: 'whatsapp',
        phoneNumber: '+15551234567',
        apiKey: 'EAAG',
        phoneNumberId: '1001',
        businessAccountId: '2002',
      },
      responses: [
        { method: 'POST', url: '/inboxes', body: apiInbox({ channel_type: 'Channel::Whatsapp' }) },
      ],
    });
    expect(calls[0].body).toEqual({
      name: 'WA',
      channel: {
        type: 'whatsapp',
        phone_number: '+15551234567',
        provider: 'whatsapp_cloud',
        provider_config: { api_key: 'EAAG', phone_number_id: '1001', business_account_id: '2002' },
      },
    });
  });

  it('whatsapp 360dialog (legacy provider "default") only sends the api_key', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'WA',
        channelType: 'whatsapp',
        whatsappProvider: 'default',
        phoneNumber: '+15551234567',
        apiKey: 'd360',
      },
      responses: [{ method: 'POST', url: '/inboxes', body: apiInbox() }],
    });
    expect(calls[0].body).toEqual({
      name: 'WA',
      channel: {
        type: 'whatsapp',
        phone_number: '+15551234567',
        provider: 'default',
        provider_config: { api_key: 'd360' },
      },
    });
  });

  it('sms (Bandwidth), telegram and line build their channel payloads', async () => {
    const sms = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'SMS',
        channelType: 'sms',
        phoneNumber: '+15550000000',
        bandwidthAccountId: 'acc',
        bandwidthApplicationId: 'app',
        bandwidthApiKey: 'key',
        bandwidthApiSecret: 'secret',
      },
      responses: [{ method: 'POST', url: '/inboxes', body: apiInbox() }],
    });
    expect(sms.calls[0].body).toEqual({
      name: 'SMS',
      channel: {
        type: 'sms',
        phone_number: '+15550000000',
        provider_config: {
          account_id: 'acc',
          application_id: 'app',
          api_key: 'key',
          api_secret: 'secret',
        },
      },
    });

    const telegram = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'ignored',
        channelType: 'telegram',
        botToken: '123:abc',
      },
      responses: [{ method: 'POST', url: '/inboxes', body: apiInbox() }],
    });
    expect(telegram.calls[0].body).toEqual({
      name: 'ignored',
      channel: { type: 'telegram', bot_token: '123:abc' },
    });

    const line = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'create',
        name: 'LINE',
        channelType: 'line',
        lineChannelId: '165',
        lineChannelSecret: 's',
        lineChannelToken: 't',
      },
      responses: [{ method: 'POST', url: '/inboxes', body: apiInbox() }],
    });
    expect(line.calls[0].body).toEqual({
      name: 'LINE',
      channel: {
        type: 'line',
        line_channel_id: '165',
        line_channel_secret: 's',
        line_channel_token: 't',
      },
    });
  });
});

describe('inbox create: blank required channel fields fail before any request', () => {
  it.each([
    ['web_widget', { websiteUrl: '  ' }, 'Website URL is required to create a web_widget inbox'],
    ['email', { email: '' }, 'Email is required to create a email inbox'],
    [
      'sms',
      {
        phoneNumber: '+15550000000',
        bandwidthAccountId: 'acc',
        bandwidthApplicationId: 'app',
        bandwidthApiKey: 'key',
        bandwidthApiSecret: '',
      },
      'Bandwidth API Secret is required to create a sms inbox',
    ],
    [
      'whatsapp',
      { phoneNumber: '+15551234567', apiKey: 'EAAG', phoneNumberId: '1001', businessAccountId: '' },
      'Business Account ID is required to create a whatsapp inbox',
    ],
    ['telegram', { botToken: '' }, 'Bot Token is required to create a telegram inbox'],
  ])('%s', async (channelType, fields, message) => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'inbox', operation: 'create', name: 'X', channelType, ...fields },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)).toEqual([{ error: message }]);
  });
});

describe('inbox update (ADMIN-5, EVOCW-12)', () => {
  it('nests channel attributes (incl. legacy root website/welcome fields) under channel without type', async () => {
    const updated = apiInbox({ webhook_url: 'https://new.example.com/hook' });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'update',
        inboxId: 3,
        updateFields: {
          name: 'Evolution 2',
          welcome_title: 'Hello',
          website_url: 'https://acme.test',
          lock_to_single_conversation: true,
          sender_name_type: 'professional',
        },
        channelSettings: { webhook_url: 'https://new.example.com/hook', hmac_mandatory: false },
      },
      responses: [{ method: 'PATCH', url: '/inboxes/3', body: updated }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3`);
    expect(calls[0].body).toEqual({
      name: 'Evolution 2',
      lock_to_single_conversation: true,
      sender_name_type: 'professional',
      channel: {
        webhook_url: 'https://new.example.com/hook',
        hmac_mandatory: false,
        welcome_title: 'Hello',
        website_url: 'https://acme.test',
      },
    });
    expect(json(output)).toEqual([updated]);
  });

  it('an empty legacy Website URL keeps the current URL; an empty welcome title clears it', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'update',
        inboxId: 3,
        updateFields: { website_url: '', welcome_title: '' },
      },
      responses: [
        {
          method: 'PATCH',
          url: '/inboxes/3',
          body: apiInbox({ channel_type: 'Channel::WebWidget', welcome_title: '' }),
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3`);
    expect(calls[0].body).toEqual({ channel: { welcome_title: '' } });
  });

  it('parses working_hours and csat_config JSON, maps an empty layout to null and portal 0 to null', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'update',
        inboxId: 3,
        updateFields: {
          working_hours_enabled: true,
          working_hours:
            '[{"day_of_week": 1, "open_hour": 8, "open_minutes": 0, "close_hour": 18, "close_minutes": 0}]',
          csat_config: '{"display_type": "star", "message": "Rate us"}',
          branded_email_layout: '',
          portal_id: 0,
        },
      },
      responses: [{ method: 'PATCH', url: '/inboxes/3', body: apiInbox() }],
    });
    expect(calls[0].body).toEqual({
      working_hours_enabled: true,
      working_hours: [
        { day_of_week: 1, open_hour: 8, open_minutes: 0, close_hour: 18, close_minutes: 0 },
      ],
      csat_config: { display_type: 'star', message: 'Rate us' },
      branded_email_layout: null,
      portal_id: null,
    });
  });

  it('rejects working_hours that is not a JSON array', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'inbox',
        operation: 'update',
        inboxId: 3,
        updateFields: { working_hours: '{"day_of_week": 1}' },
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toContain('working_hours must be a JSON array');
  });

  it('CSAT config replacement keeps an explicitly supplied WhatsApp template and survey rules', async () => {
    const config = { message: 'Rate us', survey_rules: { operator: 'contains', values: ['billing'] }, template: { name: 'csat', language: 'es', status: 'approved' } };
    const { calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'update', inboxId: 3, updateFields: { csat_config: JSON.stringify(config) } },
      responses: [{ method: 'PATCH', url: '/inboxes/3', body: apiInbox({ csat_config: config }) }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ csat_config: config });
  });
});

describe('inbox management endpoints (ADMIN-10, RELEASE-17)', () => {
  it('delete returns the queued-deletion message as a success item', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'delete', inboxId: 3 },
      responses: [
        {
          method: 'DELETE',
          url: '/inboxes/3',
          body: { message: 'Your inbox deletion request will be processed in some time.' },
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3`);
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([
      {
        success: true,
        id: 3,
        message: 'Your inbox deletion request will be processed in some time.',
      },
    ]);
  });

  it('reset secret POSTs /inboxes/:id/reset_secret and returns the inbox with the new secret', async () => {
    const reset = apiInbox({ secret: 'newSecret' });
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'resetSecret', inboxId: 3 },
      responses: [{ method: 'POST', url: '/inboxes/3/reset_secret', body: reset }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3/reset_secret`);
    expect(calls[0].body).toBeUndefined();
    expect(json(output)[0].secret).toBe('newSecret');
  });

  it('rotate HMAC token POSTs /inboxes/:id/rotate_hmac_token', async () => {
    const rotated = apiInbox({ hmac_token: 'newHmac' });
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'rotateHmacToken', inboxId: 3 },
      responses: [{ method: 'POST', url: '/inboxes/3/rotate_hmac_token', body: rotated }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3/rotate_hmac_token`);
    expect(json(output)[0].hmac_token).toBe('newHmac');
  });

  it('rotate HMAC token on Chatwoot 4.17 (route missing) surfaces a 404 with a version hint', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'inbox', operation: 'rotateHmacToken', inboxId: 3 },
      responses: [
        {
          method: 'POST',
          url: '/inboxes/3/rotate_hmac_token',
          status: 404,
          body: '<html>Not Found</html>',
        },
      ],
    });
    expect(json(output)[0]).toMatchObject({ httpCode: '404' });
    expect(json(output)[0].description).toContain('newer than your instance');
  });

  it('message templates: GET with the name filter, one item per template', async () => {
    const template = {
      name: 'order_update',
      status: 'approved',
      category: 'UTILITY',
      language: 'es_MX',
      namespace: 'ns',
      components: [{ text: 'Tu pedido {{1}} va en camino', type: 'BODY' }],
      rejected_reason: 'NONE',
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'inbox',
        operation: 'getMessageTemplates',
        inboxId: 3,
        templateName: 'order_update',
      },
      responses: [
        {
          method: 'GET',
          url: '/inboxes/3/message_templates',
          body: { payload: [template], meta: { last_sync_attempt_at: '2026-09-25T10:00:00.000Z' } },
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3/message_templates`);
    expect(calls[0].qs).toEqual({ name: 'order_update' });
    expect(json(output)).toEqual([template]);
  });

  it('message templates without a name sends no query', async () => {
    const { calls, output } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'getMessageTemplates', inboxId: 3 },
      responses: [
        {
          method: 'GET',
          url: '/inboxes/3/message_templates',
          body: { payload: [], meta: { last_sync_attempt_at: null } },
        },
      ],
    });
    expect(calls[0].qs).toBeUndefined();
    expect(output[0]).toEqual([]);
  });

  it('sync templates POSTs /inboxes/:id/sync_templates', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'syncTemplates', inboxId: 3 },
      responses: [
        {
          method: 'POST',
          url: '/inboxes/3/sync_templates',
          body: { message: 'Template sync initiated successfully' },
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3/sync_templates`);
    expect(json(output)).toEqual([
      { success: true, inboxId: 3, message: 'Template sync initiated successfully' },
    ]);
  });

  it('set agent bot reports the assignment (Chatwoot answers head :ok)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'setAgentBot', inboxId: 3, agentBotId: 4 },
      responses: [{ method: 'POST', url: '/inboxes/3/set_agent_bot' }],
    });
    expect(calls[0].body).toEqual({ agent_bot: 4 });
    expect(json(output)).toEqual([{ success: true, inboxId: 3, agentBotId: 4 }]);
  });

  it('set agent bot with no bot selected removes the assignment (agent_bot null)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'setAgentBot', inboxId: 3, agentBotId: '' },
      responses: [{ method: 'POST', url: '/inboxes/3/set_agent_bot' }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes/3/set_agent_bot`);
    expect(calls[0].body).toEqual({ agent_bot: null });
    expect(json(output)).toEqual([{ success: true, inboxId: 3, agentBotId: null }]);
  });

  it('get many unwraps payload', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'inbox', operation: 'getAll' },
      responses: [{ method: 'GET', url: '/inboxes', body: { payload: [apiInbox()] } }],
    });
    expect(calls[0].url).toBe(`${APP}/inboxes`);
    expect(json(output)).toEqual([apiInbox()]);
  });
});

// ---------------------------------------------------------------------------------------------
// Webhook (ADMIN-9, RELEASE-18, TRIGGER-4 resource part)
// ---------------------------------------------------------------------------------------------

describe('webhook', () => {
  it('get many unwraps payload.webhooks (one item per webhook, with secret)', async () => {
    const hooks = [webhook(), webhook({ id: 10, inbox: { id: 3, name: 'Evolution' } })];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'webhook', operation: 'getAll', simplifyOutput: true },
      responses: [{ method: 'GET', url: '/webhooks', body: { payload: { webhooks: hooks } } }],
    });
    expect(calls[0].url).toBe(`${APP}/webhooks`);
    expect(json(output)).toEqual(hooks);
  });

  it('create sends name, inbox_id and the new events, and returns the unwrapped webhook with its secret', async () => {
    const created = webhook({
      name: 'n8n inbox events',
      subscriptions: ['inbox_created', 'conversation_typing_on'],
      inbox: { id: 3, name: 'Evolution' },
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'webhook',
        operation: 'create',
        simplifyOutput: true,
        url: 'https://n8n.example.com/webhook/abc',
        subscriptions: ['inbox_created', 'conversation_typing_on'],
        additionalFields: { name: 'n8n inbox events', inbox_id: 3 },
      },
      responses: [{ method: 'POST', url: '/webhooks', body: { payload: { webhook: created } } }],
    });
    expect(calls[0].body).toEqual({
      url: 'https://n8n.example.com/webhook/abc',
      subscriptions: ['inbox_created', 'conversation_typing_on'],
      name: 'n8n inbox events',
      inbox_id: 3,
    });
    expect(json(output)).toEqual([created]);
    expect(json(output)[0].secret).toBe('whSecret123');
  });

  it('update sends only the given fields and unwraps payload.webhook', async () => {
    const updated = webhook({ subscriptions: ['inbox_updated'] });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'webhook',
        operation: 'update',
        simplifyOutput: true,
        webhookId: 9,
        updateFields: { subscriptions: ['inbox_updated'], name: 'renamed' },
      },
      responses: [{ method: 'PATCH', url: '/webhooks/9', body: { payload: { webhook: updated } } }],
    });
    expect(calls[0].url).toBe(`${APP}/webhooks/9`);
    expect(calls[0].body).toEqual({ subscriptions: ['inbox_updated'], name: 'renamed' });
    expect(json(output)).toEqual([updated]);
  });

  it('update with an empty inbox selection removes the inbox association (inbox_id null)', async () => {
    const updated = webhook();
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'webhook',
        operation: 'update',
        simplifyOutput: true,
        webhookId: 9,
        updateFields: { inbox_id: '', url: 'https://n8n.example.com/webhook/new' },
      },
      responses: [{ method: 'PATCH', url: '/webhooks/9', body: { payload: { webhook: updated } } }],
    });
    expect(calls[0].body).toEqual({ url: 'https://n8n.example.com/webhook/new', inbox_id: null });
    expect(json(output)).toEqual([updated]);
  });

  it('delete emits a success item', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'webhook', operation: 'delete', webhookId: 9 },
      responses: [{ method: 'DELETE', url: '/webhooks/9' }],
    });
    expect(calls[0].url).toBe(`${APP}/webhooks/9`);
    expect(json(output)).toEqual([{ success: true, id: 9 }]);
  });
});

// ---------------------------------------------------------------------------------------------
// Agent bot (ADMIN-16)
// ---------------------------------------------------------------------------------------------

describe('agent bot', () => {
  it('create sends avatar_url and parsed bot_config', async () => {
    const created = agentBot({ bot_config: { lang: 'es' } });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'agentBot',
        operation: 'create',
        name: 'Bot',
        additionalFields: {
          outgoing_url: 'https://bot.example.com/hook',
          avatar_url: 'https://cdn.example.com/bot.png',
          bot_config: '{"lang": "es"}',
        },
      },
      responses: [{ method: 'POST', url: '/agent_bots', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/agent_bots`);
    expect(calls[0].body).toEqual({
      name: 'Bot',
      outgoing_url: 'https://bot.example.com/hook',
      avatar_url: 'https://cdn.example.com/bot.png',
      bot_config: { lang: 'es' },
    });
    expect(json(output)).toEqual([created]);
  });

  it('update sends only the changed fields', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'agentBot',
        operation: 'update',
        agentBotId: 4,
        updateFields: { name: 'Bot 2', bot_config: '{}' },
      },
      responses: [{ method: 'PATCH', url: '/agent_bots/4', body: agentBot({ name: 'Bot 2' }) }],
    });
    expect(calls[0].body).toEqual({ name: 'Bot 2', bot_config: {} });
  });

  it('update clears description and outgoing_url with an empty value, never sends an empty name', async () => {
    const cleared = agentBot({ description: null, outgoing_url: null });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'agentBot',
        operation: 'update',
        agentBotId: 4,
        updateFields: { name: '', description: '', outgoing_url: '', avatar_url: '' },
      },
      responses: [{ method: 'PATCH', url: '/agent_bots/4', body: cleared }],
    });
    expect(calls[0].url).toBe(`${APP}/agent_bots/4`);
    expect(calls[0].body).toEqual({ description: '', outgoing_url: '' });
    expect(json(output)).toEqual([cleared]);
  });

  it('create never sends empty optional fields', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'agentBot',
        operation: 'create',
        name: 'Bot',
        additionalFields: { description: '', outgoing_url: '' },
      },
      responses: [{ method: 'POST', url: '/agent_bots', body: agentBot() }],
    });
    expect(calls[0].body).toEqual({ name: 'Bot' });
  });

  it.each([
    ['resetSecret', 'reset_secret', { secret: 'rotatedSecret' }],
    ['resetAccessToken', 'reset_access_token', { access_token: 'rotatedToken' }],
  ])('%s POSTs /agent_bots/:id/%s', async (operation, action, changed) => {
    const bot = agentBot(changed);
    const { output, calls } = await runChatwootNode({
      params: { resource: 'agentBot', operation, agentBotId: 4 },
      responses: [{ method: 'POST', url: `/agent_bots/4/${action}`, body: bot }],
    });
    expect(calls[0].url).toBe(`${APP}/agent_bots/4/${action}`);
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([bot]);
  });

  it('delete avatar DELETEs /agent_bots/:id/avatar', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'agentBot', operation: 'deleteAvatar', agentBotId: 4 },
      responses: [{ method: 'DELETE', url: '/agent_bots/4/avatar', body: agentBot() }],
    });
    expect(calls[0].url).toBe(`${APP}/agent_bots/4/avatar`);
    expect(json(output)).toEqual([agentBot()]);
  });
});

// ---------------------------------------------------------------------------------------------
// Agent (ADMIN-6)
// ---------------------------------------------------------------------------------------------

describe('agent', () => {
  it('create sends availability (not availability_status) and custom_role_id', async () => {
    const created = agent(20, { availability_status: 'busy', role: 'administrator' });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'agent',
        operation: 'create',
        name: 'Ana',
        email: 'ana@acme.test',
        role: 'administrator',
        additionalFields: { availability: 'busy', auto_offline: false, custom_role_id: 5 },
      },
      responses: [{ method: 'POST', url: '/agents', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/agents`);
    expect(calls[0].body).toEqual({
      name: 'Ana',
      email: 'ana@acme.test',
      role: 'administrator',
      availability: 'busy',
      auto_offline: false,
      custom_role_id: 5,
    });
    expect(json(output)).toEqual([created]);
  });

  it('maps the legacy availability_status value "available" to availability "online"', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'agent',
        operation: 'create',
        name: 'Ana',
        email: 'ana@acme.test',
        role: 'agent',
        additionalFields: { availability_status: 'available' },
      },
      responses: [{ method: 'POST', url: '/agents', body: agent(20) }],
    });
    expect(calls[0].body).toEqual({
      name: 'Ana',
      email: 'ana@acme.test',
      role: 'agent',
      availability: 'online',
    });
  });

  it('create is not retried on 429 (per-day throttle)', async () => {
    const { output, calls, sleeps } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'agent',
        operation: 'create',
        name: 'Ana',
        email: 'ana@acme.test',
        role: 'agent',
      },
      responses: [{ method: 'POST', url: '/agents', status: 429, body: 'Retry later\n' }],
    });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
    expect(json(output)[0]).toMatchObject({ httpCode: '429' });
  });

  it('update sends availability and clears the custom role with 0', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'agent',
        operation: 'update',
        agentId: 20,
        updateFields: {
          availability: 'offline',
          availability_status: 'available',
          custom_role_id: 0,
        },
      },
      responses: [{ method: 'PATCH', url: '/agents/20', body: agent(20) }],
    });
    expect(calls[0].url).toBe(`${APP}/agents/20`);
    expect(calls[0].body).toEqual({ availability: 'offline', custom_role_id: null });
  });

  it.each([31, null, undefined])('update preserves the existing custom role %s when omitted', async (customRoleId) => {
    const { calls } = await runChatwootNode({
      params: { resource: 'agent', operation: 'update', agentId: 20, updateFields: { availability: 'busy' } },
      responses: [
        { method: 'GET', url: '/agents', body: [agent(1), { ...agent(20), custom_role_id: customRoleId }] },
        { method: 'PATCH', url: '/agents/20', body: agent(20) },
      ],
    });
    expect(calls.map((call) => call.method)).toEqual(['GET', 'PATCH']);
    expect(calls[1].body).toEqual({ availability: 'busy', ...(customRoleId ? { custom_role_id: customRoleId } : {}) });
  });

  it('does not update an agent if its current custom role could not be read', async () => {
    const { calls, output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'agent', operation: 'update', agentId: 20, updateFields: { name: 'Ana' } },
      responses: [{ method: 'GET', url: '/agents', body: [agent(1)] }],
    });
    expect(calls).toHaveLength(1);
    expect(output[0][0].json.error).toContain('custom role could not be preserved');
  });

  it('delete is not retried and emits a success item', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'agent', operation: 'delete', agentId: 20 },
      responses: [{ method: 'DELETE', url: '/agents/20' }],
    });
    expect(calls[0].url).toBe(`${APP}/agents/20`);
    expect(json(output)).toEqual([{ success: true, id: 20 }]);
  });
});

// ---------------------------------------------------------------------------------------------
// Team (ADMIN-3 / RELEASE-4 item output)
// ---------------------------------------------------------------------------------------------

describe('team', () => {
  it('delete agent sends the body and reports the removed members', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'team', operation: 'deleteAgent', teamId: 5, userIds: '1, 2' },
      responses: [{ method: 'DELETE', url: '/teams/5/team_members' }],
    });
    expect(calls[0].url).toBe(`${APP}/teams/5/team_members`);
    expect(calls[0].body).toEqual({ user_ids: [1, 2] });
    expect(json(output)).toEqual([{ success: true, teamId: 5, userIds: [1, 2] }]);
  });

  it('add agent returns the added members (team_members/create.json)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'team', operation: 'addAgent', teamId: 5, userIds: '3' },
      responses: [{ method: 'POST', url: '/teams/5/team_members', body: [agent(3)] }],
    });
    expect(calls[0].body).toEqual({ user_ids: [3] });
    expect(json(output)).toEqual([agent(3)]);
  });

  it('update agents rejects a malformed list before calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'team', operation: 'updateAgents', teamId: 5, userIds: '3;4' },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toContain('"3;4"');
  });
});

// ---------------------------------------------------------------------------------------------
// Account (ADMIN-8, ADMIN-20)
// ---------------------------------------------------------------------------------------------

describe('account', () => {
  const account = {
    settings: {
      auto_resolve_after: 1440,
      auto_resolve_message: 'Closed',
      auto_resolve_label: 'auto',
    },
    created_at: '2025-01-01T00:00:00.000Z',
    domain: 'acme.test',
    features: { channel_email: true },
    id: 1,
    locale: 'pt_BR',
    name: 'Acme',
    support_email: 'support@acme.test',
    status: 'active',
    cache_keys: { label: 1, inbox: 1, team: 1 },
  };

  it('update sends settings, custom attributes and a valid locale at the root of PATCH /accounts/:id', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'account',
        operation: 'update',
        updateFields: {
          name: 'Acme',
          locale: 'pt_BR',
          auto_resolve_after: 1440,
          auto_resolve_message: 'Closed',
          auto_resolve_label: 'auto',
          auto_resolve_ignore_waiting: true,
          industry: 'Retail',
          timezone: 'America/Sao_Paulo',
        },
      },
      responses: [{ method: 'PATCH', url: APP, body: account }],
    });
    expect(calls[0].url).toBe(APP);
    expect(calls[0].body).toEqual({
      name: 'Acme',
      locale: 'pt_BR',
      auto_resolve_after: 1440,
      auto_resolve_message: 'Closed',
      auto_resolve_label: 'auto',
      auto_resolve_ignore_waiting: true,
      industry: 'Retail',
      timezone: 'America/Sao_Paulo',
    });
    expect(json(output)).toEqual([account]);
  });

  it('converts the legacy auto_resolve_duration (days) and the legacy "zh" locale', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'account',
        operation: 'update',
        updateFields: { auto_resolve_duration: 7, locale: 'zh' },
      },
      responses: [{ method: 'PATCH', url: APP, body: account }],
    });
    expect(calls[0].body).toEqual({ locale: 'zh_CN', auto_resolve_after: 10080 });
  });

  it('0 disables auto-resolve (null) and out-of-range values fail before the request', async () => {
    const disabled = await runChatwootNode({
      params: { resource: 'account', operation: 'update', updateFields: { auto_resolve_after: 0 } },
      responses: [{ method: 'PATCH', url: APP, body: account }],
    });
    expect(disabled.calls[0].body).toEqual({ auto_resolve_after: null });

    const invalid = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'account', operation: 'update', updateFields: { auto_resolve_after: 5 } },
      responses: [],
    });
    expect(invalid.calls).toHaveLength(0);
    expect(json(invalid.output)[0].error).toContain('between 10 and 1439856');
  });

  it('rejects the disabled "hi" locale', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'account', operation: 'update', updateFields: { locale: 'hi' } },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toContain('disabled the "hi" locale');
  });

  it('branded email layout: get and update (empty clears with null)', async () => {
    const get = await runChatwootNode({
      params: { resource: 'account', operation: 'getBrandedEmailLayout' },
      responses: [
        { method: 'GET', url: '/branded_email_layout', body: { branded_email_layout: null } },
      ],
    });
    expect(get.calls[0].url).toBe(`${APP}/branded_email_layout`);
    expect(json(get.output)).toEqual([{ branded_email_layout: null }]);

    const layout = '<html><body>{{ content_for_layout }}</body></html>';
    const set = await runChatwootNode({
      params: {
        resource: 'account',
        operation: 'updateBrandedEmailLayout',
        brandedEmailLayout: layout,
      },
      responses: [
        { method: 'PATCH', url: '/branded_email_layout', body: { branded_email_layout: layout } },
      ],
    });
    expect(set.calls[0].body).toEqual({ branded_email_layout: layout });
    expect(json(set.output)).toEqual([{ branded_email_layout: layout }]);

    const clear = await runChatwootNode({
      params: {
        resource: 'account',
        operation: 'updateBrandedEmailLayout',
        brandedEmailLayout: '',
      },
      responses: [
        { method: 'PATCH', url: '/branded_email_layout', body: { branded_email_layout: null } },
      ],
    });
    expect(clear.calls[0].body).toEqual({ branded_email_layout: null });
  });

  it('feature disabled surfaces Chatwoot 422 message', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'account',
        operation: 'updateBrandedEmailLayout',
        brandedEmailLayout: 'x',
      },
      responses: [
        {
          method: 'PATCH',
          url: '/branded_email_layout',
          status: 422,
          // render_could_not_create_error renders { error: message }
          body: { error: 'Branded email templates feature is not enabled' },
        },
      ],
    });
    expect(json(output)[0].error).toContain('Branded email templates feature is not enabled');
  });
});

// ---------------------------------------------------------------------------------------------
// Integration (ADMIN-18)
// ---------------------------------------------------------------------------------------------

describe('integration hooks', () => {
  it('account-level app (Cloudflare RealtimeKit "dyte") is created without inbox_id', async () => {
    const created = hook();
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'integration',
        operation: 'createHook',
        appId: 'dyte',
        settings: '{"account_id": "cf-account", "app_id": "rtk-app", "api_token": "tok"}',
      },
      responses: [{ method: 'POST', url: '/integrations/hooks', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/integrations/hooks`);
    expect(calls[0].body).toEqual({
      hook: {
        app_id: 'dyte',
        settings: { account_id: 'cf-account', app_id: 'rtk-app', api_token: 'tok' },
      },
    });
    expect(json(output)).toEqual([created]);
  });

  it('inbox-level app (Dialogflow) sends inbox_id', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'integration',
        operation: 'createHook',
        appId: 'dialogflow',
        inboxId: 3,
        settings: '{"project_id": "p", "credentials": {}}',
      },
      responses: [
        {
          method: 'POST',
          url: '/integrations/hooks',
          body: hook({
            app_id: 'dialogflow',
            hook_type: 'inbox',
            inbox: { id: 3, name: 'Evolution' },
          }),
        },
      ],
    });
    expect(calls[0].body).toEqual({
      hook: { app_id: 'dialogflow', inbox_id: 3, settings: { project_id: 'p', credentials: {} } },
    });
  });

  it('an invalid inbox ID fails before calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'integration',
        operation: 'createHook',
        appId: 'dialogflow',
        inboxId: -1,
        settings: '{}',
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toBe('Inbox ID must be a positive integer');
  });

  it('update can change only the status (empty settings are not sent)', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'integration',
        operation: 'updateHook',
        appId: 'dyte', // obsolete, hidden: dropped like n8n does
        hookId: 12,
        settings: '{}',
        updateFields: { status: 'disabled' },
      },
      responses: [
        { method: 'PATCH', url: '/integrations/hooks/12', body: hook({ status: false }) },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/integrations/hooks/12`);
    expect(calls[0].body).toEqual({ hook: { status: 'disabled' } });
    expect(json(output)[0].status).toBe(false);
  });

  it('update with new settings wraps them under hook', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'integration',
        operation: 'updateHook',
        hookId: 12,
        settings: '{"api_key": "sk"}',
      },
      responses: [
        { method: 'PATCH', url: '/integrations/hooks/12', body: hook({ app_id: 'openai' }) },
      ],
    });
    expect(calls[0].body).toEqual({ hook: { settings: { api_key: 'sk' } } });
  });

  it('update with nothing to change fails before calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'integration', operation: 'updateHook', hookId: 12, settings: '{}' },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(json(output)[0].error).toBe('Set Settings or a Status to update the hook');
  });

  it('delete hook ignores the obsolete app ID', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'integration', operation: 'deleteHook', appId: 'dyte', hookId: 12 },
      responses: [{ method: 'DELETE', url: '/integrations/hooks/12' }],
    });
    expect(calls[0].url).toBe(`${APP}/integrations/hooks/12`);
    expect(json(output)).toEqual([{ success: true, id: 12 }]);
  });
});
