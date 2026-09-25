import type { INodeProperties } from 'n8n-workflow';

export const createOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['create'],
      },
    },
    description: 'The source_id of the contact in this inbox (returned by Public Contact > Create)',
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Custom Attributes',
        name: 'custom_attributes',
        type: 'json',
        default: '{}',
        description: 'Custom attributes for the conversation',
      },
    ],
  },
];
