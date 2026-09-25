import type { INodeProperties } from 'n8n-workflow';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['getAll'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Public Contact > Create)',
  },
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['getAll'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['getAll'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    typeOptions: {
      minValue: 1,
    },
    default: 20,
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    description:
      'Max number of results to return: the most recent messages, oldest first. Chatwoot returns 20 messages per request, so larger limits make several requests.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicMessage'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'Before Message ID',
        name: 'before',
        type: 'number',
        default: 0,
        description:
          'Only return messages older than this message ID (e.g. the smallest ID of a previous result, to page back through the history)',
      },
    ],
  },
];
