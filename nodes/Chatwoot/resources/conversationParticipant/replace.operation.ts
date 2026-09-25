import type { INodeProperties } from 'n8n-workflow';

export const replaceOperation: INodeProperties[] = [
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['replace'] } },
    description: 'The ID of the conversation',
  },
  {
    displayName: 'User IDs',
    name: 'userIds',
    type: 'string',
    default: '',
    displayOptions: { show: { resource: ['conversationParticipant'], operation: ['replace'] } },
    description:
      "Comma-separated list of agent (user) IDs that must be the participants after the call: missing ones are added and the others removed. Leave empty to remove every participant. Since Chatwoot 4.16.2 new participants must be members of the conversation's inbox or administrators (otherwise 422).",
  },
];
