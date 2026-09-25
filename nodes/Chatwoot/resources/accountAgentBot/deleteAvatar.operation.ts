import type { INodeProperties } from 'n8n-workflow';

export const deleteAvatarOperation: INodeProperties[] = [
  {
    displayName: 'Agent Bot ID',
    name: 'agentBotId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['accountAgentBot'],
        operation: ['deleteAvatar'],
      },
    },
    description: 'ID of the agent bot whose avatar is removed',
  },
];
