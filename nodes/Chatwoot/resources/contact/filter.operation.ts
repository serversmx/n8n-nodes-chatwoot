import type { INodeProperties } from 'n8n-workflow';
import { CONTACT_SORT_OPTIONS } from './utils';

/** Help text shared by Contact > Filter and the Export filter (Chatwoot 4.17+ validation rules). */
export const CONTACT_FILTER_PAYLOAD_HELP =
  'JSON array of conditions: [{"attribute_key": "email", "filter_operator": "contains", "values": ["@example.com"], "query_operator": "AND"}, {"attribute_key": "labels", "filter_operator": "equal_to", "values": ["vip"]}]. ' +
  'Keys: name, email, phone_number, identifier, country_code, city, company_name, labels, created_at, last_activity_at, blocked, or a contact custom attribute key. ' +
  'Operators: equal_to, not_equal_to, contains, does_not_contain (text), is_present, is_not_present (labels and custom attributes), is_greater_than, is_less_than, days_before (1-998, dates). ' +
  'equal_to/not_equal_to compare only the FIRST value: to match several, add one condition per value joined with "OR". ' +
  'Join conditions with query_operator "AND"/"OR" (missing ones default to AND); the node removes it from the last condition (Chatwoot 4.17+ rejects it there) and renames the legacy key "company" to "company_name" (renamed in Chatwoot 4.14).';

export const filterOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['filter'],
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
        operation: ['filter'],
        returnAll: [false],
      },
    },
    description:
      'Max number of results to return. Chatwoot returns 15 contacts per page; the node requests as many pages as needed.',
  },
  {
    displayName: 'Filter Payload',
    name: 'filterPayload',
    type: 'json',
    default: '[]',
    required: true,
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['filter'],
      },
    },
    description: CONTACT_FILTER_PAYLOAD_HELP,
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
        operation: ['filter'],
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
