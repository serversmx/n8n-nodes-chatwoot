import type { INodeProperties } from 'n8n-workflow';

export const togglePriorityOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['togglePriority'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Priority',
    name: 'priority',
    type: 'options',
    required: true,
    options: [
      { name: 'Urgent', value: 'urgent' },
      { name: 'High', value: 'high' },
      { name: 'Medium', value: 'medium' },
      { name: 'Low', value: 'low' },
      { name: 'None', value: 'none' },
    ],
    default: 'none',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['togglePriority'],
      },
    },
    description: 'Priority level to set. None clears the priority.',
  },
];
