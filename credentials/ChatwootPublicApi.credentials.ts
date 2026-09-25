import type { ICredentialTestRequest, ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

export class ChatwootPublicApi implements ICredentialType {
  name = 'chatwootPublicApi';
  displayName = 'Chatwoot Public API';
  icon: Icon = 'file:../nodes/Chatwoot/chatwoot.svg';
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
        'The unique identifier for your Web Widget inbox (a UUID string, not the numeric ID). Go to Settings → Inboxes → your Web Widget inbox → Configuration tab to find it. Note: only Web Widget (Channel::WebWidget) inboxes support the Public API; Telegram, Email, etc. do not.',
      required: true,
    },
  ];

  // Public API uses the inbox identifier in the URL path, not auth headers.
  // The test creates a minimal contact to validate that the inbox exists and is a Web Widget.
  // If the inbox identifier is invalid or not a Web Widget, Chatwoot returns 404.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
      url: '=/public/api/v1/inboxes/{{$credentials.inboxIdentifier}}/contacts',
      method: 'POST',
      body: {
        identifier: 'n8n-credential-test',
        name: 'n8n Credential Test',
      },
    },
  };
}
