import type { INodeProperties } from 'n8n-workflow';

export const getOperation: INodeProperties[] = [
  {
    displayName: 'Campaign ID',
    name: 'campaignId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['campaign'], operation: ['get'] } },
    description: 'The ID of the campaign to retrieve (the "id" returned by Get Many)',
  },
];
