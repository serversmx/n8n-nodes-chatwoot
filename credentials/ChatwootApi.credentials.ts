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
  icon: Icon = 'file:../nodes/Chatwoot/chatwoot.svg';
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
        'Your API Access Token from Chatwoot. Go to Profile Settings → Access Token to generate or copy your token',
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
      url: '=/api/v1/accounts/{{$credentials.accountId}}/conversations',
      method: 'GET',
      qs: {
        page: 1,
      },
    },
  };
}
