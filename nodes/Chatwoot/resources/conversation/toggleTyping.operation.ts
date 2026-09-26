import type { INodeProperties } from 'n8n-workflow';

export const toggleTypingOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['toggleTyping'],
      },
    },
    description: 'The ID of the conversation',
  },
  {
    displayName: 'Typing Status',
    name: 'typingStatus',
    type: 'options',
    options: [
      { name: 'On', value: 'on' },
      { name: 'Off', value: 'off' },
    ],
    required: true,
    default: 'on',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['toggleTyping'],
      },
    },
    description:
      'Whether to show or hide the typing indicator. Chatwoot shows it in the dashboard and website widget and sends conversation_typing_on/off webhooks to API inboxes. Evolution API (WhatsApp) inboxes ignore those events: to show "typing..." in WhatsApp, call Evolution\'s sendPresence endpoint instead.',
  },
  {
    displayName: 'Private (Note)',
    name: 'isPrivate',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['toggleTyping'],
      },
    },
    description: 'Whether the typing is for a private note, so only agents see the indicator',
  },
];
