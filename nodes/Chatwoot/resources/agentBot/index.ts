import type { INodeProperties } from 'n8n-workflow';

import { SAFE_FETCH_WARNING } from '../inbox/channelSettings';

const OUTGOING_URL_DESCRIPTION = `Webhook URL where Chatwoot POSTs the events of the conversations handled by the bot (on Update, empty removes it). Since Chatwoot 4.13 each delivery is signed with the bot secret (X-Chatwoot-Signature). ${SAFE_FETCH_WARNING}`;

const botFieldOptions = (nameOption: boolean): INodeProperties[] => [
  {
    displayName: 'Avatar URL',
    name: 'avatar_url',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/bot.png',
    description:
      'Public image URL; Chatwoot downloads it in the background and sets it as the bot avatar',
  },
  {
    displayName: 'Bot Config (JSON)',
    name: 'bot_config',
    type: 'json',
    default: '{}',
    description:
      'Free-form JSON object stored with the bot (bot_config). Replaces the stored object.',
  },
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    default: '',
    description: 'Description of the agent bot (on Update, empty clears it)',
  },
  ...(nameOption
    ? [
        {
          displayName: 'Name',
          name: 'name',
          type: 'string',
          default: '',
          description: 'Name of the agent bot',
        } as INodeProperties,
      ]
    : []),
  {
    displayName: 'Outgoing URL',
    name: 'outgoing_url',
    type: 'string',
    default: '',
    description: OUTGOING_URL_DESCRIPTION,
  },
];

export const agentBotOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['agentBot'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a new agent bot. Administrators get its access_token and secret in the output.',
      action: 'Create an agent bot',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete an agent bot',
      action: 'Delete an agent bot',
    },
    {
      name: 'Delete Avatar',
      value: 'deleteAvatar',
      description: 'Remove the avatar image of an agent bot',
      action: 'Delete an agent bot avatar',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get an agent bot by ID',
      action: 'Get an agent bot',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get all agent bots available to the account (including global system bots)',
      action: 'Get all agent bots',
    },
    {
      name: 'Reset Access Token',
      value: 'resetAccessToken',
      description:
        'Generate a new API access token for an agent bot (the old one stops working) and return the bot with it. Administrator token required.',
      action: 'Reset an agent bot access token',
    },
    {
      name: 'Reset Secret',
      value: 'resetSecret',
      description:
        'Generate a new secret for signing the webhook deliveries of an agent bot (X-Chatwoot-Signature) and return the bot with it. Administrator token required.',
      action: 'Reset an agent bot secret',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update an agent bot',
      action: 'Update an agent bot',
    },
  ],
  default: 'getAll',
};

export const agentBotFields: INodeProperties[] = [
  // Get / Update / Delete / Delete Avatar / Reset Access Token / Reset Secret
  {
    displayName: 'Agent Bot ID',
    name: 'agentBotId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['agentBot'],
        operation: ['get', 'update', 'delete', 'deleteAvatar', 'resetAccessToken', 'resetSecret'],
      },
    },
    description: 'ID of the agent bot',
  },
  // Create
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['agentBot'],
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
        resource: ['agentBot'],
        operation: ['create'],
      },
    },
    options: botFieldOptions(false),
  },
  // Update
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['agentBot'],
        operation: ['update'],
      },
    },
    options: botFieldOptions(true),
  },
];
