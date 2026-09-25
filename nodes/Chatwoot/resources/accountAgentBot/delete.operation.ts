import type { INodeProperties } from 'n8n-workflow';

export const deleteOperation: INodeProperties[] = [
  {
    displayName: 'Agent Bot ID',
    name: 'agentBotId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['delete'],
      },
    },
    description: 'ID of the agent bot to delete',
  },
  {
    // Kept as 'accountId' for saved workflows: the Platform API does not need it, so it now works as a safety check
    displayName: 'Expected Account ID',
    name: 'accountId',
    type: 'number',
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['delete'],
      },
    },
    description:
      'Optional safety check: when set, the node first reads the bot and does not delete it unless it belongs to this account. Use 0 to skip the check.',
  },
];
