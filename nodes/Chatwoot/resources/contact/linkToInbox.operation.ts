import type { INodeProperties } from 'n8n-workflow';

export const linkToInboxOperation: INodeProperties[] = [
  {
    displayName: 'Contact ID',
    name: 'contactId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['linkToInbox'],
      },
    },
    description: 'ID of the existing contact to link to the inbox',
  },
  {
    displayName: 'Inbox Name or ID',
    name: 'inboxId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getInboxes',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['linkToInbox'],
      },
    },
    description:
      'Inbox to link the contact to. The user who owns the API token must have access to it (agents: be a member of the inbox). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['linkToInbox'],
      },
    },
    options: [
      {
        displayName: 'HMAC Verified',
        name: 'hmac_verified',
        type: 'boolean',
        default: false,
        description:
          'Whether to mark the contact inbox as identity-verified (HMAC), for inboxes that enforce identity validation',
      },
      {
        displayName: 'Source ID',
        name: 'source_id',
        type: 'string',
        default: '',
        description:
          'ID of the contact in this channel (e.g. your own user ID for API inboxes, or the WhatsApp number without "+"). When empty, Chatwoot generates one for API and website inboxes, uses the email for email inboxes and the phone number for SMS and WhatsApp inboxes (the contact needs one); other channels require it. Linking again with the same Source ID returns the existing link.',
      },
    ],
  },
];
