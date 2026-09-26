import type { INodeProperties } from 'n8n-workflow';

export const addOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['add'] } },
    description: 'The ID of the conversation',
  },
  {
    displayName: 'User IDs',
    name: 'userIds',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['add'] } },
    description:
      "Comma-separated list of agent (user) IDs to add as participants. Since Chatwoot 4.16.2 each one must be a member of the conversation's inbox or an administrator, otherwise Chatwoot answers 422 \"Invalid participant IDs\". Returns only the newly added participants.",
  },
];
