import type { INodeProperties } from 'n8n-workflow';

export const deleteCustomAttributesOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['deleteCustomAttributes'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Attribute Keys',
    name: 'attributeKeys',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'order_id, coupon_code',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['deleteCustomAttributes'],
      },
    },
    description:
      'Comma-separated custom attribute keys to remove from the conversation. The other keys are kept.',
  },
];
