import type { INodeProperties } from 'n8n-workflow';
import { csvOutputFields } from './helpers';

/**
 * Report operations whose Chatwoot endpoint answers a CSV file instead of JSON (v2 endpoint and the
 * file name Chatwoot puts in Content-Disposition). The CSV starts with a metadata line (reporting
 * period or timezone), so the header is the second non-empty row. `dateRange`: the template writes
 * the reporting period and fails (500) without since/until.
 */
export const REPORT_CSV_DOWNLOADS: Record<
  string,
  { endpoint: string; fileName: string; dateRange: boolean }
> = {
  agentStatistics: { endpoint: '/reports/agents', fileName: 'agents_report.csv', dateRange: true },
  conversationTraffic: {
    endpoint: '/reports/conversation_traffic',
    fileName: 'conversation_traffic_reports.csv',
    dateRange: false,
  },
  conversationsSummary: {
    endpoint: '/reports/conversations_summary',
    fileName: 'conversations_summary_report.csv',
    dateRange: true,
  },
  inboxStatistics: {
    endpoint: '/reports/inboxes',
    fileName: 'inboxes_report.csv',
    dateRange: true,
  },
  labelStatistics: { endpoint: '/reports/labels', fileName: 'labels_report.csv', dateRange: true },
  teamStatistics: { endpoint: '/reports/teams', fileName: 'teams_report.csv', dateRange: true },
};

export const reportOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['report'],
    },
  },
  options: [
    {
      name: 'Account Summary',
      value: 'accountSummary',
      description:
        'Get summary metrics (conversations, messages, avg first response/resolution/reply time, resolutions) for the account or one agent/inbox/label/team, with the previous period for comparison',
      action: 'Get account summary report',
    },
    {
      name: 'Agent Statistics',
      value: 'agentStatistics',
      description:
        'Download per-agent metrics as CSV (file or parsed rows). For JSON use Summary Report → Agent Summary.',
      action: 'Get agent statistics',
    },
    {
      name: 'Bot Metrics',
      value: 'botMetrics',
      description:
        'Get bot conversation/message counts and resolution/handoff rates. Since Chatwoot 4.14 a bot resolution is not counted when the conversation was also handed off.',
      action: 'Get bot metrics',
    },
    {
      name: 'Bot Summary',
      value: 'botSummary',
      description:
        'Get bot resolutions and handoffs counts with the previous period. Since Chatwoot 4.14 bot resolutions exclude conversations that were handed off to an agent.',
      action: 'Get bot summary',
    },
    {
      name: 'Conversation Counts',
      value: 'conversationCounts',
      description: 'Get conversation counts by status (mine, unassigned, assigned, all)',
      action: 'Get conversation counts',
    },
    {
      name: 'Conversation Reporting Events',
      value: 'conversationReportingEvents',
      description:
        'Get the raw reporting events of one conversation (first response, reply times, resolutions, bot handoffs). Enterprise.',
      action: 'Get conversation reporting events',
    },
    {
      name: 'Conversation Statistics',
      value: 'conversationStatistics',
      description:
        'Get live open/unattended conversation counts for the account, or per agent (all agents, paginated automatically)',
      action: 'Get conversation statistics',
    },
    {
      name: 'Conversation Traffic',
      value: 'conversationTraffic',
      description:
        'Download the hourly conversation heatmap of the last N days as CSV (file or parsed rows)',
      action: 'Get conversation traffic',
    },
    {
      name: 'Conversations Summary',
      value: 'conversationsSummary',
      description: 'Download the account conversation summary as CSV (file or parsed rows)',
      action: 'Get conversations summary',
    },
    {
      name: 'Drilldown',
      value: 'drilldown',
      description:
        'List the conversations or messages behind one timeseries bucket of a metric (e.g. which conversations had a slow first response on a given day). Administrators only. Chatwoot allows 10 drilldown requests per minute per user by default (100 records per request). Requires Chatwoot 4.16+.',
      action: 'Get report drilldown',
    },
    {
      name: 'First Response Time Distribution',
      value: 'firstResponseTimeDistribution',
      description:
        'Get first response counts per channel type in buckets (0-1h, 1-4h, 4-8h, 8-24h, 24h+)',
      action: 'Get first response time distribution',
    },
    {
      name: 'Inbox Label Matrix',
      value: 'inboxLabelMatrix',
      description: 'Get a matrix of conversation counts per inbox and label',
      action: 'Get inbox label matrix',
    },
    {
      name: 'Inbox Statistics',
      value: 'inboxStatistics',
      description:
        'Download per-inbox metrics as CSV (file or parsed rows). For JSON use Summary Report → Inbox Summary.',
      action: 'Get inbox statistics',
    },
    {
      name: 'Label Statistics',
      value: 'labelStatistics',
      description:
        'Download per-label metrics as CSV (file or parsed rows). For JSON use Summary Report → Label Summary.',
      action: 'Get label statistics',
    },
    {
      name: 'Outgoing Messages Count',
      value: 'outgoingMessagesCount',
      description: 'Get outgoing message counts grouped by agent, team, inbox or label',
      action: 'Get outgoing messages count',
    },
    {
      name: 'Reporting Events',
      value: 'reportingEvents',
      description:
        'List raw reporting events (first_response, reply_time, conversation_resolved, bot handoffs...) with their durations, for BI exports. Enterprise, administrators only.',
      action: 'Get reporting events',
    },
    {
      name: 'Team Statistics',
      value: 'teamStatistics',
      description:
        'Download per-team metrics as CSV (file or parsed rows). For JSON use Summary Report → Team Summary.',
      action: 'Get team statistics',
    },
    {
      name: 'Timeseries',
      value: 'timeseries',
      description: 'Get a metric grouped by hour/day/week/month/year for the account or one entity',
      action: 'Get timeseries report',
    },
    {
      name: 'Year in Review',
      value: 'yearInReview',
      description: 'Get annual review statistics',
      action: 'Get year in review',
    },
  ],
  default: 'accountSummary',
};

const DATE_RANGE_OPERATIONS = [
  'accountSummary',
  'agentStatistics',
  'botSummary',
  'botMetrics',
  'conversationsSummary',
  'drilldown',
  'firstResponseTimeDistribution',
  'inboxLabelMatrix',
  'inboxStatistics',
  'labelStatistics',
  'outgoingMessagesCount',
  'reportingEvents',
  'teamStatistics',
  'timeseries',
];

const dateRangeFields: INodeProperties[] = [
  {
    displayName: 'Since',
    name: 'since',
    type: 'dateTime',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: DATE_RANGE_OPERATIONS,
      },
    },
    description: 'Start date for the report (sent to Chatwoot as a Unix timestamp)',
  },
  {
    displayName: 'Until',
    name: 'until',
    type: 'dateTime',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: DATE_RANGE_OPERATIONS,
      },
    },
    description: 'End date for the report (sent to Chatwoot as a Unix timestamp)',
  },
];

export const reportFields: INodeProperties[] = [
  ...dateRangeFields,
  // Timeseries / summary / drilldown fields
  {
    displayName: 'Type',
    name: 'type',
    type: 'options',
    required: true,
    options: [
      { name: 'Account', value: 'account' },
      { name: 'Agent', value: 'agent' },
      { name: 'Inbox', value: 'inbox' },
      { name: 'Label', value: 'label' },
      { name: 'Team', value: 'team' },
    ],
    default: 'account',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['timeseries', 'accountSummary', 'botSummary', 'drilldown'],
      },
    },
    description:
      'Entity type for the report. For anything other than Account, set Options → Entity ID.',
  },
  {
    displayName: 'Metric',
    name: 'metric',
    type: 'options',
    required: true,
    options: [
      {
        name: 'Average First Response Time',
        value: 'avg_first_response_time',
        description: 'Seconds until the first agent reply',
      },
      {
        name: 'Average Reply Time',
        value: 'reply_time',
        description: 'Seconds between a customer message and the next agent reply',
      },
      {
        name: 'Average Resolution Time',
        value: 'avg_resolution_time',
        description: 'Seconds from conversation creation to resolution',
      },
      {
        name: 'Bot Handoffs Count',
        value: 'bot_handoffs_count',
        description: 'Conversations handed off from a bot to an agent',
      },
      {
        name: 'Bot Resolutions Count',
        value: 'bot_resolutions_count',
        description:
          'Conversations resolved by a bot. Since Chatwoot 4.14 conversations that were also handed off are excluded.',
      },
      { name: 'Conversations Count', value: 'conversations_count' },
      { name: 'Incoming Messages Count', value: 'incoming_messages_count' },
      { name: 'Outgoing Messages Count', value: 'outgoing_messages_count' },
      { name: 'Resolutions Count', value: 'resolutions_count' },
    ],
    default: 'conversations_count',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['timeseries', 'drilldown'],
      },
    },
    description: 'Metric to retrieve',
  },
  // Drilldown
  {
    displayName: 'Bucket Start',
    name: 'bucketTimestamp',
    type: 'dateTime',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['drilldown'],
      },
    },
    description:
      'Start of the timeseries bucket to drill into (the "timestamp" of a Timeseries result). The bucket length is Options → Group By Period (default day) and it must overlap Since/Until.',
  },
  // Conversations report params
  {
    displayName: 'Type',
    name: 'conversationType',
    type: 'options',
    options: [
      {
        name: 'Account',
        value: 'account',
        description: 'Open, unattended, unassigned and pending counts for the whole account',
      },
      {
        name: 'Agent',
        value: 'agent',
        description: 'Open and unattended counts per agent (one item per agent)',
      },
    ],
    default: 'account',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['conversationStatistics'],
      },
    },
    description: 'Whether to get the live counts for the account or per agent',
  },
  // Outgoing messages count - group_by required
  {
    displayName: 'Group By',
    name: 'groupBy',
    type: 'options',
    required: true,
    options: [
      { name: 'Agent', value: 'agent' },
      { name: 'Inbox', value: 'inbox' },
      { name: 'Label', value: 'label' },
      { name: 'Team', value: 'team' },
    ],
    default: 'agent',
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['outgoingMessagesCount'],
      },
    },
    description: 'Group counts by this entity',
  },
  // Conversation reporting events
  {
    displayName: 'Conversation ID',
    name: 'conversationId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['conversationReportingEvents'],
      },
    },
    description: 'ID of the conversation (the number shown in the Chatwoot URL)',
  },
  // Paginated operations
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['drilldown', 'reportingEvents'],
      },
    },
    description: 'Whether to return all results or only up to a given limit',
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: { minValue: 1 },
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['drilldown', 'reportingEvents'],
        returnAll: [false],
      },
    },
    description: 'Max number of results to return',
  },
  // Year in review
  {
    displayName: 'Year',
    name: 'year',
    type: 'number',
    default: 2025,
    displayOptions: {
      show: {
        resource: ['report'],
        operation: ['yearInReview'],
      },
    },
    description: 'Year for the review',
  },
  ...csvOutputFields('report', Object.keys(REPORT_CSV_DOWNLOADS)),
  // Common options (each option is only shown for the operations whose endpoint reads it)
  {
    displayName: 'Options',
    name: 'options',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: {
      show: {
        resource: ['report'],
        operation: [
          'accountSummary',
          'agentStatistics',
          'botSummary',
          'conversationStatistics',
          'conversationsSummary',
          'conversationTraffic',
          'drilldown',
          'inboxLabelMatrix',
          'inboxStatistics',
          'labelStatistics',
          'reportingEvents',
          'teamStatistics',
          'timeseries',
        ],
      },
    },
    options: [
      {
        displayName: 'Business Hours',
        name: 'business_hours',
        type: 'boolean',
        default: false,
        description: 'Whether to compute durations within business hours only',
        displayOptions: {
          show: {
            '/operation': [
              'accountSummary',
              'agentStatistics',
              'botSummary',
              'conversationsSummary',
              'drilldown',
              'inboxStatistics',
              'labelStatistics',
              'teamStatistics',
              'timeseries',
            ],
          },
        },
      },
      {
        displayName: 'Days Before',
        name: 'days_before',
        type: 'number',
        default: 6,
        description: 'Number of days before today to include in the traffic heatmap',
        displayOptions: { show: { '/operation': ['conversationTraffic'] } },
      },
      {
        displayName: 'Entity ID',
        name: 'id',
        type: 'number',
        default: 0,
        description:
          'ID of the agent/inbox/label/team selected in Type (required when Type is not Account)',
        displayOptions: {
          show: { '/operation': ['accountSummary', 'botSummary', 'drilldown', 'timeseries'] },
        },
      },
      {
        displayName: 'Event Name',
        name: 'event_name',
        type: 'options',
        options: [
          { name: 'Any', value: '' },
          { name: 'Conversation Bot Handoff', value: 'conversation_bot_handoff' },
          { name: 'Conversation Bot Resolved', value: 'conversation_bot_resolved' },
          { name: 'Conversation Opened', value: 'conversation_opened' },
          { name: 'Conversation Resolved', value: 'conversation_resolved' },
          { name: 'First Response', value: 'first_response' },
          { name: 'Reply Time', value: 'reply_time' },
        ],
        default: '',
        description: 'Only return reporting events with this name',
        displayOptions: { show: { '/operation': ['reportingEvents'] } },
      },
      {
        displayName: 'Group By Period',
        name: 'group_by',
        type: 'options',
        options: [
          { name: 'Hour', value: 'hour' },
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
          { name: 'Year', value: 'year' },
        ],
        default: 'day',
        description:
          'Time bucket size (timeseries grouping; for Drilldown, the length of the bucket that starts at Bucket Start)',
        displayOptions: {
          show: { '/operation': ['accountSummary', 'botSummary', 'drilldown', 'timeseries'] },
        },
      },
      {
        displayName: 'Inbox ID',
        name: 'inbox_id',
        type: 'number',
        default: 0,
        description: 'Only return events of this inbox',
        displayOptions: { show: { '/operation': ['reportingEvents'] } },
      },
      {
        displayName: 'Inbox IDs',
        name: 'inbox_ids',
        type: 'string',
        default: '',
        description: 'Comma-separated inbox IDs to include in the matrix (all inboxes when empty)',
        displayOptions: { show: { '/operation': ['inboxLabelMatrix'] } },
      },
      {
        displayName: 'Label IDs',
        name: 'label_ids',
        type: 'string',
        default: '',
        description: 'Comma-separated label IDs to include in the matrix (all labels when empty)',
        displayOptions: { show: { '/operation': ['inboxLabelMatrix'] } },
      },
      {
        displayName: 'Timezone Offset',
        name: 'timezone_offset',
        type: 'number',
        typeOptions: { numberPrecision: 2 },
        default: 0,
        description:
          'Offset from UTC in hours used to build the time buckets (e.g. -6 for Mexico City, 5.5 for India)',
        displayOptions: {
          show: {
            '/operation': [
              'accountSummary',
              'botSummary',
              'conversationTraffic',
              'drilldown',
              'timeseries',
            ],
          },
        },
      },
      {
        displayName: 'User ID',
        name: 'user_id',
        type: 'number',
        default: 0,
        description:
          'Only return this agent (Conversation Statistics with Type Agent) or the events of this agent (Reporting Events)',
        displayOptions: { show: { '/operation': ['conversationStatistics', 'reportingEvents'] } },
      },
    ],
  },
];
