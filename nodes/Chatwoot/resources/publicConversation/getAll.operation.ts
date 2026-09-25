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
        resource: ['publicConversation'],
        operation: ['getAll'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Public Contact > Create)',
  },
];
