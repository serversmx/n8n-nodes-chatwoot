import type { INodeProperties } from 'n8n-workflow';
import { csatFilterOptions } from './filters';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['csatSurvey'], operation: ['getAll'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['csatSurvey'], operation: ['getAll'], returnAll: [false] },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: { resource: ['csatSurvey'], operation: ['getAll'] } },
    options: [
      ...csatFilterOptions,
      {
        displayName: 'Sort',
        name: 'sort',
        type: 'options',
        options: [
          { name: 'Newest First', value: '-created_at' },
          { name: 'Oldest First', value: 'created_at' },
        ],
        default: '-created_at',
        description: 'Order by creation date',
      },
    ],
  },
];
