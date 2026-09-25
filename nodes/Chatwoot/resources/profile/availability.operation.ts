import type { INodeProperties } from 'n8n-workflow';

export const availabilityOperation: INodeProperties[] = [
  {
    displayName: 'Availability',
    name: 'availability',
    type: 'options',
    required: true,
    options: [
      { name: 'Online', value: 'online' },
      { name: 'Offline', value: 'offline' },
      { name: 'Busy', value: 'busy' },
    ],
    default: 'online',
    displayOptions: {
      show: {
        resource: ['profile'],
        operation: ['availability'],
      },
    },
    description: 'Availability of the token owner in the account of the credential',
  },
];
