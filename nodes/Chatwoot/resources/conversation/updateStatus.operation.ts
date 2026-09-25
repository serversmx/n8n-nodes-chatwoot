import type { INodeProperties } from 'n8n-workflow';

export const updateStatusOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateStatus'],
      },
    },
    description: 'The ID of the conversation to update',
  },
  {
    displayName: 'Status',
    name: 'status',
    type: 'options',
    required: true,
    default: 'open',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateStatus'],
      },
    },
    options: [
      {
        name: 'Open',
        value: 'open',
        description: 'Mark conversation as active',
      },
      {
        name: 'Pending',
        value: 'pending',
        description: 'Mark conversation as pending response',
      },
      {
        name: 'Resolved',
        value: 'resolved',
        description: 'Mark conversation as completed',
      },
      {
        name: 'Snoozed',
        value: 'snoozed',
        description: 'Temporarily hide the conversation',
      },
    ],
    description: 'The new status for the conversation',
  },
  {
    displayName: 'Snooze Until',
    name: 'snoozed_until',
    type: 'dateTime',
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateStatus'],
        status: ['snoozed'],
      },
    },
    description:
      'When to reopen the snoozed conversation. Leave empty to keep it snoozed until the contact replies (a new incoming message always reopens it).',
  },
];
