import type { INodeProperties } from 'n8n-workflow';

export const filterOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['conversation'],
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
        resource: ['conversation'],
        operation: ['filter'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Filter Payload',
    name: 'filterPayload',
    type: 'json',
    default: '[]',
    required: true,
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['filter'],
      },
    },
    description:
      'Conditions as a JSON array. Example: [{"attribute_key": "status", "filter_operator": "equal_to", "values": ["open"], "query_operator": "AND"}, {"attribute_key": "inbox_id", "filter_operator": "equal_to", "values": [3]}]. ' +
      'query_operator (AND/OR) joins a condition with the next one: every condition but the last needs it, and the node removes it from the last one. ' +
      'Keys: status, assignee_id, inbox_id, team_id, contact_id (recent Chatwoot versions only), priority, display_id, campaign_id, labels, browser_language, conversation_language, referer, created_at, last_activity_at, mail_subject or a custom attribute key. ' +
      'Operators: equal_to, not_equal_to, contains, does_not_contain, is_present, is_not_present, is_greater_than, is_less_than, days_before (1-998 days). Status and priority values must be strings.',
  },
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['filter'],
      },
    },
    options: [
      {
        displayName: 'Sort By',
        name: 'sort_by',
        type: 'options',
        default: 'last_activity_at_desc',
        options: [
          { name: 'Created At (Newest First)', value: 'created_at_desc' },
          { name: 'Created At (Oldest First)', value: 'created_at_asc' },
          { name: 'Last Activity (Newest First)', value: 'last_activity_at_desc' },
          { name: 'Last Activity (Oldest First)', value: 'last_activity_at_asc' },
          { name: 'Priority (Highest First)', value: 'priority_desc' },
          { name: 'Priority (Highest First, Then Oldest)', value: 'priority_desc_created_at_asc' },
          { name: 'Priority (Lowest First)', value: 'priority_asc' },
          { name: 'Unread First', value: 'unread' },
          { name: 'Waiting Since (Longest First)', value: 'waiting_since_asc' },
          { name: 'Waiting Since (Shortest First)', value: 'waiting_since_desc' },
        ],
        description:
          'Order of the filtered conversations. Requires Chatwoot 4.18+; older versions ignore it and sort by Last Activity (Newest First).',
      },
    ],
  },
];
