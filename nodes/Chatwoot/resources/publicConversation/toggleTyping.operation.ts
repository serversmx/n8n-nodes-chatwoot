import type { INodeProperties } from 'n8n-workflow';

export const toggleTypingOperation: INodeProperties[] = [
  {
    displayName: 'Contact Identifier',
    name: 'contactIdentifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['toggleTyping'],
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
        resource: ['publicConversation'],
        operation: ['toggleTyping'],
      },
    },
    description: 'ID of the conversation',
  },
  {
    displayName: 'Typing Status',
    name: 'typingStatus',
    type: 'options',
    required: true,
    options: [
      { name: 'Typing On', value: 'on' },
      { name: 'Typing Off', value: 'off' },
    ],
    default: 'on',
    displayOptions: {
      show: {
        resource: ['publicConversation'],
        operation: ['toggleTyping'],
      },
    },
    description: 'Whether to show typing indicator',
  },
];
