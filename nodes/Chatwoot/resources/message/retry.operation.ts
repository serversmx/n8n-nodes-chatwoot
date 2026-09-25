import type { INodeProperties } from 'n8n-workflow';

export const retryOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['retry'],
      },
    },
    description: 'ID of the conversation containing the message',
  },
  {
    displayName: 'Message ID',
    name: 'messageId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['retry'],
      },
    },
    description:
      'ID of the failed outgoing message to send again. Chatwoot 4.18+ ignores messages whose status is not Failed; older versions resend any message, so only pass failed ones.',
  },
];
