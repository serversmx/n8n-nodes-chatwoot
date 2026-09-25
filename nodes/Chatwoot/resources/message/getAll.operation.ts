import type { INodeProperties } from 'n8n-workflow';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['getAll'],
      },
    },
    description: 'The ID of the conversation to get messages from',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['getAll'],
      },
    },
    description: 'Whether to return all messages or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: {
      minValue: 1,
      maxValue: 500,
    },
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    description: 'Max number of messages to return. The most recent messages are returned, oldest first.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'After Message ID',
        name: 'after',
        type: 'number',
        default: 0,
        description: 'Only return messages newer than this message ID (e.g. the last message already processed)',
      },
      {
        displayName: 'Before Message ID',
        name: 'before',
        type: 'number',
        default: 0,
        description: 'Only return messages older than this message ID',
      },
      {
        displayName: 'Exclude Private Notes and Activity',
        name: 'filter_internal_messages',
        type: 'boolean',
        default: false,
        description: 'Whether to leave out private notes and activity messages (status changes, assignments...), keeping only the messages exchanged with the contact',
      },
    ],
  },
];
