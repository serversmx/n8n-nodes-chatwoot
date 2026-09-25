import type { INodeProperties } from 'n8n-workflow';
import { CONTACT_SORT_OPTIONS } from './utils';

export const searchOperation: INodeProperties[] = [
  {
    displayName: 'Query',
    name: 'query',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['search'],
      },
    },
    description:
      'Text to find in the contact name, email, phone number or identifier (partial match, case-insensitive except for the identifier). To find a WhatsApp contact from a number or JID, use "Find by WhatsApp Number".',
  },
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['search'],
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
        operation: ['search'],
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
        operation: ['search'],
      },
    },
    options: [
      {
        displayName: 'Include Contact Inboxes',
        name: 'include_contact_inboxes',
        type: 'boolean',
        default: true,
        description: "Whether to include each contact's inboxes and source IDs (contact_inboxes)",
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
