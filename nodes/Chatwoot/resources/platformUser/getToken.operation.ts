import type { INodeProperties } from 'n8n-workflow';

export const getTokenOperation: INodeProperties[] = [
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['platformUser'],
        operation: ['getToken'],
      },
    },
    description: 'ID of the user whose access token is returned',
  },
];
