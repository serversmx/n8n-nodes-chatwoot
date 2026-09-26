import type { INodeProperties } from 'n8n-workflow';
import { searchFiltersCollection } from './filters';

export const searchConversationsOperation: INodeProperties[] = [
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['search'], operation: ['searchConversations'] } },
    description: 'Text to find in the conversation display ID or in the contact name, email, phone number or identifier',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['search'], operation: ['searchConversations'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: { show: { resource: ['search'], operation: ['searchConversations'], returnAll: [false] } },
    description: 'Max number of results to return',
  },
  searchFiltersCollection('searchConversations', 'last activity'),
];
