import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  Icon,
  INodeProperties,
} from 'n8n-workflow';

export class ChatwootPlatformApi implements ICredentialType {
  name = 'chatwootPlatformApi';
  displayName = 'Chatwoot Platform API';
  icon: Icon = { light: 'file:../nodes/Chatwoot/chatwoot.svg', dark: 'file:../nodes/Chatwoot/chatwoot.svg' };
  documentationUrl = 'https://www.chatwoot.com/developers/api/#tag/Platform';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://app.chatwoot.com',
      placeholder: 'https://app.chatwoot.com',
      description:
        'The base URL of your Chatwoot instance. Use https://app.chatwoot.com for Chatwoot Cloud, or your self-hosted instance URL.',
      required: true,
    },
    {
      displayName: 'Platform API Access Token',
      name: 'apiAccessToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description:
        'Access token of a Platform App. Create the app in the Super Admin console (/super_admin → Platform Apps; self-hosted installations only) and copy its access token. A Platform App can only manage the accounts, users and agent bots it created itself (other IDs answer 401 "Non permissible resource").',
      required: true,
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

  // GET /platform/api/v1/agent_bots only lists the bots of this Platform App: no side effects, and it
  // answers 401 "Invalid access_token" for anything that is not a Platform App token.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '/platform/api/v1/agent_bots',
      method: 'GET',
    },
  };
}
