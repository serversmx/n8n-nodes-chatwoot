import type { INodeProperties } from 'n8n-workflow';

export const updateCustomAttributesOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateCustomAttributes'],
      },
    },
    description: 'ID of the conversation to update',
  },
  {
    displayName: 'Custom Attributes',
    name: 'customAttributes',
    type: 'json',
    required: true,
    default: '{}',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateCustomAttributes'],
      },
    },
    description:
      'Custom attributes as a JSON object (e.g., {"order_id": "12345", "priority_customer": true})',
  },
  {
    displayName: 'Merge With Existing',
    name: 'merge',
    type: 'boolean',
    default: true,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['updateCustomAttributes'],
      },
    },
    description:
      'Whether to only change the keys you send and keep the others (Chatwoot 4.17+). When off, or on older Chatwoot versions, the whole custom attributes object is replaced and keys you do not send are deleted.',
  },
];
