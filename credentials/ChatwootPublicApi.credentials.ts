import type { ICredentialTestRequest, ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

export class ChatwootPublicApi implements ICredentialType {
  name = 'chatwootPublicApi';
  displayName = 'Chatwoot Public API';
  icon: Icon = { light: 'file:../nodes/Chatwoot/chatwoot.svg', dark: 'file:../nodes/Chatwoot/chatwoot.svg' };
  documentationUrl = 'https://www.chatwoot.com/developers/api/#tag/Contacts-API';
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
      displayName: 'Inbox Identifier',
      name: 'inboxIdentifier',
      type: 'string',
      default: '',
      description:
        'The Inbox Identifier of an API channel inbox (a random token, not the numeric inbox ID). Find it in Chatwoot → Settings → Inboxes → your API inbox → Configuration. The Public API only works with API channel inboxes, such as the ones Evolution API creates; Website (web widget), Email, Telegram and other inbox types answer 404.',
      required: true,
    },
    {
      displayName: 'HMAC Token',
      name: 'hmacToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description:
        'Optional. The identity validation secret key of the same inbox (Configuration → Identity Validation, "User Identity Validation" in older versions). When set, Public Contact operations compute identifier_hash for contacts sent with an Identifier, which inboxes that enforce identity validation require. Update it here after rotating the key (Chatwoot 4.18+).',
    },
  ];

  // The Public API has no auth header: the inbox identifier in the URL is the credential.
  // GET /public/api/v1/inboxes/{identifier} only reads the inbox settings: it creates nothing, works when
  // identity validation (HMAC) is enforced, and answers 404 for anything that is not an API channel inbox.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '=/public/api/v1/inboxes/{{$credentials.inboxIdentifier}}',
      method: 'GET',
    },
  };
}
