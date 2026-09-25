import type { INodeProperties } from 'n8n-workflow';

export const getMetaOperation: INodeProperties[] = [
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['getMeta'],
      },
    },
    options: [
      {
        displayName: 'Inbox',
        name: 'inbox_id',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getInboxes',
        },
        default: '',
        description: 'Filter by inbox. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Labels',
        name: 'labels',
        type: 'string',
        default: '',
        placeholder: 'bug, urgent, vip',
        description: 'Comma-separated list of labels. Conversations with ANY of these labels are counted.',
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Open', value: 'open' },
          { name: 'Resolved', value: 'resolved' },
          { name: 'Pending', value: 'pending' },
          { name: 'Snoozed', value: 'snoozed' },
        ],
        default: 'all',
        description:
          'Filter by conversation status. When this filter is not set, Chatwoot only counts Open conversations.',
      },
      {
        displayName: 'Team',
        name: 'team_id',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getTeams',
        },
        default: '',
        description: 'Filter by team. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
    ],
  },
];
