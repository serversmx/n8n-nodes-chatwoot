import type { INodeProperties } from 'n8n-workflow';
import { appliedSlaFilterOptions } from './filters';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['appliedSla'], operation: ['getAll'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['appliedSla'], operation: ['getAll'], returnAll: [false] },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: { resource: ['appliedSla'], operation: ['getAll'] } },
    options: appliedSlaFilterOptions,
  },
];
