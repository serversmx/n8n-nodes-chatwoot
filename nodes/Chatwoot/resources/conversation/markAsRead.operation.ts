import type { INodeProperties } from 'n8n-workflow';

export const markAsReadOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['markAsRead'],
      },
    },
    description: 'ID of the conversation to mark as read for the user that owns the API token',
  },
];
