import type { INodeProperties } from 'n8n-workflow';

export const updateAgentsOperation: INodeProperties[] = [
  {
    displayName: 'Inbox ID',
    name: 'inboxId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['updateAgents'],
      },
    },
    description: 'ID of the inbox',
  },
  {
    displayName: 'User IDs',
    name: 'userIds',
    type: 'string',
    required: true,
    default: '',
    placeholder: '1, 2, 3',
    displayOptions: {
      show: {
        resource: ['inbox'],
        operation: ['updateAgents'],
      },
    },
    description:
      'Comma-separated list of ALL agent (user) IDs that should be members of the inbox. Agents not listed are removed.',
  },
];
