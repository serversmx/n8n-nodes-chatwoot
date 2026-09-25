import type { INodeProperties } from 'n8n-workflow';

export const markAsUnreadOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['markAsUnread'],
      },
    },
    description:
      'ID of the conversation to mark as unread (its last incoming message becomes unread again)',
  },
];
