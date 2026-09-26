import type { INodeProperties } from 'n8n-workflow';

import { SAFE_FETCH_WARNING } from '../inbox/channelSettings';
import { WEBHOOK_EVENT_OPTIONS } from './events';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Webhook ID',
    name: 'webhookId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['update'],
      },
    },
    description: 'ID of the webhook to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Inbox Name or ID',
        name: 'inbox_id',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getInboxes',
        },
        default: '',
        description:
          'Inbox associated with the webhook (informational: Chatwoot 4.18 still sends events of every inbox). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name that identifies the webhook in Chatwoot',
      },
      {
        displayName: 'Subscriptions',
        name: 'subscriptions',
        type: 'multiOptions',
        options: WEBHOOK_EVENT_OPTIONS,
        default: [],
        description: 'Events that will trigger this webhook (replaces the current list)',
      },
      {
        displayName: 'Webhook URL',
        name: 'url',
        type: 'string',
        default: '',
        description: `URL where Chatwoot POSTs the events. ${SAFE_FETCH_WARNING}`,
      },
    ],
  },
];
