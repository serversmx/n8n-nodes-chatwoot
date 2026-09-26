import type { INodeProperties } from 'n8n-workflow';

export const searchOperation: INodeProperties[] = [
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['search'],
      },
    },
    description: 'Text to find in the incoming and outgoing messages of the conversations',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['search'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['search'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
];
