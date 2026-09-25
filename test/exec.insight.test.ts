/**
 * Execute-level tests for the reporting / insight resources: report, csatSurvey, appliedSla,
 * slaPolicy, auditLog, company and helpCenter.
 * Response fixtures follow the Chatwoot 4.18.0 jbuilder views (see the comment above each builder).
 */
import type { IDataObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import {
  csvRowsToObjects,
  parseCsv,
  portalConfigFromResponse,
  toUnixSeconds,
} from '../nodes/Chatwoot/resources/report/helpers';
import { createMockExecuteFunctions, runChatwootNode } from './helpers/mockExecuteFunctions';
import type { RecordedCall } from './helpers/mockExecuteFunctions';

const V1 = 'https://chatwoot.test/api/v1/accounts/1';
const V2 = 'https://chatwoot.test/api/v2/accounts/1';
const SINCE = '2026-09-01T00:00:00Z'; // 1788220800
const UNTIL = '2026-09-08T00:00:00Z'; // 1788825600
const SINCE_TS = 1788220800;
const UNTIL_TS = 1788825600;

const pageOf = (call: RecordedCall) => Number(call.qs?.page ?? 1);
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => from + k);

// ============================================================================
// Fixtures (Chatwoot 4.18.0 views)
// ============================================================================

// enterprise/app/views/api/v1/accounts/audit_logs/show.json.jbuilder
const auditLog = (id: number, userId = 1): IDataObject => ({
  id,
  auditable_id: 7,
  auditable_type: 'Inbox',
  auditable: { id: 7, name: 'WhatsApp' },
  associated_id: 1,
  associated_type: 'Account',
  user_id: userId,
  user_type: 'User',
  username: `agent${userId}@acme.test`,
  action: 'update',
  audited_changes: { name: ['Old', 'WhatsApp'] },
  version: 2,
  comment: null,
  request_uuid: `req-${id}`,
  created_at: 1788300000 + id,
  location: 'Mexico City, Mexico',
  remote_address: '189.203.10.x',
});
const auditLogPage = (ids: number[], total: number, page: number, userOf = (_id: number) => 1) => ({
  per_page: 25,
  total_entries: total,
  current_page: page,
  audit_logs: ids.map((id) => auditLog(id, userOf(id))),
});

// app/views/api/v1/models/_csat_survey_response.json.jbuilder (conversation_id = display_id)
const csatResponse = (id: number, conversationId: number, rating = 5): IDataObject => ({
  id,
  rating,
  feedback_message: rating > 3 ? 'Great support' : 'Slow',
  csat_review_notes: null,
  review_notes_updated_at: null,
  account_id: 1,
  message_id: 1000 + id,
  contact: { id: 50 + id, name: `Contact ${id}`, email: null, phone_number: '+5215512345678' },
  conversation_id: conversationId,
  assigned_agent: { id: 3, name: 'Ana', email: 'ana@acme.test', role: 'agent' },
  created_at: 1788300000 + id,
});

// enterprise/app/views/api/v1/accounts/applied_slas/index.json.jbuilder (rows have no top-level id)
const appliedSlaRow = (id: number): IDataObject => ({
  applied_sla: {
    id,
    sla_id: 2,
    sla_status: 'missed',
    created_at: 1788300000,
    updated_at: 1788300500,
    sla_completed_at: null,
    sla_description: 'Premium customers',
    sla_name: 'Premium',
    sla_first_response_time_threshold: 3600,
    sla_next_response_time_threshold: 7200,
    sla_only_during_business_hours: false,
    sla_resolution_time_threshold: 86400,
    sla_frt_due_at: 1788303600,
    sla_nrt_due_at: null,
    sla_rt_due_at: 1788386400,
  },
  conversation: {
    id: 900 + id,
    contact: { name: 'Juan' },
    labels: ['billing', 'vip'],
    assignee: { id: 3, name: 'Ana', type: 'user' },
  },
  sla_events: [
    { id: id * 10, event_type: 'frt', meta: {}, updated_at: 1788303700, created_at: 1788303700 },
  ],
});

// enterprise/app/views/api/v1/models/_company.json.jbuilder
const company = (id: number): IDataObject => ({
  id,
  name: `Acme ${id}`,
  contacts_count: 3,
  domain: `acme${id}.test`,
  description: null,
  custom_attributes: { plan: 'enterprise' },
  avatar_url: '',
  last_activity_at: 1788300000,
  created_at: 1788200000,
  updated_at: 1788250000,
});

// app/views/api/v1/accounts/articles/_article.json.jbuilder
const article = (id: number, extra: IDataObject = {}): IDataObject => ({
  id,
  slug: `article-${id}`,
  title: `Article ${id}`,
  content: 'Body',
  description: null,
  status: 'draft',
  draft_title: null,
  draft_content: null,
  position: id * 10,
  account_id: 1,
  updated_at: 1788300000,
  meta: {},
  category: { id: 4, name: 'Billing', slug: 'billing', locale: 'es', icon: '💳', icon_color: null },
  views: 0,
  author: { id: 3, name: 'Ana', email: 'ana@acme.test' },
  associated_articles: [],
  ...extra,
});

// app/views/api/v1/accounts/categories/_category.json.jbuilder
const category = (id: number, locale = 'es'): IDataObject => ({
  id,
  name: `Category ${id}`,
  slug: `category-${id}`,
  locale,
  description: null,
  position: 1,
  account_id: 1,
  icon: '',
  icon_color: null,
  related_categories: [],
  meta: { articles_count: 2 },
});

// app/views/api/v1/accounts/portals/_portal.json.jbuilder
const portal = (config: IDataObject = {}): IDataObject => ({
  id: 1,
  color: '#1f93ff',
  custom_domain: null,
  header_text: 'Ayuda',
  homepage_link: 'https://acme.test',
  name: 'Acme Help',
  page_title: 'Acme',
  slug: 'acme-help',
  archived: false,
  account_id: 1,
  config: {
    allowed_locales: [
      { code: 'es', articles_count: 4, categories_count: 2, draft: false },
      { code: 'en', articles_count: 1, categories_count: 1, draft: true },
    ],
    default_locale: 'es',
    layout: 'documentation',
    social_profiles: { facebook: 'https://facebook.com/acme' },
    locale_translations: {},
    popular_content: { es: { category_ids: [4], article_ids: [] } },
    analytics: {},
    ...config,
  },
  meta: { all_articles_count: 5, categories_count: 3, default_locale: 'es' },
});

// ============================================================================
// Helpers
// ============================================================================

describe('insight helpers', () => {
  it('toUnixSeconds floors dates and accepts epochs', () => {
    expect(toUnixSeconds('2026-09-01T00:00:00.900Z', 'Since')).toBe(SINCE_TS);
    expect(toUnixSeconds(SINCE_TS, 'Since')).toBe(SINCE_TS);
    expect(toUnixSeconds(SINCE_TS * 1000 + 999, 'Since')).toBe(SINCE_TS);
    expect(toUnixSeconds('', 'Since')).toBeUndefined();
    expect(() => toUnixSeconds('not a date', 'Since')).toThrow('Since is not a valid date');
  });

  it('parseCsv handles quotes, embedded commas/newlines, CRLF, BOM and indented rows', () => {
    const csv = '﻿Name,Note\r\n"Doe, Jane","said ""hi""\nthen left"\r\n\r\n  12,plain  \n';
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Note'],
      ['Doe, Jane', 'said "hi"\nthen left'],
      ['12', 'plain'],
    ]);
  });

  it('csvRowsToObjects skips metadata rows and names extra columns', () => {
    const rows = [['Reporting period'], ['A', 'B'], ['1', '2', '3'], ['Footer']];
    expect(csvRowsToObjects(rows, 1)).toEqual([{ A: '1', B: '2', column_3: '3' }]);
  });

  it('portalConfigFromResponse keeps only string analytics IDs', () => {
    const config = portalConfigFromResponse(
      portal({
        analytics: { ga4_measurement_id: 'G-ABC123', gtm_container_id: null, hotjar_site_id: '' },
      }),
    );
    expect(config.analytics).toEqual({ ga4_measurement_id: 'G-ABC123' });
    expect(
      portalConfigFromResponse(portal({ analytics: { gtm_container_id: null } })),
    ).not.toHaveProperty('analytics');
    expect(portalConfigFromResponse({ id: 1 })).toEqual({});
  });

  it('portalConfigFromResponse rebuilds the writable config', () => {
    expect(portalConfigFromResponse(portal())).toEqual({
      allowed_locales: ['es', 'en'],
      draft_locales: ['en'],
      default_locale: 'es',
      layout: 'documentation',
      social_profiles: { facebook: 'https://facebook.com/acme' },
      popular_content: { es: { category_ids: [4], article_ids: [] } },
    });
  });
});

// ============================================================================
// Report
// ============================================================================

describe('report', () => {
  it('timeseries sends integer since/until, the metric, entity and period options (v2 root)', async () => {
    const series = [
      { value: 1320.5, timestamp: SINCE_TS, count: 4 },
      { value: 0, timestamp: SINCE_TS + 604800, count: 0 },
    ];
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'timeseries',
        type: 'inbox',
        metric: 'reply_time',
        since: '2026-09-01T00:00:00.750Z',
        until: UNTIL,
        options: {
          id: 7,
          group_by: 'week',
          timezone_offset: -6,
          business_hours: true,
          days_before: 3,
        },
      },
      responses: [{ method: 'GET', url: `${V2}/reports`, body: series }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${V2}/reports`);
    // days_before is not an option of this operation, so n8n drops it
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      id: 7,
      group_by: 'week',
      timezone_offset: -6,
      business_hours: true,
      type: 'inbox',
      metric: 'reply_time',
    });
    expect(output[0].map((item) => item.json)).toEqual(series);
  });

  it('entity reports require Options → Entity ID', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'report',
        operation: 'accountSummary',
        type: 'agent',
        since: SINCE,
        until: UNTIL,
      },
    });
    await expect(new Chatwoot().execute.call(mock.ctx)).rejects.toThrow(
      'Options → Entity ID is required when Type is "agent"',
    );
    expect(mock.calls).toHaveLength(0);
  });

  it('outgoing messages count keeps the entity group_by (no period option)', async () => {
    const counts = [{ id: 3, name: 'Support', outgoing_messages_count: 42 }];
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'outgoingMessagesCount',
        groupBy: 'team',
        since: SINCE,
        until: UNTIL,
        options: { group_by: 'day' },
      },
      responses: [{ url: `${V2}/reports/outgoing_messages_count`, body: counts }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS, group_by: 'team' });
    expect(output[0][0].json).toEqual(counts[0]);
  });

  it('inbox label matrix sends inbox_ids[] and label_ids[] (GAP-5)', async () => {
    // app/builders/v2/reports/inbox_label_matrix_builder.rb#build
    const matrix = {
      inboxes: [
        { id: 1, name: 'WhatsApp' },
        { id: 2, name: 'Web' },
      ],
      labels: [{ id: 5, title: 'billing' }],
      matrix: [[3], [0]],
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'inboxLabelMatrix',
        since: SINCE,
        until: UNTIL,
        options: { inbox_ids: '1, 2', label_ids: '5' },
      },
      responses: [{ url: `${V2}/reports/inbox_label_matrix`, body: matrix }],
    });
    expect(calls[0].arrayFormat).toBe('brackets');
    expect(calls[0].queryString).toBe(
      `since=${SINCE_TS}&until=${UNTIL_TS}&inbox_ids[]=1&inbox_ids[]=2&label_ids[]=5`,
    );
    expect(output[0]).toHaveLength(1);
    expect(output[0][0].json).toEqual(matrix);
  });

  it('bot metrics only sends the date range', async () => {
    const metrics = {
      conversation_count: 10,
      message_count: 30,
      resolution_rate: 40,
      handoff_rate: 20,
    };
    const { output, calls } = await runChatwootNode({
      params: { resource: 'report', operation: 'botMetrics', since: SINCE, until: UNTIL },
      responses: [{ url: `${V2}/reports/bot_metrics`, body: metrics }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS });
    expect(output[0][0].json).toEqual(metrics);
  });

  it('conversation statistics (account) sends type=account only', async () => {
    const live = { open: 12, unattended: 3, unassigned: 4, pending: 1 };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'conversationStatistics',
        conversationType: 'account',
      },
      responses: [{ url: `${V2}/reports/conversations`, body: live }],
    });
    expect(calls[0].qs).toEqual({ type: 'account' });
    expect(output[0][0].json).toEqual(live);
  });

  it('conversation statistics (agent) paginates all agents and filters User ID client-side', async () => {
    // app/builders/v2/report_builder.rb#agent_metrics: 25 account users per page, root array
    const agentRow = (id: number) => ({
      id,
      name: `Agent ${id}`,
      email: `a${id}@acme.test`,
      thumbnail: '',
      availability: 'online',
      metric: { open: id, unattended: 0 },
    });
    const all = range(1, 27).map(agentRow);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'conversationStatistics',
        conversationType: 'agent',
        options: { user_id: 26 },
      },
      responses: [
        {
          url: `${V2}/reports/conversations`,
          times: 2,
          reply: (call) => ({ body: all.slice((pageOf(call) - 1) * 25, pageOf(call) * 25) }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([
      { type: 'agent', page: 1 },
      { type: 'agent', page: 2 },
    ]);
    expect(output[0].map((item) => item.json)).toEqual([agentRow(26)]);
  });

  it('conversation statistics maps legacy free-text types (inbox) to the agent list', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'conversationStatistics',
        conversationType: 'inbox',
      },
      responses: [{ url: `${V2}/reports/conversations`, body: [] }],
    });
    expect(calls[0].qs).toEqual({ type: 'agent', page: 1 });
  });

  it('drilldown pages with per_page 100 until meta.total_count (v2, 4.16+)', async () => {
    // app/builders/v2/reports/drilldown_builder.rb#build + drilldown_record_serializer.rb
    const record = (n: number) => ({
      record_type: 'conversation',
      conversation: {
        id: 5000 + n,
        display_id: n,
        contact_id: 70,
        contact_name: 'Juan',
        inbox_id: 1,
        inbox_name: 'WhatsApp',
        assignee_id: 3,
        assignee_name: 'Ana',
        status: 'open',
        created_at: SINCE_TS + n,
        last_activity_at: SINCE_TS + n,
        last_message: null,
      },
      message: null,
      metric_value: 1800 + n,
      occurred_at: SINCE_TS + n,
      event_name: 'first_response',
    });
    const records = range(1, 130).map(record);
    const meta = (page: number) => ({
      metric: 'avg_first_response_time',
      record_type: 'message',
      bucket: { since: SINCE_TS, until: SINCE_TS + 86400 },
      current_page: page,
      per_page: 100,
      total_count: 130,
      conversation_count: 130,
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'drilldown',
        type: 'account',
        metric: 'avg_first_response_time',
        since: SINCE,
        until: UNTIL,
        bucketTimestamp: SINCE,
        returnAll: true,
        options: { group_by: 'day', timezone_offset: -6, business_hours: false },
      },
      responses: [
        {
          url: `${V2}/reports/drilldown`,
          times: 2,
          reply: (call) => ({
            body: {
              meta: meta(pageOf(call)),
              payload: records.slice((pageOf(call) - 1) * 100, pageOf(call) * 100),
            },
          }),
        },
      ],
    });
    expect(calls[0].url).toBe(`${V2}/reports/drilldown`);
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      group_by: 'day',
      timezone_offset: -6,
      business_hours: false,
      type: 'account',
      metric: 'avg_first_response_time',
      bucket_timestamp: SINCE_TS,
      per_page: 100,
      page: 1,
    });
    expect(calls[1].qs?.page).toBe(2);
    expect(output[0]).toHaveLength(130);
    expect(output[0][0].json).toEqual(record(1));
  });

  it('drilldown with a limit asks for per_page = limit and needs a bucket', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'drilldown',
        type: 'agent',
        metric: 'conversations_count',
        since: SINCE,
        until: UNTIL,
        bucketTimestamp: SINCE,
        limit: 2,
        options: { id: 3 },
      },
      responses: [
        {
          url: `${V2}/reports/drilldown`,
          body: {
            meta: { per_page: 2, total_count: 9 },
            payload: [{ record_type: 'conversation' }, { record_type: 'conversation' }],
          },
        },
      ],
    });
    expect(calls[0].qs).toMatchObject({ type: 'agent', id: 3, per_page: 2, page: 1 });
    expect(output[0]).toHaveLength(2);

    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'report',
        operation: 'drilldown',
        type: 'account',
        metric: 'conversations_count',
        since: SINCE,
        until: UNTIL,
      },
    });
    await expect(new Chatwoot().execute.call(mock.ctx)).rejects.toThrow('Bucket Start is required');
  });

  it('CSV report as binary file: text request, csv binary with Chatwoot file name', async () => {
    // app/views/api/v2/accounts/reports/agents.csv.erb
    const csv =
      'Reporting period 2026-09-01 to 2026-09-08\n\n' +
      'Agent name,Assigned conversations,Avg first response time,Avg resolution time,Avg customer waiting time,Resolution Count\n' +
      'Ana,12,5 Minutes,2 Hours,3 Minutes,10\n';
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'agentStatistics',
        since: SINCE,
        until: UNTIL,
        options: { business_hours: true },
      },
      responses: [
        { url: `${V2}/reports/agents`, body: csv, headers: { 'content-type': 'text/csv' } },
      ],
    });
    expect(calls[0].options.json).toBe(false);
    expect(calls[0].options.encoding).toBe('text');
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS, business_hours: true });
    expect(output[0]).toHaveLength(1);
    const item = output[0][0];
    expect(item.json).toEqual({
      fileName: 'agents_report.csv',
      mimeType: 'text/csv',
      fileSize: Buffer.byteLength(csv),
    });
    expect(item.binary?.data.mimeType).toBe('text/csv');
    expect(item.binary?.data.fileName).toBe('agents_report.csv');
    expect(Buffer.from(item.binary?.data.data ?? '', 'base64').toString('utf8')).toBe(csv);
    expect(item.pairedItem).toEqual({ item: 0 });
  });

  it('CSV report as parsed rows (inbox report has more values than headers)', async () => {
    // app/views/api/v2/accounts/reports/inboxes.csv.erb + reports_helper.rb#generate_inboxes_report
    const csv =
      'Reporting period 2026-09-01 to 2026-09-08\n\n' +
      'Inbox name,Inbox type,No. of conversations,Avg first response time,Avg resolution time\n' +
      'WhatsApp,API,20,4 Minutes,1 Hours,2 Minutes,18\n' +
      '"Web, ES",Website,3,,,,1\n';
    const { output } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'inboxStatistics',
        since: SINCE,
        until: UNTIL,
        csvOutput: 'rows',
      },
      responses: [{ url: `${V2}/reports/inboxes`, body: csv }],
    });
    expect(output[0].map((item) => item.json)).toEqual([
      {
        'Inbox name': 'WhatsApp',
        'Inbox type': 'API',
        'No. of conversations': '20',
        'Avg first response time': '4 Minutes',
        'Avg resolution time': '1 Hours',
        column_6: '2 Minutes',
        column_7: '18',
      },
      {
        'Inbox name': 'Web, ES',
        'Inbox type': 'Website',
        'No. of conversations': '3',
        'Avg first response time': '',
        'Avg resolution time': '',
        column_6: '',
        column_7: '1',
      },
    ]);
  });

  it('conversation traffic sends only days_before/timezone_offset (no date range)', async () => {
    // app/views/api/v2/accounts/reports/conversation_traffic.erb + heatmap_helper.rb
    const csv =
      'Timezone,America/Mexico_City\n\nStart of the hour,2026-09-06,2026-09-07\n00:00,1,0\n01:00,0,2\n';
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'conversationTraffic',
        csvOutput: 'rows',
        options: { days_before: 1, timezone_offset: -6 },
      },
      responses: [{ url: `${V2}/reports/conversation_traffic`, body: csv }],
    });
    expect(calls[0].qs).toEqual({ timezone_offset: -6, days_before: 1 });
    expect(output[0].map((item) => item.json)).toEqual([
      { 'Start of the hour': '00:00', '2026-09-06': '1', '2026-09-07': '0' },
      { 'Start of the hour': '01:00', '2026-09-06': '0', '2026-09-07': '2' },
    ]);
  });

  it('reporting events (Enterprise) filter by name/inbox/user and page with meta.total_pages', async () => {
    // app/views/api/v1/models/_reporting_event.json.jbuilder + reporting_events/index.json.jbuilder
    const event = (id: number) => ({
      id,
      name: 'first_response',
      value: 120.5,
      value_in_business_hours: 60,
      event_start_time: '2026-09-02T10:00:00.000Z',
      event_end_time: '2026-09-02T10:02:00.500Z',
      account_id: 1,
      inbox_id: 2,
      user_id: 3,
      conversation_id: 900,
      created_at: '2026-09-02T10:02:00.500Z',
      updated_at: '2026-09-02T10:02:00.500Z',
    });
    const events = range(1, 30).map(event);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'reportingEvents',
        since: SINCE,
        until: UNTIL,
        returnAll: true,
        options: { event_name: 'first_response', inbox_id: 2, user_id: 3 },
      },
      responses: [
        {
          url: `${V1}/reporting_events`,
          times: 2,
          reply: (call) => ({
            body: {
              payload: events.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              meta: { count: 30, current_page: pageOf(call), total_pages: 2 },
            },
          }),
        },
      ],
    });
    expect(calls[0].url).toBe(`${V1}/reporting_events`);
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      inbox_id: 2,
      user_id: 3,
      name: 'first_response',
      page: 1,
    });
    expect(calls).toHaveLength(2);
    expect(output[0]).toHaveLength(30);
    expect(output[0][29].json).toEqual(event(30));
  });

  it('conversation reporting events (Enterprise) returns one item per event', async () => {
    const events = [
      { id: 1, name: 'first_response', value: 60, conversation_id: 900 },
      { id: 2, name: 'conversation_resolved', value: 3600, conversation_id: 900 },
    ];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'report', operation: 'conversationReportingEvents', conversationId: 42 },
      responses: [{ method: 'GET', url: `${V1}/conversations/42/reporting_events`, body: events }],
    });
    expect(calls[0].qs).toBeUndefined();
    expect(output[0].map((item) => item.json)).toEqual(events);
  });
});

// ============================================================================
// Audit Log
// ============================================================================

describe('auditLog getAll', () => {
  it('reads audit_logs, pages to total_entries and sends the 4.17+ filters', async () => {
    const ids = range(1, 26);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'auditLog',
        operation: 'getAll',
        returnAll: true,
        filters: {
          types: ['Inbox', 'Macro'],
          auditable_type: 'Team',
          q: 'ana@',
          since: SINCE,
          until: UNTIL,
          sort: 'asc',
        },
      },
      responses: [
        {
          method: 'GET',
          url: `${V1}/audit_logs`,
          times: 2,
          reply: (call) => ({
            body: auditLogPage(
              ids.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              26,
              pageOf(call),
            ),
          }),
        },
      ],
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].queryString).toBe(
      `types[]=Inbox&types[]=Macro&types[]=Team&q=ana@&since=${SINCE_TS}&until=${UNTIL_TS}&sort=asc&page=1`,
    );
    expect(output[0]).toHaveLength(26);
    expect(output[0][0].json).toEqual(auditLog(1));
  });

  it('Limit fetches more than one page when needed', async () => {
    const ids = range(1, 60);
    const { output, calls } = await runChatwootNode({
      params: { resource: 'auditLog', operation: 'getAll', limit: 30 },
      responses: [
        {
          url: `${V1}/audit_logs`,
          times: 2,
          reply: (call) => ({
            body: auditLogPage(
              ids.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              60,
              pageOf(call),
            ),
          }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0]).toHaveLength(30);
  });

  it('User ID is filtered client-side across pages', async () => {
    const ids = range(1, 30);
    const userOf = (id: number) => (id % 10 === 0 ? 7 : 1);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'auditLog',
        operation: 'getAll',
        returnAll: true,
        filters: { user_id: 7 },
      },
      responses: [
        {
          url: `${V1}/audit_logs`,
          times: 2,
          reply: (call) => ({
            body: auditLogPage(
              ids.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              30,
              pageOf(call),
              userOf,
            ),
          }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0].map((item) => item.json.id)).toEqual([10, 20, 30]);
  });

  it('an empty list (feature disabled) gives no items', async () => {
    const { output } = await runChatwootNode({
      params: { resource: 'auditLog', operation: 'getAll', returnAll: true },
      responses: [{ url: `${V1}/audit_logs`, body: auditLogPage([], 0, 1) }],
    });
    expect(output[0]).toEqual([]);
  });
});

// ============================================================================
// CSAT Survey
// ============================================================================

describe('csatSurvey', () => {
  it('Get by Conversation scans newest first and returns only that conversation (INSIGHT-3)', async () => {
    const pages = [
      range(1, 25).map((n) => csatResponse(100 - n, 500 + n)),
      [csatResponse(60, 777, 2), csatResponse(59, 12)],
    ];
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'csatSurvey',
        operation: 'get',
        conversationId: 777,
        options: { since: SINCE, until: UNTIL },
      },
      responses: [
        {
          url: `${V1}/csat_survey_responses`,
          times: 2,
          reply: (call) => ({ body: pages[pageOf(call) - 1] }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([
      { since: SINCE_TS, until: UNTIL_TS, sort: '-created_at', page: 1 },
      { since: SINCE_TS, until: UNTIL_TS, sort: '-created_at', page: 2 },
    ]);
    expect(calls[0].qs).not.toHaveProperty('conversation_id');
    expect(output[0].map((item) => item.json)).toEqual([csatResponse(60, 777, 2)]);
  });

  it('Get by Conversation outputs nothing when the conversation has no CSAT response', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'csatSurvey', operation: 'get', conversationId: 9 },
      responses: [{ url: `${V1}/csat_survey_responses`, body: [csatResponse(1, 5)] }],
    });
    expect(calls).toHaveLength(1);
    expect(output[0]).toEqual([]);
  });

  it('Get Many sends user_ids[]/rating[]/inbox/team filters and paginates (25 per page)', async () => {
    const all = range(1, 30).map((n) => csatResponse(n, 600 + n, 1));
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'csatSurvey',
        operation: 'getAll',
        limit: 27,
        options: {
          user_ids: '3, 4',
          rating: ['1', '2'],
          inbox_id: 2,
          team_id: 5,
          since: SINCE,
          until: UNTIL,
        },
      },
      responses: [
        {
          url: `${V1}/csat_survey_responses`,
          times: 2,
          reply: (call) => ({ body: all.slice((pageOf(call) - 1) * 25, pageOf(call) * 25) }),
        },
      ],
    });
    expect(calls[0].queryString).toBe(
      `since=${SINCE_TS}&until=${UNTIL_TS}&user_ids[]=3&user_ids[]=4&inbox_id=2&team_id=5&rating[]=1&rating[]=2&sort=-created_at&page=1`,
    );
    expect(calls).toHaveLength(2);
    expect(output[0]).toHaveLength(27);
    expect(output[0][26].json).toEqual(all[26]);
  });

  it('Metrics sends the same filters', async () => {
    // app/views/api/v1/accounts/csat_survey_responses/metrics.json.jbuilder
    const metrics = {
      total_count: 10,
      ratings_count: { '1': 2, '5': 8 },
      total_sent_messages_count: 25,
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'csatSurvey',
        operation: 'metrics',
        options: { since: SINCE, until: UNTIL, team_id: 5 },
      },
      responses: [{ url: `${V1}/csat_survey_responses/metrics`, body: metrics }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS, team_id: 5 });
    expect(output[0][0].json).toEqual(metrics);
  });

  it('Download requires a date range and outputs parsed rows', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'csatSurvey', operation: 'download' },
    });
    await expect(new Chatwoot().execute.call(mock.ctx)).rejects.toThrow(
      'CSAT Download requires Options → Since and Until',
    );
    expect(mock.calls).toHaveLength(0);

    // app/views/api/v1/accounts/csat_survey_responses/download.csv.erb (enterprise adds Review Notes).
    // CSVSafe prefixes cells starting with = + - @ with a quote (CSV injection guard).
    const csv =
      'Agent Name,Rating,Feedback Comment,Contact Name,Contact Email Address,Contact Phone Number,Link to the conversation,Recorded date,Review Notes\n' +
      '\n' +
      'Ana (ana@acme.test),5,"Muy bien, gracias",Juan,,\'+5215512345678,https://chatwoot.test/app/accounts/1/conversations/42,2026-09-02 10:00:00 UTC,\'=review\n' +
      'Reporting period 2026-09-01 to 2026-09-08\n';
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'csatSurvey',
        operation: 'download',
        csvOutput: 'rows',
        options: { since: SINCE, until: UNTIL, rating: ['5'] },
      },
      responses: [{ url: `${V1}/csat_survey_responses/download`, body: csv }],
    });
    expect(calls[0].options.encoding).toBe('text');
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      rating: ['5'],
      sort: '-created_at',
    });
    expect(output[0].map((item) => item.json)).toEqual([
      {
        'Agent Name': 'Ana (ana@acme.test)',
        Rating: '5',
        'Feedback Comment': 'Muy bien, gracias',
        'Contact Name': 'Juan',
        'Contact Email Address': '',
        'Contact Phone Number': '+5215512345678',
        'Link to the conversation': 'https://chatwoot.test/app/accounts/1/conversations/42',
        'Recorded date': '2026-09-02 10:00:00 UTC',
        'Review Notes': '=review',
      },
    ]);
  });

  it('Update Review Notes (Enterprise) PATCHes csat_review_notes', async () => {
    const updated = { ...csatResponse(8, 42), csat_review_notes: 'Called the customer back' };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'csatSurvey',
        operation: 'updateReviewNotes',
        csatResponseId: 8,
        reviewNotes: 'Called the customer back',
      },
      responses: [{ method: 'PATCH', url: `${V1}/csat_survey_responses/8`, body: updated }],
    });
    expect(calls[0].body).toEqual({ csat_review_notes: 'Called the customer back' });
    expect(output[0][0].json).toEqual(updated);
  });
});

// ============================================================================
// Applied SLA / SLA Policy
// ============================================================================

describe('appliedSla', () => {
  it('Get Many sends label_list and paginates rows without ids until meta.count', async () => {
    const rows = range(1, 27).map(appliedSlaRow);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'appliedSla',
        operation: 'getAll',
        returnAll: true,
        options: {
          label_list: ' billing ',
          sla_policy_id: 2,
          assigned_agent_id: 3,
          since: SINCE,
          until: UNTIL,
        },
      },
      responses: [
        {
          url: `${V1}/applied_slas`,
          times: 2,
          reply: (call) => ({
            body: {
              payload: rows.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              meta: { count: 27, current_page: String(pageOf(call)) },
            },
          }),
        },
      ],
    });
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      sla_policy_id: 2,
      assigned_agent_id: 3,
      label_list: 'billing',
      page: 1,
    });
    expect(calls).toHaveLength(2);
    expect(output[0]).toHaveLength(27);
    expect(output[0][0].json).toEqual(rows[0]);
  });

  it('Metrics sends the filters', async () => {
    const metrics = { total_applied_slas: 40, number_of_sla_misses: 4, hit_rate: '90.0%' };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'appliedSla',
        operation: 'metrics',
        options: { inbox_id: 1, label_list: 'vip' },
      },
      responses: [{ url: `${V1}/applied_slas/metrics`, body: metrics }],
    });
    expect(calls[0].qs).toEqual({ inbox_id: 1, label_list: 'vip' });
    expect(output[0][0].json).toEqual(metrics);
  });

  it('Download outputs the breached conversations CSV as a binary file', async () => {
    // enterprise/app/views/api/v1/accounts/applied_slas/download.csv.erb
    const csv =
      'Conversation ID,SLA Policy,Assignee,Team,Inbox,Labels,Link to the Conversation,Breached Events\n\n' +
      '  42,Premium,Ana,Support,WhatsApp,"billing,vip",https://chatwoot.test/app/accounts/1/conversations/42,frt\n';
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'appliedSla',
        operation: 'download',
        binaryPropertyName: 'report',
        options: { team_id: 5 },
      },
      responses: [{ url: `${V1}/applied_slas/download`, body: csv }],
    });
    expect(calls[0].qs).toEqual({ team_id: 5 });
    expect(calls[0].options.encoding).toBe('text');
    expect(output[0][0].json.fileName).toBe('breached_conversation.csv');
    expect(Buffer.from(output[0][0].binary?.report.data ?? '', 'base64').toString('utf8')).toBe(
      csv,
    );
  });

  it('a disabled SLA feature (401) is reported with the SLA hint', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'appliedSla', operation: 'metrics' },
      responses: [
        {
          url: `${V1}/applied_slas/metrics`,
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    });
    expect(output[0][0].json).toMatchObject({
      error: 'Chatwoot API error 401 Unauthorized: You are not authorized to do this action',
      httpCode: '401',
    });
    expect(output[0][0].json.description).toContain('SLA feature');
  });
});

describe('slaPolicy getAll', () => {
  it('unwraps payload into one item per policy', async () => {
    // enterprise/app/views/api/v1/accounts/sla_policies/index.json.jbuilder
    const policies = [
      {
        id: 1,
        name: 'Premium',
        description: 'VIP',
        first_response_time_threshold: 3600,
        next_response_time_threshold: 7200,
        resolution_time_threshold: 86400,
        only_during_business_hours: false,
      },
      {
        id: 2,
        name: 'Standard',
        description: null,
        first_response_time_threshold: 14400,
        next_response_time_threshold: null,
        resolution_time_threshold: null,
        only_during_business_hours: true,
      },
    ];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'slaPolicy', operation: 'getAll' },
      responses: [{ method: 'GET', url: `${V1}/sla_policies`, body: { payload: policies } }],
    });
    expect(calls[0].url).toBe(`${V1}/sla_policies`);
    expect(output[0].map((item) => item.json)).toEqual(policies);
  });
});

// ============================================================================
// Company
// ============================================================================

describe('company', () => {
  it('Get Many sorts by -last_activity_at and pages with meta.total_count', async () => {
    const all = range(1, 30).map(company);
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'company',
        operation: 'getAll',
        limit: 28,
        options: { sort: 'last_activity_at', direction: 'desc' },
      },
      responses: [
        {
          url: `${V1}/companies`,
          times: 2,
          reply: (call) => ({
            body: {
              meta: { total_count: 30, page: String(pageOf(call)) },
              payload: all.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
            },
          }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([
      { sort: '-last_activity_at', page: 1 },
      { sort: '-last_activity_at', page: 2 },
    ]);
    expect(output[0]).toHaveLength(28);
  });

  it('Create wraps the body under company with custom/additional attributes', async () => {
    const created = { payload: company(9) };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'company',
        operation: 'create',
        name: 'Acme 9',
        additionalFields: {
          domain: 'acme9.test',
          custom_attributes: '{"plan":"enterprise","seats":25}',
          additional_attributes: { industry: 'retail' },
        },
      },
      responses: [{ method: 'POST', url: `${V1}/companies`, body: created }],
    });
    expect(calls[0].body).toEqual({
      company: {
        name: 'Acme 9',
        domain: 'acme9.test',
        custom_attributes: { plan: 'enterprise', seats: 25 },
        additional_attributes: { industry: 'retail' },
      },
    });
    expect(output[0][0].json).toEqual(created);
  });

  it('Update sends custom_attributes (merged by Chatwoot) and rejects an empty update', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'company',
        operation: 'update',
        companyId: 9,
        updateFields: { custom_attributes: '{"seats":30}' },
      },
      responses: [{ method: 'PATCH', url: `${V1}/companies/9`, body: { payload: company(9) } }],
    });
    expect(calls[0].body).toEqual({ company: { custom_attributes: { seats: 30 } } });

    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'company',
        operation: 'update',
        companyId: 9,
        updateFields: { custom_attributes: '[1]' },
      },
    });
    await expect(new Chatwoot().execute.call(mock.ctx)).rejects.toThrow('must be a JSON object');
  });

  it('Get Contacts pages 15 at a time and Search Contacts sends q', async () => {
    // enterprise/app/views/api/v1/accounts/companies/contacts/index.json.jbuilder
    const contact = (id: number) => ({
      id,
      name: `Contact ${id}`,
      phone_number: '+5215512345678',
      company_id: 9,
      linked_to_current_company: true,
      company: company(9),
    });
    const all = range(1, 16).map(contact);
    const { output, calls } = await runChatwootNode({
      params: { resource: 'company', operation: 'getContacts', companyId: 9, returnAll: true },
      responses: [
        {
          url: `${V1}/companies/9/contacts`,
          times: 2,
          reply: (call) => ({
            body: {
              meta: { total_count: 16, page: pageOf(call) },
              payload: all.slice((pageOf(call) - 1) * 15, pageOf(call) * 15),
            },
          }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0]).toHaveLength(16);

    const search = await runChatwootNode({
      params: {
        resource: 'company',
        operation: 'searchContacts',
        companyId: 9,
        query: 'juan',
        limit: 5,
      },
      responses: [
        {
          url: `${V1}/companies/9/contacts/search`,
          body: {
            meta: { total_count: 1, page: 1 },
            payload: [
              { ...contact(40), company_id: null, linked_to_current_company: false, company: null },
            ],
          },
        },
      ],
    });
    expect(search.calls[0].qs).toEqual({ q: 'juan', page: 1 });
    expect(search.output[0][0].json.linked_to_current_company).toBe(false);
  });

  it('Add Contact posts contact_id and Remove Contact deletes the membership', async () => {
    const added = await runChatwootNode({
      params: { resource: 'company', operation: 'addContact', companyId: 9, contactId: 40 },
      responses: [
        {
          method: 'POST',
          url: `${V1}/companies/9/contacts`,
          body: { payload: { id: 40, company_id: 9 } },
        },
      ],
    });
    expect(added.calls[0].body).toEqual({ contact_id: 40 });
    expect(added.output[0][0].json).toEqual({ payload: { id: 40, company_id: 9 } });

    const removed = await runChatwootNode({
      params: { resource: 'company', operation: 'removeContact', companyId: 9, contactId: 40 },
      responses: [{ method: 'DELETE', url: `${V1}/companies/9/contacts/40` }],
    });
    expect(removed.calls[0].body).toBeUndefined();
    expect(removed.output[0][0].json).toEqual({ success: true, companyId: 9, contactId: 40 });
  });

  it('Get Conversations / Get Notes unwrap payload', async () => {
    const conversations = [
      { id: 42, status: 'open' },
      { id: 43, status: 'resolved' },
    ];
    const conv = await runChatwootNode({
      params: { resource: 'company', operation: 'getConversations', companyId: 9 },
      responses: [{ url: `${V1}/companies/9/conversations`, body: { payload: conversations } }],
    });
    expect(conv.output[0].map((item) => item.json)).toEqual(conversations);

    // enterprise/app/views/api/v1/accounts/companies/notes/index.json.jbuilder
    const notes = [
      { id: 1, content: 'Renewal in March', created_at: 1788300000, contact: { id: 40 } },
    ];
    const noteRun = await runChatwootNode({
      params: { resource: 'company', operation: 'getNotes', companyId: 9 },
      responses: [{ url: `${V1}/companies/9/notes`, body: { payload: notes } }],
    });
    expect(noteRun.calls[0].method).toBe('GET');
    expect(noteRun.output[0].map((item) => item.json)).toEqual(notes);
  });

  it('Delete Custom Attributes posts the keys; Delete Avatar calls DELETE avatar', async () => {
    const del = await runChatwootNode({
      params: {
        resource: 'company',
        operation: 'deleteCustomAttributes',
        companyId: 9,
        customAttributeKeys: 'plan, seats',
      },
      responses: [
        {
          method: 'POST',
          url: `${V1}/companies/9/destroy_custom_attributes`,
          body: { payload: company(9) },
        },
      ],
    });
    expect(del.calls[0].body).toEqual({ custom_attributes: ['plan', 'seats'] });

    const avatar = await runChatwootNode({
      params: { resource: 'company', operation: 'deleteAvatar', companyId: 9 },
      responses: [
        { method: 'DELETE', url: `${V1}/companies/9/avatar`, body: { payload: company(9) } },
      ],
    });
    expect(avatar.output[0][0].json).toEqual({ payload: company(9) });
  });

  it('a disabled companies feature (403) surfaces Chatwoot message and hint', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: { resource: 'company', operation: 'get', companyId: 9 },
      responses: [
        {
          url: `${V1}/companies/9`,
          status: 403,
          body: { error: 'Companies are not enabled for this account' },
        },
      ],
    });
    const promise = new Chatwoot().execute.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeApiError);
    await expect(promise).rejects.toThrow(
      'Chatwoot API error 403 Forbidden: Companies are not enabled for this account',
    );
  });
});

// ============================================================================
// Help Center
// ============================================================================

describe('helpCenter articles', () => {
  it('Create Article defaults the author to the token owner (notification_settings.user_id)', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'createArticle',
        portalSlug: 'acme-help',
        title: 'Cómo pagar',
        content: 'Texto',
        additionalFields: {
          category_id: 4,
          locale: 'es',
          meta_title: 'Pagar',
          meta_tags: 'pagos, factura',
        },
      },
      responses: [
        {
          method: 'GET',
          url: `${V1}/notification_settings`,
          // app/views/api/v1/accounts/notification_settings/show.json.jbuilder
          body: {
            id: 11,
            user_id: 3,
            account_id: 1,
            selected_email_flags: [],
            selected_push_flags: [],
          },
        },
        { method: 'POST', url: `${V1}/portals/acme-help/articles`, body: { payload: article(20) } },
      ],
    });
    expect(calls.map((call) => `${call.method} ${call.endpoint}`)).toEqual([
      'GET /notification_settings',
      'POST /portals/acme-help/articles',
    ]);
    expect(calls[1].body).toEqual({
      article: {
        title: 'Cómo pagar',
        content: 'Texto',
        locale: 'es',
        category_id: 4,
        author_id: 3,
        meta: { title: 'Pagar', tags: ['pagos', 'factura'] },
      },
    });
    expect(output[0][0].json).toEqual({ payload: article(20) });
  });

  it('Create Article uses the given author and never sends 0', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'createArticle',
        portalSlug: 'acme-help',
        title: 'T',
        content: 'C',
        additionalFields: { author_id: 5, associated_article_id: 0, status: 'published' },
      },
      responses: [
        { method: 'POST', url: `${V1}/portals/acme-help/articles`, body: { payload: article(21) } },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      article: { title: 'T', content: 'C', status: 'published', author_id: 5 },
    });
  });

  it('Update Article merges meta into the current one; draft-only edits are sent as-is', async () => {
    const current = {
      payload: article(20, { meta: { title: 'Old', description: 'Desc', tags: ['a'] } }),
    };
    const { calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updateArticle',
        portalSlug: 'acme-help',
        articleId: 20,
        updateFields: { meta_title: 'New', status: 'published' },
      },
      responses: [
        { method: 'GET', url: `${V1}/portals/acme-help/articles/20`, body: current },
        { method: 'PATCH', url: `${V1}/portals/acme-help/articles/20`, body: current },
      ],
    });
    expect(calls[1].body).toEqual({
      article: { status: 'published', meta: { title: 'New', description: 'Desc', tags: ['a'] } },
    });

    const draft = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updateArticle',
        portalSlug: 'acme-help',
        articleId: 20,
        updateFields: { draft_title: 'Nuevo título', draft_content: 'Nuevo texto' },
      },
      responses: [{ method: 'PATCH', url: `${V1}/portals/acme-help/articles/20`, body: current }],
    });
    expect(draft.calls[0].body).toEqual({
      article: { draft_title: 'Nuevo título', draft_content: 'Nuevo texto' },
    });
  });

  it('Get / Delete Article', async () => {
    const got = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'getArticle',
        portalSlug: 'acme-help',
        articleId: 20,
      },
      responses: [
        {
          method: 'GET',
          url: `${V1}/portals/acme-help/articles/20`,
          body: { payload: article(20) },
        },
      ],
    });
    expect(got.output[0][0].json).toEqual({ payload: article(20) });

    const deleted = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'deleteArticle',
        portalSlug: 'acme-help',
        articleId: 20,
      },
      responses: [{ method: 'DELETE', url: `${V1}/portals/acme-help/articles/20` }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 20 });
  });

  it('List Articles sends query/author_id and pages', async () => {
    const all = range(1, 27).map((n) => article(n));
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'listArticles',
        portalSlug: 'acme-help',
        returnAll: true,
        options: { locale: 'es', status: 'published', query: 'factura', author_id: 3 },
      },
      responses: [
        {
          url: `${V1}/portals/acme-help/articles`,
          times: 2,
          reply: (call) => ({
            body: {
              payload: all.slice((pageOf(call) - 1) * 25, pageOf(call) * 25),
              meta: { articles_count: 27, current_page: String(pageOf(call)) },
            },
          }),
        },
      ],
    });
    expect(calls[0].qs).toEqual({
      locale: 'es',
      status: 'published',
      query: 'factura',
      author_id: 3,
      page: 1,
    });
    expect(output[0]).toHaveLength(27);
  });

  it('bulk actions (4.14+): update_status, update_category and delete_articles', async () => {
    const status = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'bulkUpdateArticleStatus',
        portalSlug: 'acme-help',
        articleIds: '1, 2',
        bulkStatus: 'archived',
      },
      responses: [
        { method: 'PATCH', url: `${V1}/portals/acme-help/articles/bulk_actions/update_status` },
      ],
    });
    expect(status.calls[0].body).toEqual({ ids: [1, 2], status: 'archived' });
    expect(status.output[0][0].json).toEqual({ success: true, ids: [1, 2], status: 'archived' });

    const move = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'bulkUpdateArticleCategory',
        portalSlug: 'acme-help',
        articleIds: '3',
        bulkCategoryId: 4,
      },
      responses: [
        { method: 'PATCH', url: `${V1}/portals/acme-help/articles/bulk_actions/update_category` },
      ],
    });
    expect(move.calls[0].body).toEqual({ ids: [3], category_id: 4 });

    const del = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'bulkDeleteArticles',
        portalSlug: 'acme-help',
        articleIds: '5,6',
      },
      responses: [
        { method: 'DELETE', url: `${V1}/portals/acme-help/articles/bulk_actions/delete_articles` },
      ],
    });
    expect(del.calls[0].body).toEqual({ ids: [5, 6] });
    expect(del.calls[0].headers['Content-Type']).toBe('application/json');
    expect(del.output[0][0].json).toEqual({ success: true, ids: [5, 6] });
  });
});

describe('helpCenter categories', () => {
  it('Create / Update / Get / Delete Category wrap fields under category', async () => {
    const created = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'createCategory',
        portalSlug: 'acme-help',
        name: 'Pagos',
        slug: 'pagos',
        locale: 'es',
        additionalFields: {
          icon: '💳',
          icon_color: '#FF0000',
          parent_category_id: 2,
          related_category_ids: '5, 6',
        },
      },
      responses: [
        {
          method: 'POST',
          url: `${V1}/portals/acme-help/categories`,
          body: { payload: category(7) },
        },
      ],
    });
    expect(created.calls[0].body).toEqual({
      category: {
        icon: '💳',
        icon_color: '#FF0000',
        parent_category_id: 2,
        related_category_ids: [5, 6],
        name: 'Pagos',
        slug: 'pagos',
        locale: 'es',
      },
    });

    const updated = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updateCategory',
        portalSlug: 'acme-help',
        categoryId: 7,
        updateFields: { name: 'Pagos y facturas', position: 2 },
      },
      responses: [
        {
          method: 'PATCH',
          url: `${V1}/portals/acme-help/categories/7`,
          body: { payload: category(7) },
        },
      ],
    });
    expect(updated.calls[0].body).toEqual({ category: { name: 'Pagos y facturas', position: 2 } });

    const got = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'getCategory',
        portalSlug: 'acme-help',
        categoryId: 7,
      },
      responses: [
        {
          method: 'GET',
          url: `${V1}/portals/acme-help/categories/7`,
          body: { payload: category(7) },
        },
      ],
    });
    expect(got.output[0][0].json).toEqual({ payload: category(7) });

    const deleted = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'deleteCategory',
        portalSlug: 'acme-help',
        categoryId: 7,
      },
      responses: [{ method: 'DELETE', url: `${V1}/portals/acme-help/categories/7` }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 7 });
  });

  it('List Categories returns one item per category and no locale filter by default', async () => {
    const categories = [category(1, 'es'), category(2, 'en')];
    const { output, calls } = await runChatwootNode({
      params: { resource: 'helpCenter', operation: 'listCategories', portalSlug: 'acme-help' },
      responses: [
        {
          url: `${V1}/portals/acme-help/categories`,
          body: { payload: categories, meta: { current_page: 1, categories_count: 2 } },
        },
      ],
    });
    expect(calls[0].qs).toBeUndefined();
    expect(output[0].map((item) => item.json)).toEqual(categories);
  });
});

describe('helpCenter portals', () => {
  it('Create Portal sends config and the top-level inbox_id', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'createPortal',
        name: 'Acme Help',
        slug: 'acme-help',
        additionalFields: {
          color: '#112233',
          default_locale: 'es',
          allowed_locales: 'es, en',
          layout: 'documentation',
          social_profiles: '{"whatsapp":"https://wa.me/5215512345678"}',
          inbox_id: 4,
        },
      },
      responses: [{ method: 'POST', url: `${V1}/portals`, body: portal() }],
    });
    expect(calls[0].body).toEqual({
      portal: {
        color: '#112233',
        name: 'Acme Help',
        slug: 'acme-help',
        config: {
          default_locale: 'es',
          allowed_locales: ['es', 'en'],
          layout: 'documentation',
          social_profiles: { whatsapp: 'https://wa.me/5215512345678' },
        },
      },
      inbox_id: 4,
    });
  });

  it('Update Portal merges config changes into the current config', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updatePortal',
        portalSlug: 'acme-help',
        updateFields: { header_text: 'Centro de ayuda', layout: 'classic', draft_locales: '' },
      },
      responses: [
        { method: 'GET', url: `${V1}/portals/acme-help`, body: portal() },
        { method: 'PATCH', url: `${V1}/portals/acme-help`, body: portal({ layout: 'classic' }) },
      ],
    });
    expect(calls[1].body).toEqual({
      portal: {
        header_text: 'Centro de ayuda',
        config: {
          allowed_locales: ['es', 'en'],
          draft_locales: [],
          default_locale: 'es',
          layout: 'classic',
          social_profiles: { facebook: 'https://facebook.com/acme' },
          popular_content: { es: { category_ids: [4], article_ids: [] } },
        },
      },
    });
    expect(output[0][0].json).toEqual(portal({ layout: 'classic' }));
  });

  it('Update Portal without config changes does not read the portal first', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updatePortal',
        portalSlug: 'acme-help',
        updateFields: { archived: true },
      },
      responses: [{ method: 'PATCH', url: `${V1}/portals/acme-help`, body: portal() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ portal: { archived: true } });
  });

  it('List Portals unwraps payload; Delete Portal answers success', async () => {
    const list = await runChatwootNode({
      params: { resource: 'helpCenter', operation: 'listPortals' },
      responses: [
        {
          url: `${V1}/portals`,
          body: { payload: [portal()], meta: { current_page: 1, portals_count: 1 } },
        },
      ],
    });
    expect(list.output[0].map((item) => item.json)).toEqual([portal()]);

    const del = await runChatwootNode({
      params: { resource: 'helpCenter', operation: 'deletePortal', portalSlug: 'acme-help' },
      responses: [{ method: 'DELETE', url: `${V1}/portals/acme-help` }],
    });
    expect(del.output[0][0].json).toEqual({ success: true, portalSlug: 'acme-help' });
  });

  it('an empty Portal Slug fails before any request', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'helpCenter', operation: 'getPortal', portalSlug: '  ' },
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json.error).toBe('Portal Slug must not be empty');
  });
});

describe('errors keep their type', () => {
  it('validation errors are NodeOperationErrors with the item index', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      params: {
        resource: 'helpCenter',
        operation: 'bulkDeleteArticles',
        portalSlug: 'acme-help',
        articleIds: 'x',
      },
    });
    const promise = new Chatwoot().execute.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeOperationError);
    await expect(promise).rejects.toThrow(
      'Article IDs must be a comma-separated list of positive integer IDs',
    );
  });
});

// ============================================================================
// Remaining changed operations
// ============================================================================

describe('report (other operations)', () => {
  it('account summary for one agent sends type, id and the period options', async () => {
    // V2::Reports::Conversations::MetricBuilder#summary + previous period
    const summary = {
      conversations_count: 10,
      incoming_messages_count: 40,
      outgoing_messages_count: 35,
      avg_first_response_time: 300,
      avg_resolution_time: 7200,
      resolutions_count: 8,
      reply_time: 240,
      previous: { conversations_count: 7 },
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'accountSummary',
        type: 'agent',
        since: SINCE,
        until: UNTIL,
        options: { id: 3, business_hours: false, timezone_offset: 5.5 },
      },
      responses: [{ url: `${V2}/reports/summary`, body: summary }],
    });
    expect(calls[0].qs).toEqual({
      since: SINCE_TS,
      until: UNTIL_TS,
      id: 3,
      timezone_offset: 5.5,
      business_hours: false,
      type: 'agent',
    });
    expect(output[0][0].json).toEqual(summary);
  });

  it('bot summary for a label', async () => {
    const summary = {
      bot_resolutions_count: 3,
      bot_handoffs_count: 2,
      previous: { bot_resolutions_count: 1, bot_handoffs_count: 0 },
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'botSummary',
        type: 'label',
        since: SINCE,
        until: UNTIL,
        options: { id: 5 },
      },
      responses: [{ url: `${V2}/reports/bot_summary`, body: summary }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS, id: 5, type: 'label' });
    expect(output[0][0].json).toEqual(summary);
  });

  it('first response time distribution only sends the date range', async () => {
    // app/builders/v2/reports/first_response_time_distribution_builder.rb
    const distribution = {
      'Channel::Api': { '0-1h': 4, '1-4h': 1, '4-8h': 0, '8-24h': 0, '24h+': 1 },
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'firstResponseTimeDistribution',
        since: SINCE,
        until: UNTIL,
      },
      responses: [{ url: `${V2}/reports/first_response_time_distribution`, body: distribution }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS });
    expect(output[0][0].json).toEqual(distribution);
  });

  it('year in review and conversation counts keep their endpoints', async () => {
    const year = await runChatwootNode({
      params: { resource: 'report', operation: 'yearInReview', year: 2026 },
      responses: [{ url: `${V2}/year_in_review`, body: { year: 2026, conversations_count: 1200 } }],
    });
    expect(year.calls[0].qs).toEqual({ year: 2026 });
    expect(year.output[0][0].json).toEqual({ year: 2026, conversations_count: 1200 });

    const counts = await runChatwootNode({
      params: { resource: 'report', operation: 'conversationCounts' },
      responses: [
        {
          url: `${V1}/conversations/meta`,
          body: { meta: { mine_count: 1, assigned_count: 2, unassigned_count: 3, all_count: 5 } },
        },
      ],
    });
    expect(counts.calls[0].url).toBe(`${V1}/conversations/meta`);
    expect(counts.output[0][0].json).toEqual({
      meta: { mine_count: 1, assigned_count: 2, unassigned_count: 3, all_count: 5 },
    });
  });

  it.each([
    ['agentStatistics', '/reports/agents', 'agents_report.csv'],
    ['inboxStatistics', '/reports/inboxes', 'inboxes_report.csv'],
    ['labelStatistics', '/reports/labels', 'labels_report.csv'],
    ['teamStatistics', '/reports/teams', 'teams_report.csv'],
    ['conversationsSummary', '/reports/conversations_summary', 'conversations_summary_report.csv'],
  ])('%s downloads %s as %s', async (operation, endpoint, fileName) => {
    const csv = 'Reporting period 2026-09-01 to 2026-09-08\n\nName,Count\nX,1\n';
    const { output, calls } = await runChatwootNode({
      params: { resource: 'report', operation, since: SINCE, until: UNTIL },
      responses: [{ method: 'GET', url: `${V2}${endpoint}`, body: csv }],
    });
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS });
    expect(calls[0].options.encoding).toBe('text');
    expect(output[0][0].json.fileName).toBe(fileName);
    expect(output[0][0].binary?.data.fileName).toBe(fileName);
  });
});

describe('company (other operations)', () => {
  it('Search pages with meta.total_count; Get and Delete', async () => {
    const found = [company(1), company(2)];
    const search = await runChatwootNode({
      params: { resource: 'company', operation: 'search', query: 'acme', returnAll: true },
      responses: [
        {
          url: `${V1}/companies/search`,
          body: { meta: { total_count: 2, page: 1 }, payload: found },
        },
      ],
    });
    expect(search.calls[0].qs).toEqual({ q: 'acme', page: 1 });
    expect(search.output[0].map((item) => item.json)).toEqual(found);

    const got = await runChatwootNode({
      params: { resource: 'company', operation: 'get', companyId: 1 },
      responses: [{ method: 'GET', url: `${V1}/companies/1`, body: { payload: company(1) } }],
    });
    expect(got.output[0][0].json).toEqual({ payload: company(1) });

    const deleted = await runChatwootNode({
      params: { resource: 'company', operation: 'delete', companyId: 1 },
      responses: [{ method: 'DELETE', url: `${V1}/companies/1` }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 1 });
  });
});

describe('helpCenter (other operations)', () => {
  it('Get Portal reads by slug', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'helpCenter', operation: 'getPortal', portalSlug: 'acme-help' },
      responses: [{ method: 'GET', url: `${V1}/portals/acme-help`, body: portal() }],
    });
    expect(calls[0].url).toBe(`${V1}/portals/acme-help`);
    expect(output[0][0].json).toEqual(portal());
  });

  it('List Categories filters by locale when set', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'listCategories',
        portalSlug: 'acme-help',
        locale: 'es',
      },
      responses: [{ url: `${V1}/portals/acme-help/categories`, body: { payload: [], meta: {} } }],
    });
    expect(calls[0].qs).toEqual({ locale: 'es' });
  });

  it('Update Article / Update Category need at least one field', async () => {
    const article = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'helpCenter',
        operation: 'updateArticle',
        portalSlug: 'acme-help',
        articleId: 1,
      },
    });
    expect(article.calls).toHaveLength(0);
    expect(article.output[0][0].json.error).toBe('Update Fields: set at least one field to update');

    const categoryRun = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'helpCenter',
        operation: 'updateCategory',
        portalSlug: 'acme-help',
        categoryId: 1,
      },
    });
    expect(categoryRun.calls).toHaveLength(0);
    expect(categoryRun.output[0][0].json.error).toBe(
      'Update Fields: set at least one field to update',
    );
  });

  it('Create Article explains how to fix an unresolvable author', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'helpCenter',
        operation: 'createArticle',
        portalSlug: 'acme-help',
        title: 'T',
        content: 'C',
      },
      responses: [
        {
          url: `${V1}/notification_settings`,
          status: 401,
          body: { error: 'Access to this endpoint is not authorized for bots' },
        },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(output[0][0].json.error).toBe(
      'Could not resolve the article author from the API access token',
    );
    expect(output[0][0].json.description).toContain('Set Additional Fields → Author Name or ID');
  });
});

// ============================================================================
// Adversarial review regressions
// ============================================================================

describe('review regressions', () => {
  it('Update Portal with only Live Chat Inbox ID resends the slug so Chatwoot applies it', async () => {
    // PortalsController#update: `@portal.update!(portal_params.merge(live_chat_widget_params)) if
    // params[:portal].present?` — an empty portal object would silently drop inbox_id
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updatePortal',
        portalSlug: 'acme-help',
        updateFields: { inbox_id: 4 },
      },
      responses: [{ method: 'PATCH', url: `${V1}/portals/acme-help`, body: portal() }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${V1}/portals/acme-help`);
    expect(calls[0].body).toEqual({ portal: { slug: 'acme-help' }, inbox_id: 4 });
    expect(output[0][0].json).toEqual(portal());

    // With other portal fields the slug is not added
    const withName = await runChatwootNode({
      params: {
        resource: 'helpCenter',
        operation: 'updatePortal',
        portalSlug: 'acme-help',
        updateFields: { inbox_id: 4, name: 'Ayuda Acme' },
      },
      responses: [{ method: 'PATCH', url: `${V1}/portals/acme-help`, body: portal() }],
    });
    expect(withName.calls[0].body).toEqual({ portal: { name: 'Ayuda Acme' }, inbox_id: 4 });
  });

  it('parsed rows undo CSVSafe escaping for reports, the binary file keeps it', async () => {
    // app/views/api/v2/accounts/reports/labels.csv.erb (CSVSafe.generate_line)
    const csv =
      'Reporting period 2026-09-01 to 2026-09-08\n\n' +
      'Label Title,No. of conversations,Avg first response time,Avg resolution time,Avg reply time,Resolution Count\n' +
      "'-urgente,4,5 Minutes,1 Hours,2 Minutes,3\n";
    const rows = await runChatwootNode({
      params: {
        resource: 'report',
        operation: 'labelStatistics',
        since: SINCE,
        until: UNTIL,
        csvOutput: 'rows',
      },
      responses: [{ method: 'GET', url: `${V2}/reports/labels`, body: csv }],
    });
    expect(rows.calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS });
    expect(rows.output[0].map((item) => item.json)).toEqual([
      {
        'Label Title': '-urgente',
        'No. of conversations': '4',
        'Avg first response time': '5 Minutes',
        'Avg resolution time': '1 Hours',
        'Avg reply time': '2 Minutes',
        'Resolution Count': '3',
      },
    ]);

    const file = await runChatwootNode({
      params: { resource: 'report', operation: 'labelStatistics', since: SINCE, until: UNTIL },
      responses: [{ method: 'GET', url: `${V2}/reports/labels`, body: csv }],
    });
    expect(Buffer.from(file.output[0][0].binary?.data.data ?? '', 'base64').toString('utf8')).toBe(
      csv,
    );
  });

  it('SLA download rows (plain CSV.generate_line) are not unescaped and indented rows are trimmed', async () => {
    // enterprise/app/views/api/v1/accounts/applied_slas/download.csv.erb
    const csv =
      'Conversation ID,SLA Policy,Assignee,Team,Inbox,Labels,Link to the Conversation,Breached Events\n\n' +
      '  42,\'=Premium,Ana,Support,WhatsApp,"billing,vip",https://chatwoot.test/app/accounts/1/conversations/42,"frt, nrt"\n';
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'appliedSla',
        operation: 'download',
        csvOutput: 'rows',
        options: { sla_policy_id: 2 },
      },
      responses: [{ method: 'GET', url: `${V1}/applied_slas/download`, body: csv }],
    });
    expect(calls[0].url).toBe(`${V1}/applied_slas/download`);
    expect(calls[0].qs).toEqual({ sla_policy_id: 2 });
    expect(output[0].map((item) => item.json)).toEqual([
      {
        'Conversation ID': '42',
        'SLA Policy': "'=Premium",
        Assignee: 'Ana',
        Team: 'Support',
        Inbox: 'WhatsApp',
        Labels: 'billing,vip',
        'Link to the Conversation': 'https://chatwoot.test/app/accounts/1/conversations/42',
        'Breached Events': 'frt, nrt',
      },
    ]);
  });

  it('Audit Log user filter does not duplicate entries that shift to the next page', async () => {
    // A new entry created during the scan pushes entry 25 from page 1 onto page 2
    const page1 = range(1, 25);
    const page2 = [25, 26, 27];
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'auditLog',
        operation: 'getAll',
        returnAll: true,
        filters: { user_id: 7 },
      },
      responses: [
        {
          method: 'GET',
          url: `${V1}/audit_logs`,
          times: 2,
          reply: (call) => ({
            body: auditLogPage(pageOf(call) === 1 ? page1 : page2, 28, pageOf(call), (id) =>
              id >= 25 ? 7 : 1,
            ),
          }),
        },
      ],
    });
    expect(calls.map((call) => call.qs)).toEqual([{ page: 1 }, { page: 2 }]);
    expect(output[0].map((item) => item.json.id)).toEqual([25, 26, 27]);
  });
});

describe('slaPolicy (item index + endpoints)', () => {
  const policy = {
    id: 3,
    name: 'Premium',
    description: 'VIP',
    first_response_time_threshold: 3600,
    next_response_time_threshold: 7200,
    resolution_time_threshold: 86400,
    only_during_business_hours: false,
  };

  it('Get / Create / Update / Delete hit /sla_policies with the payload views', async () => {
    const got = await runChatwootNode({
      params: { resource: 'slaPolicy', operation: 'get', slaPolicyId: 3 },
      responses: [{ method: 'GET', url: `${V1}/sla_policies/3`, body: { payload: policy } }],
    });
    expect(got.calls[0].url).toBe(`${V1}/sla_policies/3`);
    expect(got.output[0][0].json).toEqual({ payload: policy });

    const created = await runChatwootNode({
      params: {
        resource: 'slaPolicy',
        operation: 'create',
        name: 'Premium',
        additionalFields: {
          first_response_time_threshold: 3600,
          only_during_business_hours: false,
        },
      },
      responses: [{ method: 'POST', url: `${V1}/sla_policies`, body: { payload: policy } }],
    });
    // Flat keys are wrapped under sla_policy by Rails' JSON params wrapper (all are model columns)
    expect(created.calls[0].body).toEqual({
      name: 'Premium',
      first_response_time_threshold: 3600,
      only_during_business_hours: false,
    });
    expect(created.output[0][0].json).toEqual({ payload: policy });

    const updated = await runChatwootNode({
      params: {
        resource: 'slaPolicy',
        operation: 'update',
        slaPolicyId: 3,
        updateFields: { resolution_time_threshold: 43200 },
      },
      responses: [{ method: 'PATCH', url: `${V1}/sla_policies/3`, body: { payload: policy } }],
    });
    expect(updated.calls[0].body).toEqual({ resolution_time_threshold: 43200 });

    const deleted = await runChatwootNode({
      params: { resource: 'slaPolicy', operation: 'delete', slaPolicyId: 3 },
      responses: [{ method: 'DELETE', url: `${V1}/sla_policies/3` }],
    });
    expect(deleted.output[0][0].json).toEqual({ success: true, id: 3 });
  });

  it('errors point at the failing item (second item)', async () => {
    const mock = createMockExecuteFunctions({
      description: new Chatwoot().description,
      items: [{ json: {} }, { json: {} }],
      params: { resource: 'slaPolicy', operation: 'get', slaPolicyId: 3 },
      responses: [
        { method: 'GET', url: `${V1}/sla_policies/3`, body: { payload: policy } },
        {
          method: 'GET',
          url: `${V1}/sla_policies/3`,
          status: 401,
          body: { error: 'You are not authorized to do this action' },
        },
      ],
    });
    const promise = new Chatwoot().execute.call(mock.ctx);
    await expect(promise).rejects.toBeInstanceOf(NodeApiError);
    await promise.catch((error: NodeApiError) => expect(error.context.itemIndex).toBe(1));
  });
});

describe('liveReport / summaryReport', () => {
  it('live conversation metrics (v2) with team filter and grouped metrics', async () => {
    // app/controllers/api/v2/accounts/live_reports_controller.rb
    const metrics = { open: 5, unattended: 2, unassigned: 1, pending: 0 };
    const live = await runChatwootNode({
      params: { resource: 'liveReport', operation: 'conversationMetrics', options: { team_id: 2 } },
      responses: [{ method: 'GET', url: `${V2}/live_reports/conversation_metrics`, body: metrics }],
    });
    expect(live.calls[0].url).toBe(`${V2}/live_reports/conversation_metrics`);
    expect(live.calls[0].qs).toEqual({ team_id: 2 });
    expect(live.output[0][0].json).toEqual(metrics);

    const grouped = [
      { open: 3, unattended: 1, unassigned: 0, assignee_id: 3 },
      { open: 2, unattended: 1, unassigned: 0, assignee_id: 4 },
    ];
    const byAgent = await runChatwootNode({
      params: {
        resource: 'liveReport',
        operation: 'groupedConversationMetrics',
        groupBy: 'assignee_id',
      },
      responses: [
        { method: 'GET', url: `${V2}/live_reports/grouped_conversation_metrics`, body: grouped },
      ],
    });
    expect(byAgent.calls[0].qs).toEqual({ group_by: 'assignee_id' });
    expect(byAgent.output[0].map((item) => item.json)).toEqual(grouped);
  });

  it('summary report sends integer since/until and fails on an invalid date', async () => {
    // V2::Reports::AgentSummaryBuilder#build
    const rows = [
      {
        id: 3,
        conversations_count: 12,
        resolved_conversations_count: 10,
        avg_resolution_time: 7200,
        avg_first_response_time: 300,
        avg_reply_time: 240,
      },
    ];
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'summaryReport',
        operation: 'agent',
        since: '2026-09-01T00:00:00.500Z',
        until: UNTIL,
        options: { business_hours: true },
      },
      responses: [{ method: 'GET', url: `${V2}/summary_reports/agent`, body: rows }],
    });
    expect(calls[0].url).toBe(`${V2}/summary_reports/agent`);
    expect(calls[0].qs).toEqual({ since: SINCE_TS, until: UNTIL_TS, business_hours: true });
    expect(output[0].map((item) => item.json)).toEqual(rows);

    const invalid = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'summaryReport', operation: 'channel', since: 'nope', until: UNTIL },
    });
    expect(invalid.calls).toHaveLength(0);
    expect(invalid.output[0][0].json.error).toBe('Since is not a valid date: nope');
  });
});

describe('report CSV date range guard', () => {
  it('period CSV reports fail before the request when Since/Until evaluate to empty', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'report', operation: 'teamStatistics', since: '', until: UNTIL },
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json.error).toBe('Since and Until are required for this report');
  });
});
