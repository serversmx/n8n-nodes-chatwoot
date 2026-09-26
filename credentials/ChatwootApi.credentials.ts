import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  Icon,
  INodeProperties,
} from 'n8n-workflow';

export class ChatwootApi implements ICredentialType {
  name = 'chatwootApi';
  displayName = 'Chatwoot API';
  icon: Icon = { light: 'file:../nodes/Chatwoot/chatwoot.svg', dark: 'file:../nodes/Chatwoot/chatwoot.svg' };
  documentationUrl = 'https://www.chatwoot.com/developers/api/';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://app.chatwoot.com',
      placeholder: 'https://app.chatwoot.com',
      description:
        'The base URL of your Chatwoot instance. Use https://app.chatwoot.com for Chatwoot Cloud, or your self-hosted instance URL (e.g., https://chatwoot.yourdomain.com)',
      required: true,
    },
    {
      displayName: 'Account ID',
      name: 'accountId',
      type: 'number',
      default: 1,
      description:
        'Your Chatwoot Account ID. You can find this in Chatwoot under Settings → Account Settings, or in the URL when logged in (e.g., /app/accounts/1/...)',
      required: true,
      typeOptions: {
        minValue: 1,
      },
    },
    {
      displayName: 'API Access Token',
      name: 'apiAccessToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description:
        'User token: Chatwoot → Profile Settings → Access Token. Agent bot token: Settings → Bots → the bot access token (visible to administrators), or the access_token returned by the Platform API.',
      required: true,
    },
    // An `options` dropdown ('agentBot' | 'user'), not a secret; the rule's name-based heuristic matches
    // "token" in the field name. `typeOptions.password` has no effect on a select field.
    // eslint-disable-next-line
    {
      displayName: 'Token Type',
      name: 'tokenType',
      type: 'options',
      options: [
        {
          name: 'Agent Bot Access Token',
          value: 'agentBot',
          description:
            'Token of an agent bot: Chatwoot lets bots call only a few conversation endpoints',
        },
        {
          name: 'User Access Token',
          value: 'user',
          description:
            'Token of an agent or administrator: every operation the user is allowed to perform',
        },
      ],
      default: 'user',
      description:
        'Kind of access token. It only changes how the connection is tested: requests are sent the same way.',
    },
    {
      displayName:
        'Agent bot tokens only work with: Conversation > Create, Update, Update Status, Toggle Priority, Toggle Typing, Update Custom Attributes and Assign; Conversation > Get, List Labels and Add Labels (Chatwoot 4.17+); Message > Create. Any other operation answers 401 "Access to this endpoint is not authorized for bots". The bot must belong to this account or be connected to one of its inboxes.',
      name: 'agentBotNotice',
      type: 'notice',
      default: '',
      displayOptions: {
        show: {
          tokenType: ['agentBot'],
        },
      },
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        api_access_token: '={{$credentials.apiAccessToken}}',
      },
    },
  };

  // User tokens: GET /conversations (any account member may list conversations; non-2xx fails the test).
  // Agent bot tokens cannot call any list endpoint (AccessTokenAuthHelper::BOT_ACCESSIBLE_ENDPOINTS), so
  // they read conversation 0, which never exists: once the token, the bot allow-list and the account
  // membership pass, Chatwoot answers 404 "Resource could not be found". HTTP errors are therefore not
  // fatal for bots, and the rules below turn Chatwoot's authorization errors back into failures.
  // Limitation: an Account ID that does not exist also answers 404 and passes the bot test.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '=/api/v1/accounts/{{$credentials.accountId}}/conversations{{$credentials.tokenType === "agentBot" ? "/0" : ""}}',
      method: 'GET',
      qs: {
        page: 1,
      },
      // Resolved by n8n for every test run: true only for agent bot tokens
      ignoreHttpStatusErrors: '={{$credentials.tokenType === "agentBot"}}' as unknown as boolean,
    },
    rules: [
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'Invalid Access Token',
          message: 'Invalid access token: Chatwoot does not know this token',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'Bot is not authorized to access this account',
          message:
            'The agent bot does not belong to this account and is not connected to any of its inboxes: check the Account ID',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'Access to this endpoint is not authorized for bots',
          message:
            'The agent bot token is valid, but this Chatwoot version does not let bots read conversations (4.17 and later do), so the connection cannot be tested. The credential still works for the operations bots may use (e.g. Message > Create).',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'You are not authorized to access this account',
          message: 'This token cannot access the account: check the Account ID',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'Account is suspended',
          message: 'The Chatwoot account is suspended',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'API access is not enabled for this account',
          message: 'API access is not enabled for this account (Chatwoot Cloud plan setting)',
        },
      },
    ],
  };
}
