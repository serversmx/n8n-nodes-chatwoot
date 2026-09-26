import type { INodeProperties } from 'n8n-workflow';
import { appliedSlaFilterOptions } from './filters';

export const metricsOperation: INodeProperties[] = [
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: { resource: ['appliedSla'], operation: ['metrics'] } },
    options: appliedSlaFilterOptions,
  },
];
