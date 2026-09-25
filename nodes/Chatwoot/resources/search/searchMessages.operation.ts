import type { INodeProperties } from 'n8n-workflow';
import { searchFiltersCollection } from './filters';

export const searchMessagesOperation: INodeProperties[] = [
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['search'], operation: ['searchMessages'] } },
    description: 'Text to find in message content. Chatwoot only searches messages from the last 3 months (90 days), newest first.',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['search'], operation: ['searchMessages'] } },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 25,
    typeOptions: { minValue: 1 },
    displayOptions: { show: { resource: ['search'], operation: ['searchMessages'], returnAll: [false] } },
    description: 'Max number of results to return',
  },
  searchFiltersCollection('searchMessages', 'creation time', [
    {
      displayName: 'From',
      name: 'from',
      type: 'string',
      default: '',
      placeholder: 'contact:42',
      description:
        'Only return messages sent by this sender: "contact:ID" or "agent:ID". Requires the Advanced Search feature (Chatwoot Enterprise/premium plans); ignored otherwise.',
    },
    {
      displayName: 'Inbox ID',
      name: 'inbox_id',
      type: 'number',
      default: 0,
      description:
        'Only return messages of this inbox. Requires the Advanced Search feature (Chatwoot Enterprise/premium plans); ignored otherwise.',
    },
  ]),
];
