import type { INodeProperties } from 'n8n-workflow';

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['conversation'],
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
        resource: ['conversation'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['conversation'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'Assignee Type',
        name: 'assignee_type',
        type: 'options',
        default: 'all',
        options: [
          {
            name: 'All',
            value: 'all',
            description: 'All conversations regardless of assignee',
          },
          {
            name: 'Assigned',
            value: 'assigned',
            description: 'Conversations assigned to any agent or agent bot',
          },
          {
            name: 'Me',
            value: 'me',
            description: 'Conversations assigned to the current user',
          },
          {
            name: 'Unassigned',
            value: 'unassigned',
            description: 'Conversations without an agent or agent bot assignee',
          },
        ],
        description: 'Filter by assignee type',
      },
      {
        displayName: 'Conversation Type',
        name: 'conversation_type',
        type: 'options',
        default: 'mention',
        options: [
          {
            name: 'Mentions',
            value: 'mention',
            description: 'Conversations where the current user was @mentioned',
          },
          {
            name: 'Participating',
            value: 'participating',
            description: 'Conversations where the current user is a participant',
          },
          {
            name: 'Unattended',
            value: 'unattended',
            description: 'Conversations still waiting for a first reply or a reply to the last incoming message',
          },
        ],
        description: 'Only return a special view of conversations, relative to the user that owns the API token',
      },
      {
        displayName: 'Inbox ID',
        name: 'inbox_id',
        type: 'number',
        default: 0,
        description: 'Filter by specific inbox ID',
      },
      {
        displayName: 'Labels',
        name: 'labels',
        type: 'string',
        default: '',
        placeholder: 'bug, urgent, vip',
        description: 'Comma-separated list of labels. Conversations with ANY of these labels are returned.',
      },
      {
        displayName: 'Search Query',
        name: 'q',
        type: 'string',
        default: '',
        placeholder: 'Search text...',
        description:
          'Only return conversations with an incoming or outgoing message containing this text. Chatwoot ignores the Status filter when a query is set.',
      },
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
          {
            name: 'Unread First',
            value: 'unread',
            description: 'Recent Chatwoot versions only; older servers fall back to Last Activity',
          },
          { name: 'Waiting Since (Longest First)', value: 'waiting_since_asc' },
          { name: 'Waiting Since (Shortest First)', value: 'waiting_since_desc' },
        ],
        description: 'Order of the returned conversations. Chatwoot defaults to Last Activity (Newest First).',
      },
      {
        displayName: 'Source ID',
        name: 'source_id',
        type: 'string',
        default: '',
        placeholder: '5215512345678@s.whatsapp.net',
        description:
          "Only return conversations of the contact inbox with this source ID (the contact's identifier in the channel, e.g. the WhatsApp number or JID used by an API/Evolution inbox)",
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        default: 'all',
        options: [
          {
            name: 'All',
            value: 'all',
            description: 'All conversations',
          },
          {
            name: 'Open',
            value: 'open',
            description: 'Active conversations',
          },
          {
            name: 'Pending',
            value: 'pending',
            description: 'Conversations awaiting response',
          },
          {
            name: 'Resolved',
            value: 'resolved',
            description: 'Completed conversations',
          },
          {
            name: 'Snoozed',
            value: 'snoozed',
            description: 'Temporarily hidden conversations',
          },
        ],
        description: 'Filter by conversation status. When this filter is not set, conversations of every status are returned.',
      },
      {
        displayName: 'Team ID',
        name: 'team_id',
        type: 'number',
        default: 0,
        description: 'Filter by specific team ID',
      },
      {
        displayName: 'Updated Within (Seconds)',
        name: 'updated_within',
        type: 'number',
        default: 3600,
        typeOptions: {
          minValue: 1,
        },
        description:
          'Only return conversations updated in the last N seconds. Chatwoot then returns every match in a single unpaginated response, so keep the window short on busy accounts.',
      },
    ],
  },
];
