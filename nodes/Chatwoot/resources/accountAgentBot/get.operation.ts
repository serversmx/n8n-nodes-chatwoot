import type { INodeProperties } from 'n8n-workflow';

export const getOperation: INodeProperties[] = [
  {
    displayName: 'Agent Bot ID',
    name: 'agentBotId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['get'],
      },
    },
    description: 'ID of the agent bot',
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
        operation: ['get'],
      },
    },
    description:
      'Optional safety check: when set, the node fails if the bot does not belong to this account (global bots belong to none). Use 0 to skip the check.',
  },
];
