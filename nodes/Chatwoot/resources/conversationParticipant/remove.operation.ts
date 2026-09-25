import type { INodeProperties } from 'n8n-workflow';

export const removeOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['remove'] } },
    description: 'The ID of the conversation',
  },
  {
    displayName: 'User IDs',
    name: 'userIds',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['remove'] } },
    description: 'Comma-separated list of agent (user) IDs to remove from the participants. IDs that are not participants are ignored.',
  },
];
