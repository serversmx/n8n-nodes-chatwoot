import type { INodeProperties } from 'n8n-workflow';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Account ID',
    name: 'accountId',
    type: 'number',
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['getAll'],
      },
    },
    description:
      'Only return the bots whose account_id is this account (filtered by the node, Chatwoot has no account filter here). Use 0 to return every bot of this Platform App, including global bots.',
  },
];
