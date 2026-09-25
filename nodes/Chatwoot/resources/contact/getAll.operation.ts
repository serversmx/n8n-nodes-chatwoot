import type { INodeProperties } from 'n8n-workflow';
import { CONTACT_SORT_OPTIONS } from './utils';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['contact'],
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
    typeOptions: {
      minValue: 1,
    },
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    description:
      'Max number of results to return. Chatwoot returns 15 contacts per page; the node requests as many pages as needed.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'Include Contact Inboxes',
        name: 'include_contact_inboxes',
        type: 'boolean',
        default: true,
        description:
          "Whether to include each contact's inboxes and source IDs (contact_inboxes). Turn off for faster responses on large lists.",
      },
      {
        displayName: 'Labels',
        name: 'labels',
        type: 'multiOptions',
        typeOptions: {
          loadOptionsMethod: 'getLabels',
        },
        default: [],
        description:
          'Only return contacts that have at least one of these labels. Choose from the list, or pass label titles with an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Sort By',
        name: 'sort',
        type: 'options',
        default: 'name',
        options: CONTACT_SORT_OPTIONS,
        description: 'Sort contacts by field (prefix with - for descending). Defaults to Created At (Oldest) when omitted. Activity-based sorts can move contacts between pages while Return All runs.',
      },
    ],
  },
];
