import type { INodeProperties } from 'n8n-workflow';

export const executeOperation: INodeProperties[] = [
  {
    displayName: 'Macro ID',
    name: 'macroId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['execute'],
      },
    },
    description: 'The ID of the macro to execute',
  },
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['execute'],
      },
    },
    description:
      'The ID of the conversation to run the macro on (the conversation ID shown in Chatwoot)',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['execute'],
      },
    },
    options: [
      {
        displayName: 'Additional Conversation IDs',
        name: 'additionalConversationIds',
        type: 'string',
        default: '',
        placeholder: '12, 15, 18',
        description:
          'Comma-separated conversation IDs to run the macro on in the same request, besides the Conversation ID above',
      },
    ],
  },
];
