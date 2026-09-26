import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Agent Bot ID',
    name: 'agentBotId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['update'],
      },
    },
    description: 'ID of the agent bot to update',
  },
  {
    // Kept as 'accountId' for saved workflows: the Platform API does not need it, so it now works as a safety check
    displayName: 'Expected Account ID',
    name: 'accountId',
    type: 'number',
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['update'],
      },
    },
    description:
      'Optional safety check: when set, the node first reads the bot and does not update it unless it belongs to this account. Use 0 to skip the check. To move the bot to another account, use the Account ID update field.',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Account ID',
        name: 'account_id',
        type: 'number',
        default: 0,
        description:
          'Move the bot to this account (sent as account_id). Use 0 to turn it into a global bot without an account.',
      },
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
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the agent bot',
      },
      {
        displayName: 'Outgoing URL',
        name: 'outgoing_url',
        type: 'string',
        default: '',
        description: 'Webhook URL that receives the events of the inboxes connected to this bot',
      },
    ],
  },
];
