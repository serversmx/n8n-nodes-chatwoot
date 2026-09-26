import type { INodeProperties } from 'n8n-workflow';

export const deleteOperation: INodeProperties[] = [
  {
    displayName: 'Campaign ID',
    name: 'campaignId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['campaign'], operation: ['delete'] } },
    description: 'The ID of the campaign to delete (the "id" returned by Get Many)',
  },
];
