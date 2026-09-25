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
  icon: Icon = 'file:../nodes/Chatwoot/chatwoot.svg';
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
        'Your Platform API Access Token. This is a super admin token with access to platform-level operations like creating accounts and users. Found in the installation config or super admin panel.',
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

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '/platform/api/v1/agent_bots',
      method: 'GET',
    },
  };
}
