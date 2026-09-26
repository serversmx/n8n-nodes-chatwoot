import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Account ID',
    name: 'accountId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['create'],
      },
    },
    description:
      'Account the bot belongs to (sent as account_id). Use 0 to create a global bot without an account: Chatwoot offers global bots to every account of the installation.',
  },
  {
    displayName: 'Bot Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['create'],
      },
    },
    description: 'Name of the agent bot',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Avatar URL',
        name: 'avatar_url',
        type: 'string',
        default: '',
        description:
          'Public URL of an image to use as the bot avatar. Chatwoot downloads it in the background, so it is not part of the response.',
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        description: 'Description of the agent bot',
      },
      {
        displayName: 'Outgoing URL',
        name: 'outgoing_url',
        type: 'string',
        default: '',
        description:
          'Webhook URL that receives the events of the inboxes connected to this bot (e.g. an n8n Webhook node URL)',
      },
    ],
  },
];
