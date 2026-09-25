import type { INodeProperties } from 'n8n-workflow';

export const getMetricsOperation: INodeProperties[] = [
  {
    displayName: 'Campaign ID',
    name: 'campaignId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: { show: { resource: ['campaign'], operation: ['getMetrics'] } },
    description: 'The ID of a one-off WhatsApp campaign (the "id" returned by Get Many)',
  },
];
