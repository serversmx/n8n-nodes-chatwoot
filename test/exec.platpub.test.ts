/**
 * Execute-level tests for the Platform API (platformAccount, platformUser, accountUser, accountAgentBot)
 * and Public API (publicContact, publicConversation, publicMessage, publicInbox) resources, plus the
 * credential test requests. Response bodies follow the Chatwoot 4.18 jbuilder views:
 *   app/views/platform/api/v1/models/_account.json.jbuilder, _agent_bot.json.jbuilder, _user.json.jbuilder,
 *   app/views/platform/api/v1/users/token.json.jbuilder, account_users#index (`render json:` of AccountUser),
 *   app/views/public/api/v1/inboxes/contacts/*.json.jbuilder (+ models/_contact), models/_conversation,
 *   models/_message, inboxes/show.json.jbuilder (+ models/_inbox), models/_csat_survey.
 */
import { createHmac } from 'crypto';
import type {
  ICredentialTestRequest,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
  INodePropertyOptions,
  INodeType,
  INodeTypes,
  NodeParameterValueType,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, Workflow } from 'n8n-workflow';

import { ChatwootApi } from '../credentials/ChatwootApi.credentials';
import { ChatwootPlatformApi } from '../credentials/ChatwootPlatformApi.credentials';
import { ChatwootPublicApi } from '../credentials/ChatwootPublicApi.credentials';
import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import {
  accountAgentBotOperations,
  accountAgentBotFields,
} from '../nodes/Chatwoot/resources/accountAgentBot';
import { accountUserOperations, accountUserFields } from '../nodes/Chatwoot/resources/accountUser';
import {
  platformAccountOperations,
  platformAccountFields,
} from '../nodes/Chatwoot/resources/platformAccount';
import {
  platformUserOperations,
  platformUserFields,
} from '../nodes/Chatwoot/resources/platformUser';
import {
  publicContactOperations,
  publicContactFields,
} from '../nodes/Chatwoot/resources/publicContact';
import {
  publicConversationOperations,
  publicConversationFields,
} from '../nodes/Chatwoot/resources/publicConversation';
import { publicInboxOperations, publicInboxFields } from '../nodes/Chatwoot/resources/publicInbox';
import {
  publicMessageOperations,
  publicMessageFields,
} from '../nodes/Chatwoot/resources/publicMessage';
import { computeIdentifierHash } from '../nodes/Chatwoot/resources/publicContact/identity';
import { createMockExecuteFunctions, runChatwootNode } from './helpers/mockExecuteFunctions';
import type { RecordedCall } from './helpers/mockExecuteFunctions';

const BASE = 'https://chatwoot.test';
const PLATFORM = `${BASE}/platform/api/v1`;
const PUBLIC = `${BASE}/public/api/v1`;
const INBOX = `${PUBLIC}/inboxes/inbox-identifier`;

const json = (output: INodeExecutionData[][]) => output[0].map((item) => item.json);

async function runExpectingError(options: Parameters<typeof createMockExecuteFunctions>[0]) {
  const mock = createMockExecuteFunctions({ description: new Chatwoot().description, ...options });
  let caught: unknown;
  try {
    await new Chatwoot().execute.call(mock.ctx);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
  return { error: caught as NodeApiError | NodeOperationError, calls: mock.calls };
}

// ---------------------------------------------------------------------------------------------
// Response shapes (Chatwoot 4.18 views)
// ---------------------------------------------------------------------------------------------

// platform/api/v1/models/_account.json.jbuilder
const platformAccount = (overrides: IDataObject = {}): IDataObject => ({
  id: 12,
  name: 'Acme',
  locale: 'en',
  domain: 'acme.test',
  support_email: 'support@acme.test',
  features: { inbox_management: true, help_center: true, agent_bots: true },
  custom_attributes: { plan: 'pro' },
  limits: { agents: 5, inboxes: 3 },
  status: 'active',
  ...overrides,
});

// platform/api/v1/models/_agent_bot.json.jbuilder
const platformBot = (overrides: IDataObject = {}): IDataObject => ({
  id: 7,
  name: 'Router',
  description: 'Routes conversations',
  outgoing_url: 'https://n8n.test/webhook/bot',
  account_id: 12,
  access_token: 'bot-token-7',
  ...overrides,
});

// platform/api/v1/models/_user.json.jbuilder
const platformUser = (overrides: IDataObject = {}): IDataObject => ({
  access_token: 'user-token-5',
  account_id: 12,
  available_name: 'Ana',
  avatar_url: '',
  confirmed: true,
  display_name: 'Ana',
  message_signature: null,
  email: 'ana@acme.test',
  id: 5,
  name: 'Ana López',
  provider: 'email',
  pubsub_token: 'pubsub-5',
  custom_attributes: { team: 'sales' },
  role: 'agent',
  ui_settings: {},
  uid: 'ana@acme.test',
  accounts: [{ id: 12, name: 'Acme', active_at: null, role: 'agent' }],
  ...overrides,
});

// account_users#index / #create: `render json:` of the AccountUser model
const accountUserRecord = (overrides: IDataObject = {}): IDataObject => ({
  id: 31,
  account_id: 12,
  user_id: 5,
  role: 'agent',
  inviter_id: null,
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
  active_at: null,
  availability: 'online',
  auto_offline: true,
  custom_role_id: null,
  agent_capacity_policy_id: null,
  ...overrides,
});

// public/api/v1/inboxes/contacts/{create,show,update}.json.jbuilder + models/_contact.json.jbuilder
const publicContact = (overrides: IDataObject = {}): IDataObject => ({
  source_id: 'c0ffee00-1111-2222-3333-444455556666',
  pubsub_token: 'contact-pubsub',
  id: 88,
  name: 'Luis',
  email: 'luis@example.com',
  phone_number: '+5215512345678',
  ...overrides,
});

// Contact#push_event_data (app/models/contact.rb), rendered as the message `sender`
const contactEventData: IDataObject = {
  additional_attributes: {},
  custom_attributes: {},
  email: 'luis@example.com',
  id: 88,
  identifier: null,
  name: 'Luis',
  phone_number: '+5215512345678',
  thumbnail: '',
  blocked: false,
  type: 'contact',
};

// `json.contact resource.contact` in _conversation.json.jbuilder: the Contact model as_json (every column)
const contactModel: IDataObject = {
  id: 88,
  name: 'Luis',
  email: 'luis@example.com',
  phone_number: '+5215512345678',
  account_id: 1,
  created_at: '2026-09-24T10:00:00.000Z',
  updated_at: '2026-09-24T10:00:00.000Z',
  additional_attributes: {},
  identifier: null,
  custom_attributes: {},
  last_activity_at: '2026-09-24T10:05:00.000Z',
  contact_type: 'lead',
  middle_name: '',
  last_name: '',
  location: '',
  country_code: '',
  blocked: false,
  company_id: null,
};

// public/api/v1/models/_message.json.jbuilder
const publicMessage = (id: number, overrides: IDataObject = {}): IDataObject => ({
  id,
  content: `message ${id}`,
  message_type: 0,
  content_type: 'text',
  content_attributes: {},
  created_at: 1758800000 + id,
  conversation_id: 3,
  sender: contactEventData,
  ...overrides,
});

// public/api/v1/models/_conversation.json.jbuilder
const publicConversation = (overrides: IDataObject = {}): IDataObject => ({
  id: 3,
  uuid: '98c5d7f3-8873-4262-b101-d56425ff7ee1',
  inbox_id: 4,
  contact_last_seen_at: 1758800100,
  status: 'open',
  agent_last_seen_at: 1758800050,
  messages: [publicMessage(1)],
  contact: contactModel,
  ...overrides,
});

// public/api/v1/inboxes/show.json.jbuilder + models/_inbox.json.jbuilder
const publicInbox: IDataObject = {
  identifier: 'inbox-identifier',
  identity_validation_enabled: false,
  name: 'WhatsApp Evolution',
  timezone: 'America/Mexico_City',
  working_hours: [],
  working_hours_enabled: false,
  csat_survey_enabled: true,
  greeting_enabled: false,
};

// public/api/v1/models/_csat_survey.json.jbuilder
const csatSurvey = (overrides: IDataObject = {}): IDataObject => ({
  id: 501,
  csat_survey_response: null,
  display_type: 'emoji',
  content: 'Please rate this conversation',
  inbox_avatar_url: '',
  inbox_name: 'WhatsApp Evolution',
  locale: 'es',
  conversation_id: 3,
  created_at: '2026-09-24T10:00:00.000Z',
  ...overrides,
});

// ---------------------------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------------------------

describe('platform/public resource definitions', () => {
  const resources: Array<{
    name: string;
    operations: INodeProperties;
    fields: INodeProperties[];
    count: number;
  }> = [
    {
      name: 'platformAccount',
      operations: platformAccountOperations,
      fields: platformAccountFields,
      count: 5,
    },
    {
      name: 'platformUser',
      operations: platformUserOperations,
      fields: platformUserFields,
      count: 6,
    },
    { name: 'accountUser', operations: accountUserOperations, fields: accountUserFields, count: 3 },
    {
      name: 'accountAgentBot',
      operations: accountAgentBotOperations,
      fields: accountAgentBotFields,
      count: 6,
    },
    {
      name: 'publicContact',
      operations: publicContactOperations,
      fields: publicContactFields,
      count: 3,
    },
    {
      name: 'publicConversation',
      operations: publicConversationOperations,
      fields: publicConversationFields,
      count: 8,
    },
    {
      name: 'publicMessage',
      operations: publicMessageOperations,
      fields: publicMessageFields,
      count: 3,
    },
    { name: 'publicInbox', operations: publicInboxOperations, fields: publicInboxFields, count: 1 },
  ];

  it.each(resources)(
    '$name: sorted, complete operation options targeting the resource',
    (resource) => {
      const options = resource.operations.options as INodePropertyOptions[];
      expect(resource.operations.displayOptions?.show?.resource).toEqual([resource.name]);
      expect(options).toHaveLength(resource.count);
      const names = options.map((option) => option.name);
      expect(names).toEqual([...names].sort());
      for (const option of options) {
        expect(option.value).toBeTruthy();
        expect(option.description).toBeTruthy();
        expect(option.action).toBeTruthy();
      }
      expect(options.map((option) => option.value)).toContain(resource.operations.default);
      for (const field of resource.fields) {
        expect(field.displayOptions?.show?.resource).toEqual([resource.name]);
      }
    },
  );

  it.each(resources)(
    '$name: no orphan fields and one type per parameter name',
    ({ operations, fields }) => {
      const values = (operations.options as INodePropertyOptions[]).map((option) => option.value);
      const types = new Map<string, string>();
      for (const field of fields) {
        const shownFor = (field.displayOptions?.show?.operation as string[] | undefined) ?? [];
        expect(shownFor.length).toBeGreaterThan(0);
        for (const operation of shownFor) expect(values).toContain(operation);
        // n8n keeps a value across operations by name: the same name must keep the same type
        expect(types.get(field.name) ?? field.type).toBe(field.type);
        types.set(field.name, field.type);
      }
    },
  );

  it('keeps the parameter names of saved workflows', () => {
    const names = (fields: INodeProperties[], operation: string) =>
      fields
        .filter((field) => (field.displayOptions?.show?.operation as string[]).includes(operation))
        .map((field) => field.name);
    expect(names(accountAgentBotFields, 'get')).toEqual(['agentBotId', 'accountId']);
    expect(names(accountAgentBotFields, 'create')).toEqual([
      'accountId',
      'name',
      'additionalFields',
    ]);
    expect(names(publicMessageFields, 'update')).toContain('content');
    expect(names(publicContactFields, 'update')).toEqual(['contactIdentifier', 'updateFields']);
  });

  it('registers the [Public] Inbox resource with the Public API credential', () => {
    const description = new Chatwoot().description;
    const resource = description.properties.find((property) => property.name === 'resource');
    expect(resource?.options).toContainEqual({ name: '[Public] Inbox', value: 'publicInbox' });
    const publicCredential = description.credentials?.find(
      (credential) => credential.name === 'chatwootPublicApi',
    );
    expect(publicCredential?.displayOptions?.show?.resource).toContain('publicInbox');
  });
});

// ---------------------------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------------------------

/**
 * Resolve a credential test request like n8n does: RoutingNode.getRequestOptionsFromParameters runs every
 * key of `routing.request` through the expression engine with `$credentials` as an additional key.
 */
function resolveCredentialTestRequest(
  request: ICredentialTestRequest['request'],
  credentials: IDataObject,
): IDataObject {
  const nodeType = { description: { properties: [] } } as unknown as INodeType;
  const nodeTypes = {
    getByName: () => nodeType,
    getByNameAndVersion: () => nodeType,
    getKnownTypes: () => ({}),
  } as unknown as INodeTypes;
  const workflow = new Workflow({
    nodes: [
      {
        id: 'temp',
        name: 'Temp-Node',
        type: 'n8n-nodes-base.noOp',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      },
    ],
    connections: {},
    active: false,
    nodeTypes,
  });
  return Object.fromEntries(
    Object.entries(request).map(([key, value]) => [
      key,
      workflow.expression.getParameterValue(
        value as NodeParameterValueType,
        null,
        0,
        0,
        'Temp-Node',
        [],
        'manual',
        { $credentials: credentials },
        undefined,
        true,
      ),
    ]),
  );
}

describe('credential test requests', () => {
  it('Application API: the expressions resolve to a list for users and conversation 0 for bots', () => {
    const { request } = new ChatwootApi().test;
    const base = { baseUrl: 'https://chatwoot.test/', accountId: 7, apiAccessToken: 't' };

    const user = resolveCredentialTestRequest(request, { ...base, tokenType: 'user' });
    expect(user).toMatchObject({
      baseURL: 'https://chatwoot.test',
      url: '/api/v1/accounts/7/conversations',
      method: 'GET',
      ignoreHttpStatusErrors: false,
    });
    // Credentials saved before 0.9.0 have no tokenType: they keep the user test
    expect(resolveCredentialTestRequest(request, base)).toMatchObject({
      url: '/api/v1/accounts/7/conversations',
      ignoreHttpStatusErrors: false,
    });

    const bot = resolveCredentialTestRequest(request, { ...base, tokenType: 'agentBot' });
    expect(bot).toMatchObject({
      url: '/api/v1/accounts/7/conversations/0',
      ignoreHttpStatusErrors: true,
    });
  });

  it('Public API: the test URL resolves to the inbox of the credential', () => {
    const resolved = resolveCredentialTestRequest(new ChatwootPublicApi().test.request, {
      baseUrl: 'https://chatwoot.test/',
      inboxIdentifier: 'AbC123',
    });
    expect(resolved).toEqual({
      baseURL: 'https://chatwoot.test',
      url: '/public/api/v1/inboxes/AbC123',
      method: 'GET',
    });
  });

  it('Public API: side-effect-free GET of the API inbox (works with HMAC-enforced inboxes)', () => {
    const credential = new ChatwootPublicApi();
    expect(credential.test.request).toEqual({
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '=/public/api/v1/inboxes/{{$credentials.inboxIdentifier}}',
      method: 'GET',
    });
    expect(credential.test.request.body).toBeUndefined();
    const inboxIdentifier = credential.properties.find(
      (property) => property.name === 'inboxIdentifier',
    );
    expect(inboxIdentifier?.description).toContain('API channel inbox');
    expect(inboxIdentifier?.description).not.toContain('only Web Widget');
    const hmacToken = credential.properties.find((property) => property.name === 'hmacToken');
    expect(hmacToken).toMatchObject({
      type: 'string',
      typeOptions: { password: true },
      default: '',
    });
    expect(hmacToken?.required).toBeFalsy();
  });

  it('Platform API: lists the agent bots of the Platform App', () => {
    expect(new ChatwootPlatformApi().test.request).toMatchObject({
      url: '/platform/api/v1/agent_bots',
      method: 'GET',
    });
  });

  it('Application API: user tokens list conversations, agent bot tokens read conversation 0', () => {
    const credential = new ChatwootApi();
    const tokenType = credential.properties.find((property) => property.name === 'tokenType');
    expect(tokenType).toMatchObject({ type: 'options', default: 'user' });
    expect((tokenType?.options as INodePropertyOptions[]).map((option) => option.value)).toEqual([
      'agentBot',
      'user',
    ]);
    const notice = credential.properties.find((property) => property.name === 'agentBotNotice');
    expect(notice).toMatchObject({
      type: 'notice',
      displayOptions: { show: { tokenType: ['agentBot'] } },
    });
    expect(notice?.displayName).toContain('Message > Create');

    const { request, rules } = credential.test;
    expect(request.url).toBe(
      '=/api/v1/accounts/{{$credentials.accountId}}/conversations{{$credentials.tokenType === "agentBot" ? "/0" : ""}}',
    );
    // HTTP errors only become non-fatal for bot tokens; the rules turn Chatwoot errors back into failures
    expect(request.ignoreHttpStatusErrors).toBe('={{$credentials.tokenType === "agentBot"}}');
    const errors = (rules ?? []).map((rule) => (rule.properties as IDataObject).value);
    expect(errors).toEqual(
      expect.arrayContaining([
        'Invalid Access Token',
        'Bot is not authorized to access this account',
        'Access to this endpoint is not authorized for bots',
        'Account is suspended',
      ]),
    );
    for (const rule of rules ?? []) expect(rule.type).toBe('responseSuccessBody');
  });
});

// ---------------------------------------------------------------------------------------------
// Platform API: accounts
// ---------------------------------------------------------------------------------------------

describe('platformAccount', () => {
  it('create sends status, limits and custom attributes, then the features (as booleans) in a PATCH', async () => {
    // accounts_controller#create saves the account before applying features and links it to the
    // Platform App last: features go in a second request so a bad name cannot orphan the account
    const created = platformAccount({ locale: 'es', features: { inbox_management: true } });
    const withFeatures = platformAccount({
      locale: 'es',
      features: { inbox_management: true, help_center: true },
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'platformAccount',
        operation: 'create',
        name: 'Acme',
        additionalFields: {
          locale: 'es',
          status: 'active',
          features: '{"help_center": true, "campaigns": "false", "macros": 0}',
          limits: '{"agents": 5, "inboxes": 3}',
          custom_attributes: '{"plan": "pro"}',
        },
      },
      responses: [
        { method: 'POST', url: `${PLATFORM}/accounts`, body: created },
        { method: 'PATCH', url: `${PLATFORM}/accounts/12`, body: withFeatures },
      ],
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${PLATFORM}/accounts`,
      `PATCH ${PLATFORM}/accounts/12`,
    ]);
    expect(calls[0].headers.api_access_token).toBe('platform-token');
    expect(calls[0].body).toEqual({
      name: 'Acme',
      locale: 'es',
      status: 'active',
      limits: { agents: 5, inboxes: 3 },
      custom_attributes: { plan: 'pro' },
    });
    expect(calls[1].body).toEqual({
      features: { help_center: true, campaigns: false, macros: false },
    });
    expect(json(output)).toEqual([withFeatures]);
  });

  it('create without features (or with an empty object) makes a single POST', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'platformAccount',
        operation: 'create',
        name: 'Acme',
        additionalFields: { features: '{}', support_email: 'support@acme.test' },
      },
      responses: [{ method: 'POST', url: `${PLATFORM}/accounts`, body: platformAccount() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ name: 'Acme', support_email: 'support@acme.test' });
    expect(json(output)).toEqual([platformAccount()]);
  });

  it('create: a 500 from an unknown feature names the account that was already created', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'platformAccount',
        operation: 'create',
        name: 'Acme',
        additionalFields: { features: { channel_twitter: true } },
      },
      responses: [
        { method: 'POST', url: `${PLATFORM}/accounts`, body: platformAccount() },
        { method: 'PATCH', url: `${PLATFORM}/accounts/12`, status: 500, body: '<html>500</html>' },
      ],
    });
    expect(calls.map((call) => call.method)).toEqual(['POST', 'PATCH']);
    const item = json(output)[0];
    expect(item.httpCode).toBe('500');
    expect(item.description).toContain('Account 12 was created, but its features could not be set');
    expect(item.description).toContain('feature name does not exist in this Chatwoot version');
    expect(item.description).toContain('Request: PATCH /platform/api/v1/accounts/12');
  });

  it('create: any failure of the features PATCH still names the created account', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'platformAccount',
        operation: 'create',
        name: 'Acme',
        additionalFields: { features: '{"crm": true}' },
      },
      responses: [
        { method: 'POST', url: `${PLATFORM}/accounts`, body: platformAccount() },
        {
          method: 'PATCH',
          url: `${PLATFORM}/accounts/12`,
          status: 401,
          body: { error: 'Non permissible resource' },
        },
      ],
    });
    const item = json(output)[0];
    expect(item.httpCode).toBe('401');
    expect(item.description).toContain('Account 12 was created, but its features could not be set');
    expect(item.description).not.toContain('feature name does not exist');
  });

  it('update: a 500 while toggling features gets the feature hint', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'platformAccount',
        operation: 'update',
        accountId: 12,
        updateFields: { features: '{"typo_feature": true}' },
      },
      responses: [{ method: 'PATCH', url: `${PLATFORM}/accounts/12`, status: 500 }],
    });
    expect(json(output)[0].description).toContain(
      'feature name does not exist in this Chatwoot version',
    );
    expect(json(output)[0].description).not.toContain('was created');
  });

  it.each([
    ['limits', '[5]', 'Limits must be a JSON object'],
    ['custom_attributes', '"pro"', 'Custom Attributes must be a JSON object'],
    ['features', 'null', 'Features must be a JSON object'],
  ])(
    'rejects %s that is not a JSON object (Chatwoot would drop it silently)',
    async (field, value, message) => {
      const { error, calls } = await runExpectingError({
        params: {
          resource: 'platformAccount',
          operation: 'update',
          accountId: 12,
          updateFields: { [field]: value },
        },
      });
      expect(error).toBeInstanceOf(NodeOperationError);
      expect(error.message).toContain(message);
      expect(calls).toHaveLength(0);
    },
  );

  it('getAll lists the accounts of the Platform App (root array)', async () => {
    const accounts = [
      platformAccount(),
      platformAccount({ id: 13, name: 'Beta', status: 'suspended' }),
    ];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'platformAccount', operation: 'getAll' },
      responses: [{ method: 'GET', url: `${PLATFORM}/accounts`, body: accounts }],
    });
    expect(calls[0].url).toBe(`${PLATFORM}/accounts`);
    expect(calls[0].qs).toBeUndefined();
    expect(json(output)).toEqual(accounts);
  });

  it('update can suspend an account', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'platformAccount',
        operation: 'update',
        accountId: 12,
        updateFields: { status: 'suspended', features: { crm: true } },
      },
      responses: [
        {
          method: 'PATCH',
          url: `${PLATFORM}/accounts/12`,
          body: platformAccount({ status: 'suspended' }),
        },
      ],
    });
    expect(calls[0].body).toEqual({ status: 'suspended', features: { crm: true } });
    expect(json(output)[0].status).toBe('suspended');
  });

  it('get and delete', async () => {
    const got = await runChatwootNode({
      params: { resource: 'platformAccount', operation: 'get', accountId: 12 },
      responses: [{ method: 'GET', url: `${PLATFORM}/accounts/12`, body: platformAccount() }],
    });
    expect(json(got.output)).toEqual([platformAccount()]);

    const deleted = await runChatwootNode({
      params: { resource: 'platformAccount', operation: 'delete', accountId: 12 },
      responses: [{ method: 'DELETE', url: `${PLATFORM}/accounts/12` }],
    });
    expect(deleted.calls[0].body).toBeUndefined();
    expect(json(deleted.output)).toEqual([{ success: true, id: 12 }]);
  });

  it('rejects features that are not a JSON object before calling Chatwoot', async () => {
    const { error, calls } = await runExpectingError({
      params: {
        resource: 'platformAccount',
        operation: 'update',
        accountId: 12,
        updateFields: { features: '["help_center"]' },
      },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Features must be a JSON object');
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Platform API: users
// ---------------------------------------------------------------------------------------------

describe('platformUser', () => {
  it('create sends display_name, password and parsed custom attributes', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'platformUser',
        operation: 'create',
        email: 'ana@acme.test',
        name: 'Ana López',
        additionalFields: {
          display_name: 'Ana',
          password: 'Password1!',
          custom_attributes: '{"team":"sales"}',
        },
      },
      responses: [{ method: 'POST', url: `${PLATFORM}/users`, body: platformUser() }],
    });
    expect(calls[0].body).toEqual({
      email: 'ana@acme.test',
      name: 'Ana López',
      display_name: 'Ana',
      password: 'Password1!',
      custom_attributes: { team: 'sales' },
    });
    expect(json(output)).toEqual([platformUser()]);
  });

  it('getToken POSTs /users/:id/token and returns { access_token, expiry, user }', async () => {
    const token = {
      access_token: 'user-token-5',
      expiry: null,
      user: {
        id: 5,
        name: 'Ana López',
        display_name: 'Ana',
        email: 'ana@acme.test',
        pubsub_token: 'pubsub-5',
      },
    };
    const { output, calls } = await runChatwootNode({
      params: { resource: 'platformUser', operation: 'getToken', userId: 5 },
      responses: [{ method: 'POST', url: `${PLATFORM}/users/5/token`, body: token }],
    });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([token]);
  });

  it('update sends display_name', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'platformUser',
        operation: 'update',
        userId: 5,
        updateFields: { display_name: 'Ana L.' },
      },
      responses: [
        {
          method: 'PATCH',
          url: `${PLATFORM}/users/5`,
          body: platformUser({ display_name: 'Ana L.' }),
        },
      ],
    });
    expect(calls[0].body).toEqual({ display_name: 'Ana L.' });
  });

  it('getSsoUrl', async () => {
    const { output } = await runChatwootNode({
      params: { resource: 'platformUser', operation: 'getSsoUrl', userId: 5 },
      responses: [
        {
          method: 'GET',
          url: `${PLATFORM}/users/5/login`,
          body: { url: 'https://chatwoot.test/app/login?email=ana%40acme.test&sso_auth_token=abc' },
        },
      ],
    });
    expect(json(output)[0].url).toContain('sso_auth_token=');
  });

  it('get reads /users/:id with the platform token', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'platformUser', operation: 'get', userId: 5 },
      responses: [{ method: 'GET', url: `${PLATFORM}/users/5`, body: platformUser() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${PLATFORM}/users/5`);
    expect(calls[0].headers.api_access_token).toBe('platform-token');
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([platformUser()]);
  });

  it('delete sends DELETE /users/:id (head :ok) and emits a meaningful item', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'platformUser', operation: 'delete', userId: 5 },
      responses: [{ method: 'DELETE', url: `${PLATFORM}/users/5` }],
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `DELETE ${PLATFORM}/users/5`,
    ]);
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([{ success: true, id: 5 }]);
  });

  it('rejects an invalid User ID before calling Chatwoot', async () => {
    const { error, calls } = await runExpectingError({
      params: { resource: 'platformUser', operation: 'getToken', userId: 0 },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toBe('User ID must be a positive integer');
    expect(error.context.itemIndex).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Platform API: account users
// ---------------------------------------------------------------------------------------------

describe('accountUser', () => {
  it('getAll returns the memberships (root array)', async () => {
    const memberships = [
      accountUserRecord(),
      accountUserRecord({ id: 32, user_id: 6, role: 'administrator' }),
    ];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountUser', operation: 'getAll', accountId: 12 },
      responses: [
        { method: 'GET', url: `${PLATFORM}/accounts/12/account_users`, body: memberships },
      ],
    });
    expect(calls[0].url).toBe(`${PLATFORM}/accounts/12/account_users`);
    expect(json(output)).toEqual(memberships);
  });

  it('create sends { user_id, role }', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'accountUser',
        operation: 'create',
        accountId: 12,
        userId: 5,
        role: 'administrator',
      },
      responses: [
        {
          method: 'POST',
          url: `${PLATFORM}/accounts/12/account_users`,
          body: accountUserRecord({ role: 'administrator' }),
        },
      ],
    });
    expect(calls[0].body).toEqual({ user_id: 5, role: 'administrator' });
    expect(json(output)[0].role).toBe('administrator');
  });

  it('delete sends { user_id } in the DELETE body (account_users_controller#destroy)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountUser', operation: 'delete', accountId: 12, userId: 5 },
      responses: [{ method: 'DELETE', url: `${PLATFORM}/accounts/12/account_users` }],
    });
    expect(calls[0].url).toBe(`${PLATFORM}/accounts/12/account_users`);
    expect(calls[0].body).toEqual({ user_id: 5 });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(json(output)).toEqual([{ success: true, accountId: 12, userId: 5 }]);
  });

  it('delete runs once per input item with that item parameters (item looping, pairedItem)', async () => {
    const { output, calls } = await runChatwootNode({
      items: [{ json: { user: 5 } }, { json: { user: 6 } }],
      params: { resource: 'accountUser', operation: 'delete', accountId: 12, userId: 5 },
      itemParams: [undefined, { userId: 6 }],
      responses: [
        { method: 'DELETE', url: `${PLATFORM}/accounts/12/account_users` },
        { method: 'DELETE', url: `${PLATFORM}/accounts/12/account_users` },
      ],
    });
    expect(calls.map((call) => call.body)).toEqual([{ user_id: 5 }, { user_id: 6 }]);
    expect(output[0]).toEqual([
      { json: { success: true, accountId: 12, userId: 5 }, pairedItem: { item: 0 } },
      { json: { success: true, accountId: 12, userId: 6 }, pairedItem: { item: 1 } },
    ]);
  });

  it('continueOnFail keeps going after a failed item and points the error at it', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      items: [{ json: {} }, { json: {} }],
      params: { resource: 'accountUser', operation: 'getAll', accountId: 12 },
      itemParams: [{ accountId: 99 }, undefined],
      responses: [
        {
          method: 'GET',
          url: `${PLATFORM}/accounts/99/account_users`,
          status: 401,
          body: { error: 'Non permissible resource' },
        },
        {
          method: 'GET',
          url: `${PLATFORM}/accounts/12/account_users`,
          body: [accountUserRecord()],
        },
      ],
    });
    expect(calls.map((call) => call.url)).toEqual([
      `${PLATFORM}/accounts/99/account_users`,
      `${PLATFORM}/accounts/12/account_users`,
    ]);
    expect(output[0]).toHaveLength(2);
    expect(output[0][0]).toMatchObject({
      json: { error: 'Chatwoot Platform API error 401 Unauthorized: Non permissible resource' },
      pairedItem: { item: 0 },
    });
    expect(output[0][1]).toEqual({ json: accountUserRecord(), pairedItem: { item: 1 } });
  });
});

// ---------------------------------------------------------------------------------------------
// Platform API: agent bots (/platform/api/v1/agent_bots, never nested under accounts)
// ---------------------------------------------------------------------------------------------

describe('accountAgentBot (Platform agent bots)', () => {
  const bots = [
    platformBot(),
    platformBot({ id: 8, account_id: 13 }),
    platformBot({ id: 9, account_id: null }),
  ];

  it('getAll calls the top-level /agent_bots and returns every bot of the Platform App', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'getAll' },
      responses: [{ method: 'GET', url: `${PLATFORM}/agent_bots`, body: bots }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${PLATFORM}/agent_bots`);
    expect(calls[0].qs).toBeUndefined();
    expect(json(output)).toEqual(bots);
  });

  it('getAll with an Account ID filters by account_id on the client', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'getAll', accountId: 13 },
      responses: [{ method: 'GET', url: `${PLATFORM}/agent_bots`, body: bots }],
    });
    expect(calls[0].url).toBe(`${PLATFORM}/agent_bots`);
    expect(json(output)).toEqual([platformBot({ id: 8, account_id: 13 })]);
  });

  it('get reads /agent_bots/:id (legacy Account ID of saved workflows becomes an ownership check)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'get', agentBotId: 7, accountId: 12 },
      responses: [{ method: 'GET', url: `${PLATFORM}/agent_bots/7`, body: platformBot() }],
    });
    expect(calls.map((call) => call.url)).toEqual([`${PLATFORM}/agent_bots/7`]);
    expect(json(output)).toEqual([platformBot()]);

    const mismatch = await runExpectingError({
      params: { resource: 'accountAgentBot', operation: 'get', agentBotId: 9, accountId: 12 },
      responses: [
        {
          method: 'GET',
          url: `${PLATFORM}/agent_bots/9`,
          body: platformBot({ id: 9, account_id: null }),
        },
      ],
    });
    expect(mismatch.error).toBeInstanceOf(NodeOperationError);
    expect(mismatch.error.message).toBe(
      'Agent bot 9 belongs to no account (it is a global bot), not to account 12',
    );
  });

  it('create POSTs /agent_bots with account_id and avatar_url', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'accountAgentBot',
        operation: 'create',
        accountId: 12,
        name: 'Router',
        additionalFields: {
          description: 'Routes conversations',
          outgoing_url: 'https://n8n.test/webhook/bot',
          avatar_url: 'https://cdn.test/bot.png',
        },
      },
      responses: [{ method: 'POST', url: `${PLATFORM}/agent_bots`, body: platformBot() }],
    });
    expect(calls[0].body).toEqual({
      name: 'Router',
      account_id: 12,
      description: 'Routes conversations',
      outgoing_url: 'https://n8n.test/webhook/bot',
      avatar_url: 'https://cdn.test/bot.png',
    });
    expect(json(output)[0].access_token).toBe('bot-token-7');
  });

  it('create with Account ID 0 creates a global bot (no account_id)', async () => {
    const { calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'create', accountId: 0, name: 'Global' },
      responses: [
        {
          method: 'POST',
          url: `${PLATFORM}/agent_bots`,
          body: platformBot({ name: 'Global', account_id: null }),
        },
      ],
    });
    expect(calls[0].body).toEqual({ name: 'Global' });
  });

  it.each([
    ['create', { name: 'Router' }, ''],
    ['create', { name: 'Router' }, null],
    ['getAll', {}, 'not-a-number'],
    ['get', { agentBotId: 7 }, -3],
  ])(
    '%s: an Account ID expression that resolves to nothing fails instead of meaning "no account"',
    async (operation, extra, accountId) => {
      // Before: Number(x) || 0 turned these into a global bot (create) or every bot and its token (getAll)
      const { error, calls } = await runExpectingError({
        params: { resource: 'accountAgentBot', operation, accountId: 12, ...extra },
        itemParams: [{ accountId }],
      });
      expect(error).toBeInstanceOf(NodeOperationError);
      expect(error.message).toBe('Account ID must be a positive integer, or 0 for none');
      expect(calls).toHaveLength(0);
    },
  );

  it('update rejects a non-numeric account_id instead of turning the bot global', async () => {
    const { error, calls } = await runExpectingError({
      params: {
        resource: 'accountAgentBot',
        operation: 'update',
        agentBotId: 7,
        updateFields: { account_id: 'abc' },
      },
    });
    expect(error.message).toBe(
      'Account ID (update field) must be a positive integer, or 0 for none',
    );
    expect(calls).toHaveLength(0);
  });

  it('update checks the expected account, then PATCHes /agent_bots/:id (account_id 0 -> null)', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'accountAgentBot',
        operation: 'update',
        agentBotId: 7,
        accountId: 12,
        updateFields: { name: 'Router v2', account_id: 0 },
      },
      responses: [
        { method: 'GET', url: `${PLATFORM}/agent_bots/7`, body: platformBot() },
        {
          method: 'PATCH',
          url: `${PLATFORM}/agent_bots/7`,
          body: platformBot({ name: 'Router v2', account_id: null }),
        },
      ],
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET ${PLATFORM}/agent_bots/7`,
      `PATCH ${PLATFORM}/agent_bots/7`,
    ]);
    expect(calls[1].body).toEqual({ name: 'Router v2', account_id: null });
    expect(json(output)[0].account_id).toBeNull();
  });

  it('update without an expected account makes a single request and can move the bot', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'accountAgentBot',
        operation: 'update',
        agentBotId: 7,
        updateFields: { account_id: 13 },
      },
      responses: [
        { method: 'PATCH', url: `${PLATFORM}/agent_bots/7`, body: platformBot({ account_id: 13 }) },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ account_id: 13 });
  });

  it('delete sends DELETE /agent_bots/:id, and refuses a bot of another account', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'delete', agentBotId: 7 },
      responses: [{ method: 'DELETE', url: `${PLATFORM}/agent_bots/7` }],
    });
    expect(calls).toHaveLength(1);
    expect(json(output)).toEqual([{ success: true, id: 7 }]);

    const refused = await runExpectingError({
      params: { resource: 'accountAgentBot', operation: 'delete', agentBotId: 8, accountId: 12 },
      responses: [
        {
          method: 'GET',
          url: `${PLATFORM}/agent_bots/8`,
          body: platformBot({ id: 8, account_id: 13 }),
        },
      ],
    });
    expect(refused.error.message).toBe('Agent bot 8 belongs to account 13, not to account 12');
    expect(refused.calls.map((call) => call.method)).toEqual(['GET']);
  });

  it('deleteAvatar sends DELETE /agent_bots/:id/avatar and returns the bot', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'accountAgentBot', operation: 'deleteAvatar', agentBotId: 7 },
      responses: [
        { method: 'DELETE', url: `${PLATFORM}/agent_bots/7/avatar`, body: platformBot() },
      ],
    });
    expect(calls[0].url).toBe(`${PLATFORM}/agent_bots/7/avatar`);
    expect(json(output)).toEqual([platformBot()]);
  });

  it('surfaces "Non permissible resource" for bots of another Platform App', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'accountAgentBot', operation: 'get', agentBotId: 99 },
      responses: [
        {
          method: 'GET',
          url: `${PLATFORM}/agent_bots/99`,
          status: 401,
          body: { error: 'Non permissible resource' },
        },
      ],
    });
    expect(json(output)[0]).toMatchObject({
      error: 'Chatwoot Platform API error 401 Unauthorized: Non permissible resource',
      httpCode: '401',
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Public API: contacts
// ---------------------------------------------------------------------------------------------

describe('publicContact', () => {
  const credentials = {
    chatwootPublicApi: {
      baseUrl: BASE,
      inboxIdentifier: 'inbox-identifier',
      hmacToken: 'inbox-hmac-token',
    },
  };
  const hash = (identifier: string) =>
    createHmac('sha256', 'inbox-hmac-token').update(identifier).digest('hex');

  it('computeIdentifierHash matches OpenSSL::HMAC.hexdigest("sha256", token, identifier)', () => {
    expect(computeIdentifierHash('inbox-hmac-token', 'user-42')).toBe(hash('user-42'));
    expect(computeIdentifierHash('inbox-hmac-token', 'user-42')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('create sends source_id and avatar_url, drops empty fields and computes identifier_hash', async () => {
    const { output, calls } = await runChatwootNode({
      credentials,
      params: {
        resource: 'publicContact',
        operation: 'create',
        additionalFields: {
          source_id: '5215512345678',
          identifier: 'user-42',
          name: 'Luis',
          email: '',
          avatar_url: 'https://cdn.test/luis.png',
          custom_attributes: '{"plan":"gold"}',
        },
      },
      responses: [
        {
          method: 'POST',
          url: `${INBOX}/contacts`,
          body: publicContact({ source_id: '5215512345678' }),
        },
      ],
    });
    expect(calls[0].url).toBe(`${INBOX}/contacts`);
    expect(calls[0].headers.api_access_token).toBeUndefined();
    expect(calls[0].body).toEqual({
      source_id: '5215512345678',
      identifier: 'user-42',
      identifier_hash: hash('user-42'),
      name: 'Luis',
      avatar_url: 'https://cdn.test/luis.png',
      custom_attributes: { plan: 'gold' },
    });
    expect(json(output)).toEqual([publicContact({ source_id: '5215512345678' })]);
  });

  it('create keeps an explicit identifier_hash and works without an HMAC token', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'publicContact',
        operation: 'create',
        additionalFields: { identifier: 'user-42', identifier_hash: 'given-hash' },
      },
      responses: [{ method: 'POST', url: `${INBOX}/contacts`, body: publicContact() }],
    });
    expect(calls[0].body).toEqual({ identifier: 'user-42', identifier_hash: 'given-hash' });
  });

  it('get sends identifier and identifier_hash as query parameters (identity validation)', async () => {
    const { output, calls } = await runChatwootNode({
      credentials,
      params: {
        resource: 'publicContact',
        operation: 'get',
        contactIdentifier: '+5215512345678',
        identityValidation: { identifier: 'user-42' },
      },
      responses: [
        { method: 'GET', url: `${INBOX}/contacts/%2B5215512345678`, body: publicContact() },
      ],
    });
    expect(calls[0].url).toBe(`${INBOX}/contacts/%2B5215512345678`);
    expect(calls[0].qs).toEqual({ identifier: 'user-42', identifier_hash: hash('user-42') });
    expect(calls[0].body).toBeUndefined();
    expect(json(output)).toEqual([publicContact()]);
  });

  it('get without identity fields sends no query', async () => {
    const { calls } = await runChatwootNode({
      params: { resource: 'publicContact', operation: 'get', contactIdentifier: 'abc' },
      responses: [{ method: 'GET', url: `${INBOX}/contacts/abc`, body: publicContact() }],
    });
    expect(calls[0].qs).toBeUndefined();
  });

  it('update PATCHes the contact with identifier_hash; the 4.16+ response has only the public fields', async () => {
    const updated = publicContact({ name: 'Luis R.' });
    const { output, calls } = await runChatwootNode({
      credentials,
      params: {
        resource: 'publicContact',
        operation: 'update',
        contactIdentifier: 'abc',
        updateFields: { name: 'Luis R.', identifier: 'user-42', custom_attributes: '{"vip":true}' },
      },
      responses: [{ method: 'PATCH', url: `${INBOX}/contacts/abc`, body: updated }],
    });
    expect(calls[0].body).toEqual({
      name: 'Luis R.',
      identifier: 'user-42',
      identifier_hash: hash('user-42'),
      custom_attributes: { vip: true },
    });
    expect(Object.keys(json(output)[0]).sort()).toEqual(
      ['email', 'id', 'name', 'phone_number', 'pubsub_token', 'source_id'].sort(),
    );
  });

  it('rejects an identifier_hash without identifier before calling Chatwoot', async () => {
    const { error, calls } = await runExpectingError({
      params: {
        resource: 'publicContact',
        operation: 'update',
        contactIdentifier: 'abc',
        updateFields: { identifier_hash: 'abc123' },
      },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Identifier Hash needs the Identifier');
    expect(calls).toHaveLength(0);
  });

  it('adds the identity validation hint to the bare 500 of a failed HMAC check', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'publicContact', operation: 'get', contactIdentifier: 'abc' },
      responses: [
        { method: 'GET', url: `${INBOX}/contacts/abc`, status: 500, body: '<html>500</html>' },
      ],
    });
    const item = json(output)[0];
    expect(item.httpCode).toBe('500');
    expect(item.description).toContain('identity validation (HMAC)');
    expect(item.description).toContain(
      'Request: GET /public/api/v1/inboxes/inbox-identifier/contacts/abc',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Public API: conversations
// ---------------------------------------------------------------------------------------------

describe('publicConversation', () => {
  const conversations = `${INBOX}/contacts/abc/conversations`;

  it('create, get and getAll', async () => {
    const created = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'create',
        contactIdentifier: 'abc',
        additionalFields: { custom_attributes: '{"order":"A-1"}' },
      },
      responses: [
        { method: 'POST', url: conversations, body: publicConversation({ messages: [] }) },
      ],
    });
    expect(created.calls[0].body).toEqual({ custom_attributes: { order: 'A-1' } });
    expect(json(created.output)[0].uuid).toBe('98c5d7f3-8873-4262-b101-d56425ff7ee1');

    const got = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'get',
        contactIdentifier: 'abc',
        conversationId: 3,
      },
      responses: [{ method: 'GET', url: `${conversations}/3`, body: publicConversation() }],
    });
    expect(json(got.output)).toEqual([publicConversation()]);

    const list = [publicConversation(), publicConversation({ id: 4, status: 'resolved' })];
    const many = await runChatwootNode({
      params: { resource: 'publicConversation', operation: 'getAll', contactIdentifier: 'abc' },
      responses: [{ method: 'GET', url: conversations, body: list }],
    });
    expect(json(many.output)).toEqual(list);
  });

  it('resolve POSTs toggle_status and returns the conversation', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'resolve',
        contactIdentifier: 'abc',
        conversationId: 3,
      },
      responses: [
        {
          method: 'POST',
          url: `${conversations}/3/toggle_status`,
          body: publicConversation({ status: 'resolved' }),
        },
      ],
    });
    expect(calls[0].body).toBeUndefined();
    expect(json(output)[0].status).toBe('resolved');
  });

  it('toggleTyping and updateLastSeen (head :ok) emit a meaningful item', async () => {
    const typing = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'toggleTyping',
        contactIdentifier: 'abc',
        conversationId: 3,
        typingStatus: 'off',
      },
      responses: [{ method: 'POST', url: `${conversations}/3/toggle_typing` }],
    });
    expect(typing.calls[0].body).toEqual({ typing_status: 'off' });
    expect(json(typing.output)).toEqual([
      { success: true, conversationId: 3, typingStatus: 'off' },
    ]);

    const seen = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'updateLastSeen',
        contactIdentifier: 'abc',
        conversationId: 3,
      },
      responses: [{ method: 'POST', url: `${conversations}/3/update_last_seen` }],
    });
    expect(seen.calls[0].body).toBeUndefined();
    expect(json(seen.output)).toEqual([{ success: true, conversationId: 3 }]);
  });

  it('getCsatSurvey reads /public/api/v1/csat_survey/:uuid', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'getCsatSurvey',
        conversationUuid: '98c5d7f3-8873-4262-b101-d56425ff7ee1',
      },
      responses: [
        {
          method: 'GET',
          url: `${PUBLIC}/csat_survey/98c5d7f3-8873-4262-b101-d56425ff7ee1`,
          body: csatSurvey(),
        },
      ],
    });
    expect(calls[0].api).toBe('public');
    expect(json(output)).toEqual([csatSurvey()]);
  });

  it('submitCsatSurvey PUTs the same payload as the Chatwoot survey page', async () => {
    const answered = csatSurvey({
      csat_survey_response: { id: 9, rating: 4, feedback_message: 'Rápido', conversation_id: 3 },
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicConversation',
        operation: 'submitCsatSurvey',
        conversationUuid: '98c5d7f3-8873-4262-b101-d56425ff7ee1',
        rating: 4,
        feedbackMessage: 'Rápido',
      },
      responses: [
        {
          method: 'PUT',
          url: `${PUBLIC}/csat_survey/98c5d7f3-8873-4262-b101-d56425ff7ee1`,
          body: answered,
        },
      ],
    });
    expect(calls[0].body).toEqual({
      message: {
        submitted_values: { csat_survey_response: { rating: 4, feedback_message: 'Rápido' } },
      },
    });
    expect(json(output)).toEqual([answered]);
  });

  it('rejects an empty Contact Identifier instead of calling another route', async () => {
    const { error, calls } = await runExpectingError({
      params: {
        resource: 'publicConversation',
        operation: 'getAll',
        contactIdentifier: '  ',
      },
    });
    expect(error).toBeInstanceOf(NodeOperationError);
    expect(error.message).toContain('Contact Identifier must not be empty');
    expect(error.context.itemIndex).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('accepts a numeric source_id from an expression and encodes special characters', async () => {
    const { calls } = await runChatwootNode({
      params: { resource: 'publicConversation', operation: 'getAll', contactIdentifier: 'abc' },
      itemParams: [{ contactIdentifier: 5215512345678 }],
      responses: [
        { method: 'GET', url: `${INBOX}/contacts/5215512345678/conversations`, body: [] },
      ],
    });
    expect(calls[0].url).toBe(`${INBOX}/contacts/5215512345678/conversations`);

    const encoded = await runChatwootNode({
      params: {
        resource: 'publicMessage',
        operation: 'getAll',
        contactIdentifier: '5215512345678@s.whatsapp.net',
        conversationId: 3,
      },
      responses: [
        {
          method: 'GET',
          url: `${INBOX}/contacts/5215512345678%40s.whatsapp.net/conversations/3/messages`,
          body: [],
        },
      ],
    });
    expect(encoded.calls[0].url).toBe(
      `${INBOX}/contacts/5215512345678%40s.whatsapp.net/conversations/3/messages`,
    );
    expect(encoded.output[0]).toEqual([]);
  });

  it('submitCsatSurvey surfaces the 14-day lock (422)', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'publicConversation',
        operation: 'submitCsatSurvey',
        conversationUuid: 'u-1',
        rating: 5,
      },
      responses: [
        {
          method: 'PUT',
          url: `${PUBLIC}/csat_survey/u-1`,
          status: 422,
          body: { error: 'You cannot update the CSAT survey after 14 days' },
        },
      ],
    });
    expect(json(output)[0].error).toBe(
      'Chatwoot Public API error 422 Unprocessable Entity: You cannot update the CSAT survey after 14 days',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Public API: messages
// ---------------------------------------------------------------------------------------------

describe('publicMessage', () => {
  const messages = `${INBOX}/contacts/abc/conversations/3/messages`;

  it('create (JSON) sends content and echo_id', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicMessage',
        operation: 'create',
        contactIdentifier: 'abc',
        conversationId: 3,
        content: 'Hola',
        additionalFields: { echo_id: 'e-1' },
      },
      responses: [{ method: 'POST', url: messages, body: publicMessage(10, { content: 'Hola' }) }],
    });
    expect(calls[0].body).toEqual({ content: 'Hola', echo_id: 'e-1' });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(json(output)).toEqual([publicMessage(10, { content: 'Hola' })]);
  });

  it('create with attachments sends multipart attachments[] (one per binary property)', async () => {
    const pdf = Buffer.from('%PDF-1.4');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const item: INodeExecutionData = {
      json: {},
      binary: {
        data: {
          data: pdf.toString('base64'),
          mimeType: 'application/pdf',
          fileName: 'order.pdf',
          fileExtension: 'pdf',
        },
        image: {
          data: png.toString('base64'),
          mimeType: 'image/png',
          fileName: 'photo.png',
          fileExtension: 'png',
        },
      },
    };
    const attachmentMessage = publicMessage(11, {
      content: 'Adjunto',
      // Attachment#push_event_data: base_data + file_metadata
      attachments: [
        {
          id: 1,
          message_id: 11,
          file_type: 'file',
          account_id: 1,
          extension: 'pdf',
          content_type: 'application/pdf',
          data_url: 'https://chatwoot.test/rails/active_storage/blobs/redirect/order.pdf',
          thumb_url: '',
          file_size: pdf.length,
          width: null,
          height: null,
        },
      ],
    });
    const { output, calls } = await runChatwootNode({
      items: [item],
      params: {
        resource: 'publicMessage',
        operation: 'create',
        contactIdentifier: 'abc',
        conversationId: 3,
        content: 'Adjunto',
        additionalFields: { binaryPropertyName: 'data, image', echo_id: 'e-2' },
      },
      responses: [{ method: 'POST', url: messages, body: attachmentMessage }],
    });
    const call: RecordedCall = calls[0];
    expect(call.api).toBe('public');
    expect(call.body).toBeInstanceOf(FormData);
    expect(call.headers['Content-Type']).toBeUndefined();
    expect(call.headers.api_access_token).toBeUndefined();
    expect(call.formData).toEqual([
      { name: 'content', kind: 'field', value: 'Adjunto' },
      { name: 'echo_id', kind: 'field', value: 'e-2' },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'order.pdf',
        mimeType: 'application/pdf',
        size: pdf.length,
        content: pdf,
      },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'photo.png',
        mimeType: 'image/png',
        size: png.length,
        content: png,
      },
    ]);
    expect(json(output)).toEqual([attachmentMessage]);
  });

  it('create without content or attachments fails before calling Chatwoot', async () => {
    const { error, calls } = await runExpectingError({
      params: {
        resource: 'publicMessage',
        operation: 'create',
        contactIdentifier: 'abc',
        conversationId: 3,
      },
    });
    expect(error.message).toBe('Content is required unless attachments are sent');
    expect(calls).toHaveLength(0);
  });

  it('getAll defaults to the 20 most recent messages in one request (same as before 0.9.0)', async () => {
    const page = Array.from({ length: 20 }, (_, k) => publicMessage(31 + k));
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicMessage',
        operation: 'getAll',
        contactIdentifier: 'abc',
        conversationId: 3,
      },
      responses: [{ method: 'GET', url: messages, body: page }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].qs).toBeUndefined();
    expect(json(output).map((message) => message.id)).toEqual(page.map((message) => message.id));
  });

  it('getAll with Return All walks back with `before` (root-array pages of 20)', async () => {
    const all = Array.from({ length: 45 }, (_, k) => publicMessage(k + 1));
    const reply = (call: RecordedCall) => {
      const before = call.qs?.before === undefined ? Infinity : Number(call.qs.before);
      return { body: all.filter((message) => (message.id as number) < before).slice(-20) };
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicMessage',
        operation: 'getAll',
        contactIdentifier: 'abc',
        conversationId: 3,
        returnAll: true,
      },
      responses: [{ method: 'GET', url: messages, times: Infinity, reply }],
    });
    expect(calls.map((call) => call.qs?.before)).toEqual([undefined, 26, 6]);
    expect(json(output).map((message) => message.id)).toEqual(all.map((message) => message.id));
  });

  it('getAll honors the Before Message ID option and the limit', async () => {
    const all = Array.from({ length: 45 }, (_, k) => publicMessage(k + 1));
    const reply = (call: RecordedCall) => {
      const before = call.qs?.before === undefined ? Infinity : Number(call.qs.before);
      return { body: all.filter((message) => (message.id as number) < before).slice(-20) };
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'publicMessage',
        operation: 'getAll',
        contactIdentifier: 'abc',
        conversationId: 3,
        limit: 25,
        options: { before: 41 },
      },
      responses: [{ method: 'GET', url: messages, times: Infinity, reply }],
    });
    expect(calls.map((call) => call.qs?.before)).toEqual([41, 21]);
    expect(json(output).map((message) => message.id)).toEqual(
      Array.from({ length: 25 }, (_, k) => k + 16),
    );
  });

  describe('update (submitted_values)', () => {
    const answered = (submitted: unknown) =>
      publicMessage(20, {
        content_type: 'input_select',
        content_attributes: { items: [{ title: 'Sí', value: 'yes' }], submitted_values: submitted },
      });

    it('legacy workflows: Content becomes the selected option (Chatwoot ignores `content`)', async () => {
      const submitted = [{ title: 'Sí', value: 'Sí' }];
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          content: 'Sí',
        },
        responses: [{ method: 'PATCH', url: `${messages}/20`, body: answered(submitted) }],
      });
      expect(calls[0].body).toEqual({ submitted_values: submitted });
      expect(calls[0].body).not.toHaveProperty('content');
      expect(json(output)).toEqual([answered(submitted)]);
    });

    it('selected option with an explicit value', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          responseType: 'option',
          content: 'Sí',
          optionValue: 'yes',
        },
        responses: [
          {
            method: 'PATCH',
            url: `${messages}/20`,
            body: answered([{ title: 'Sí', value: 'yes' }]),
          },
        ],
      });
      expect(calls[0].body).toEqual({ submitted_values: [{ title: 'Sí', value: 'yes' }] });
    });

    it('CSAT rating', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          responseType: 'csat',
          csatRating: 4,
          csatFeedbackMessage: 'Bien',
        },
        responses: [
          {
            method: 'PATCH',
            url: `${messages}/20`,
            body: publicMessage(20, { content_type: 'input_csat' }),
          },
        ],
      });
      expect(calls[0].body).toEqual({
        submitted_values: { csat_survey_response: { rating: 4, feedback_message: 'Bien' } },
      });
    });

    it('form values', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          responseType: 'form',
          formValues: {
            values: [
              { name: 'email', value: 'luis@example.com' },
              { name: 'phone', value: '555' },
            ],
          },
        },
        responses: [
          {
            method: 'PATCH',
            url: `${messages}/20`,
            body: publicMessage(20, { content_type: 'form' }),
          },
        ],
      });
      expect(calls[0].body).toEqual({
        submitted_values: [
          { name: 'email', value: 'luis@example.com' },
          { name: 'phone', value: '555' },
        ],
      });
    });

    it('raw JSON, validated before the request', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          responseType: 'json',
          submittedValues: '[{"title":"No","value":"no"}]',
        },
        responses: [
          {
            method: 'PATCH',
            url: `${messages}/20`,
            body: answered([{ title: 'No', value: 'no' }]),
          },
        ],
      });
      expect(calls[0].body).toEqual({ submitted_values: [{ title: 'No', value: 'no' }] });

      const invalid = await runExpectingError({
        params: {
          resource: 'publicMessage',
          operation: 'update',
          contactIdentifier: 'abc',
          conversationId: 3,
          messageId: 20,
          responseType: 'json',
          submittedValues: '"yes"',
        },
      });
      expect(invalid.error.message).toBe('Submitted Values must be a JSON object or array');
      expect(invalid.calls).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------------------------
// Public API: inbox
// ---------------------------------------------------------------------------------------------

describe('publicInbox', () => {
  it('get reads the API inbox of the credential', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'publicInbox', operation: 'get' },
      responses: [{ method: 'GET', url: INBOX, body: publicInbox }],
    });
    expect(calls[0].url).toBe(INBOX);
    expect(calls[0].headers.api_access_token).toBeUndefined();
    expect(json(output)).toEqual([publicInbox]);
  });

  it('encodes the inbox identifier and reports a non-API inbox (404)', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      credentials: { chatwootPublicApi: { baseUrl: BASE, inboxIdentifier: 'bad id' } },
      params: { resource: 'publicInbox', operation: 'get' },
      responses: [{ method: 'GET', url: `${PUBLIC}/inboxes/bad%20id`, status: 404 }],
    });
    expect(calls[0].url).toBe(`${PUBLIC}/inboxes/bad%20id`);
    expect(json(output)[0]).toMatchObject({ httpCode: '404' });
    expect(json(output)[0].description).toContain('API channel');
  });
});

// ---------------------------------------------------------------------------------------------
// Route conformance: every request of every owned operation must hit a route that exists in
// config/routes.rb (identical platform/public namespaces in Chatwoot 4.13.0 and 4.18.0)
// ---------------------------------------------------------------------------------------------

describe('route conformance with config/routes.rb', () => {
  const id = '[^/]+';
  const routes: Array<[string, RegExp]> = [
    // namespace :platform: users (+ member login/token), agent_bots (+ member avatar), accounts (+ account_users)
    ['POST', /^\/platform\/api\/v1\/users$/],
    ['GET|PATCH|PUT|DELETE', new RegExp(`^/platform/api/v1/users/${id}$`)],
    ['GET', new RegExp(`^/platform/api/v1/users/${id}/login$`)],
    ['POST', new RegExp(`^/platform/api/v1/users/${id}/token$`)],
    ['GET|POST', /^\/platform\/api\/v1\/agent_bots$/],
    ['GET|PATCH|PUT|DELETE', new RegExp(`^/platform/api/v1/agent_bots/${id}$`)],
    ['DELETE', new RegExp(`^/platform/api/v1/agent_bots/${id}/avatar$`)],
    ['GET|POST', /^\/platform\/api\/v1\/accounts$/],
    ['GET|PATCH|PUT|DELETE', new RegExp(`^/platform/api/v1/accounts/${id}$`)],
    ['GET|POST|DELETE', new RegExp(`^/platform/api/v1/accounts/${id}/account_users$`)],
    // namespace :public: inboxes#show, contacts, conversations (+ members), messages, csat_survey
    ['GET', new RegExp(`^/public/api/v1/inboxes/${id}$`)],
    ['POST', new RegExp(`^/public/api/v1/inboxes/${id}/contacts$`)],
    ['GET|PATCH|PUT', new RegExp(`^/public/api/v1/inboxes/${id}/contacts/${id}$`)],
    ['GET|POST', new RegExp(`^/public/api/v1/inboxes/${id}/contacts/${id}/conversations$`)],
    ['GET', new RegExp(`^/public/api/v1/inboxes/${id}/contacts/${id}/conversations/${id}$`)],
    [
      'POST',
      new RegExp(
        `^/public/api/v1/inboxes/${id}/contacts/${id}/conversations/${id}/(toggle_status|toggle_typing|update_last_seen)$`,
      ),
    ],
    [
      'GET|POST',
      new RegExp(`^/public/api/v1/inboxes/${id}/contacts/${id}/conversations/${id}/messages$`),
    ],
    [
      'PATCH|PUT',
      new RegExp(
        `^/public/api/v1/inboxes/${id}/contacts/${id}/conversations/${id}/messages/${id}$`,
      ),
    ],
    ['GET|PATCH|PUT', new RegExp(`^/public/api/v1/csat_survey/${id}$`)],
  ];

  // One parameter set per operation of every owned resource (with the optional ownership checks on)
  const cases: Array<Record<string, unknown>> = [
    {
      resource: 'platformAccount',
      operation: 'create',
      name: 'Acme',
      additionalFields: { features: { crm: true } },
    },
    { resource: 'platformAccount', operation: 'delete', accountId: 12 },
    { resource: 'platformAccount', operation: 'get', accountId: 12 },
    { resource: 'platformAccount', operation: 'getAll' },
    {
      resource: 'platformAccount',
      operation: 'update',
      accountId: 12,
      updateFields: { name: 'B' },
    },
    { resource: 'platformUser', operation: 'create', email: 'a@b.test', name: 'A' },
    { resource: 'platformUser', operation: 'delete', userId: 5 },
    { resource: 'platformUser', operation: 'get', userId: 5 },
    { resource: 'platformUser', operation: 'getSsoUrl', userId: 5 },
    { resource: 'platformUser', operation: 'getToken', userId: 5 },
    { resource: 'platformUser', operation: 'update', userId: 5, updateFields: { name: 'B' } },
    { resource: 'accountUser', operation: 'create', accountId: 12, userId: 5, role: 'agent' },
    { resource: 'accountUser', operation: 'delete', accountId: 12, userId: 5 },
    { resource: 'accountUser', operation: 'getAll', accountId: 12 },
    { resource: 'accountAgentBot', operation: 'create', accountId: 12, name: 'Bot' },
    { resource: 'accountAgentBot', operation: 'delete', agentBotId: 7, accountId: 12 },
    { resource: 'accountAgentBot', operation: 'deleteAvatar', agentBotId: 7 },
    { resource: 'accountAgentBot', operation: 'get', agentBotId: 7, accountId: 12 },
    { resource: 'accountAgentBot', operation: 'getAll', accountId: 12 },
    {
      resource: 'accountAgentBot',
      operation: 'update',
      agentBotId: 7,
      accountId: 12,
      updateFields: { name: 'B' },
    },
    { resource: 'publicContact', operation: 'create', additionalFields: { name: 'Luis' } },
    { resource: 'publicContact', operation: 'get', contactIdentifier: 'abc' },
    {
      resource: 'publicContact',
      operation: 'update',
      contactIdentifier: 'abc',
      updateFields: { name: 'L' },
    },
    { resource: 'publicConversation', operation: 'create', contactIdentifier: 'abc' },
    {
      resource: 'publicConversation',
      operation: 'get',
      contactIdentifier: 'abc',
      conversationId: 3,
    },
    { resource: 'publicConversation', operation: 'getCsatSurvey', conversationUuid: 'u-1' },
    { resource: 'publicConversation', operation: 'getAll', contactIdentifier: 'abc' },
    {
      resource: 'publicConversation',
      operation: 'resolve',
      contactIdentifier: 'abc',
      conversationId: 3,
    },
    {
      resource: 'publicConversation',
      operation: 'submitCsatSurvey',
      conversationUuid: 'u-1',
      rating: 5,
    },
    {
      resource: 'publicConversation',
      operation: 'toggleTyping',
      contactIdentifier: 'abc',
      conversationId: 3,
    },
    {
      resource: 'publicConversation',
      operation: 'updateLastSeen',
      contactIdentifier: 'abc',
      conversationId: 3,
    },
    {
      resource: 'publicMessage',
      operation: 'create',
      contactIdentifier: 'abc',
      conversationId: 3,
      content: 'Hi',
    },
    { resource: 'publicMessage', operation: 'getAll', contactIdentifier: 'abc', conversationId: 3 },
    {
      resource: 'publicMessage',
      operation: 'update',
      contactIdentifier: 'abc',
      conversationId: 3,
      messageId: 20,
      content: 'Sí',
    },
    { resource: 'publicInbox', operation: 'get' },
  ];

  it('covers every operation of the owned resources', () => {
    const description = new Chatwoot().description;
    const owned = new Set(cases.map((params) => params.resource as string));
    const expected = description.properties
      .filter((property) => property.name === 'operation')
      .flatMap((property) => {
        const resource = (property.displayOptions?.show?.resource as string[])[0];
        if (!owned.has(resource)) return [];
        return (property.options as INodePropertyOptions[]).map(
          (option) => `${resource}.${option.value}`,
        );
      });
    expect(cases.map((params) => `${params.resource}.${params.operation}`).sort()).toEqual(
      expected.sort(),
    );
  });

  it.each(cases)('$resource > $operation only calls routed endpoints', async (params) => {
    // Lists answer an array, everything else a record owned by account 12
    const reply = (call: RecordedCall) => {
      const isList =
        call.method === 'GET' &&
        /\/(agent_bots|accounts|account_users|conversations|messages)$/.test(call.path);
      return { body: isList ? [] : { id: 12, account_id: 12 } };
    };
    const { calls } = await runChatwootNode({
      params,
      responses: [{ url: /.*/, times: Infinity, reply }],
    });
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const matched = routes.some(
        ([methods, pattern]) => methods.split('|').includes(call.method) && pattern.test(call.path),
      );
      expect(`${call.method} ${call.path} ${matched ? 'is routed' : 'has NO route'}`).toBe(
        `${call.method} ${call.path} is routed`,
      );
    }
  });
});
