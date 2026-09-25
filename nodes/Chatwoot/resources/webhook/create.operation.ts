import type { INodeProperties } from 'n8n-workflow';

import { SAFE_FETCH_WARNING } from '../inbox/channelSettings';
import { WEBHOOK_EVENT_OPTIONS } from './events';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Webhook URL',
    name: 'url',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'https://your-server.com/webhook',
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['create'],
      },
    },
    description: `URL where Chatwoot POSTs the events (must be unique per account). ${SAFE_FETCH_WARNING}`,
  },
  {
    displayName: 'Subscriptions',
    name: 'subscriptions',
    type: 'multiOptions',
    required: true,
    options: WEBHOOK_EVENT_OPTIONS,
    default: ['message_created'],
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['create'],
      },
    },
    description: 'Events that will trigger this webhook',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['create'],
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
          'Inbox associated with the webhook. Chatwoot 4.18 stores and returns it but still sends events of every inbox, so filter by inbox in your workflow. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        placeholder: 'n8n: order updates',
        description: 'Name that identifies the webhook in Chatwoot',
      },
    ],
  },
];
