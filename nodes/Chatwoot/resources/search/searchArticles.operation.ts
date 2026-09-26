import type { INodeProperties } from 'n8n-workflow';
import { searchFiltersCollection } from './filters';

export const searchArticlesOperation: INodeProperties[] = [
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['search'], operation: ['searchArticles'] } },
    description: 'Text to find in Help Center articles (title, description and content)',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['search'], operation: ['searchArticles'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: { resource: ['search'], operation: ['searchArticles'], returnAll: [false] },
    },
    description: 'Max number of results to return',
  },
  searchFiltersCollection('searchArticles', 'last update'),
];
