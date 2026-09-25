import type { INodeProperties } from 'n8n-workflow';

/** Record types Chatwoot audits (enterprise/app/models/enterprise/audit/* plus message deletions). */
const AUDITABLE_TYPES = [
  { name: 'Account', value: 'Account' },
  { name: 'Agent (Account User)', value: 'AccountUser' },
  { name: 'Agent Bot', value: 'AgentBot' },
  { name: 'Automation Rule', value: 'AutomationRule' },
  { name: 'Conversation (Deletions)', value: 'Conversation' },
  { name: 'Inbox', value: 'Inbox' },
  { name: 'Inbox Member', value: 'InboxMember' },
  { name: 'Macro', value: 'Macro' },
  { name: 'Message (Deletions)', value: 'Message' },
  { name: 'Team', value: 'Team' },
  { name: 'Team Member', value: 'TeamMember' },
  { name: 'User (Sign In/Out)', value: 'User' },
  { name: 'Webhook', value: 'Webhook' },
];

export const getAllOperation: INodeProperties[] = [
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    displayOptions: {
      show: {
        resource: ['auditLog'],
        operation: ['getAll'],
      },
    },
    default: false,
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    displayOptions: {
      show: {
        resource: ['auditLog'],
        operation: ['getAll'],
        returnAll: [false],
      },
    },
    typeOptions: {
      minValue: 1,
    },
    default: 25,
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
        resource: ['auditLog'],
        operation: ['getAll'],
      },
    },
    options: [
      {
        displayName: 'Auditable Type (Single)',
        name: 'auditable_type',
        type: 'options',
        options: [...AUDITABLE_TYPES, { name: 'Contact (Not Audited)', value: 'Contact' }],
        default: '',
        description:
          'Kept for workflows created before v0.9.0; merged into Types. Prefer the Types filter.',
      },
      {
        displayName: 'Since',
        name: 'since',
        type: 'dateTime',
        default: '',
        description: 'Only return entries created at or after this date. Requires Chatwoot 4.17+.',
      },
      {
        displayName: 'Sort',
        name: 'sort',
        type: 'options',
        options: [
          { name: 'Newest First', value: 'desc' },
          { name: 'Oldest First', value: 'asc' },
        ],
        default: 'desc',
        description:
          'Order by creation date. Requires Chatwoot 4.17+ (older versions: newest first).',
      },
      {
        displayName: 'Types',
        name: 'types',
        type: 'multiOptions',
        options: AUDITABLE_TYPES,
        default: [],
        description: 'Only return entries for these record types. Requires Chatwoot 4.17+.',
      },
      {
        displayName: 'Until',
        name: 'until',
        type: 'dateTime',
        default: '',
        description: 'Only return entries created at or before this date. Requires Chatwoot 4.17+.',
      },
      {
        displayName: 'User ID',
        name: 'user_id',
        type: 'number',
        default: 0,
        description:
          'Only return entries made by this user. Chatwoot has no server-side filter for it, so the node scans the pages matching the other filters: combine it with Since/Until.',
      },
      {
        displayName: 'User Search',
        name: 'q',
        type: 'string',
        default: '',
        description:
          'Only return entries whose user name, email or username contains this text. Requires Chatwoot 4.17+.',
      },
    ],
  },
];
