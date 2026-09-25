import type { INodeProperties } from 'n8n-workflow';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['notification'],
        operation: ['getAll'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: {
        resource: ['notification'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['notification'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'Include Read',
        name: 'includes_read',
        type: 'boolean',
        default: false,
        description:
          'Whether to include notifications already marked as read (excluded by default)',
      },
      {
        displayName: 'Include Snoozed',
        name: 'includes_snoozed',
        type: 'boolean',
        default: false,
        description: 'Whether to include snoozed notifications (excluded by default)',
      },
      {
        displayName: 'Sort Order',
        name: 'sort_order',
        type: 'options',
        options: [
          { name: 'Descending', value: 'desc' },
          { name: 'Ascending', value: 'asc' },
        ],
        default: 'desc',
        description: 'Sort by last activity time',
      },
    ],
  },
];
