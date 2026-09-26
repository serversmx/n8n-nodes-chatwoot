/**
 * Execute-level tests for the Conversation, Message, Conversation Participant and Search resources.
 * Response bodies follow the Chatwoot 4.18.0 jbuilder views (paths relative to app/views/api/v1).
 */
import type { IDataObject } from 'n8n-workflow';

import { Chatwoot } from '../nodes/Chatwoot/Chatwoot.node';
import { binaryItem, runChatwootNode } from './helpers/mockExecuteFunctions';
import type { RecordedCall } from './helpers/mockExecuteFunctions';

const BASE = 'https://chatwoot.test';
const APP = `${BASE}/api/v1/accounts/1`;

// ============================================================================
// Fixtures (shapes copied from the 4.18.0 views)
// ============================================================================

/** models/_contact.json.jbuilder */
function contactJson(id: number): IDataObject {
  return {
    additional_attributes: {},
    availability_status: 'offline',
    email: `contact${id}@example.com`,
    id,
    name: `Contact ${id}`,
    phone_number: `+5215500000${id}`,
    blocked: false,
    identifier: null,
    thumbnail: '',
    custom_attributes: {},
    last_activity_at: 1_758_000_000,
    created_at: 1_757_000_000,
  };
}

/** models/_agent.json.jbuilder */
function agentJson(id: number): IDataObject {
  return {
    id,
    account_id: 1,
    availability_status: 'online',
    auto_offline: true,
    confirmed: true,
    email: `agent${id}@example.com`,
    provider: 'email',
    available_name: `Agent ${id}`,
    name: `Agent ${id}`,
    role: 'agent',
    thumbnail: '',
    custom_role_id: null,
  };
}

/** models/_message.json.jbuilder */
function messageJson(id: number, overrides: IDataObject = {}): IDataObject {
  return {
    id,
    content: `message ${id}`,
    inbox_id: 3,
    conversation_id: 42,
    message_type: 1,
    content_type: 'text',
    status: 'sent',
    content_attributes: {},
    created_at: 1_758_000_000 + id * 60,
    private: false,
    source_id: null,
    sender: { id: 7, name: 'Agent 7', available_name: 'Agent 7', type: 'user' },
    ...overrides,
  };
}

/** conversations/partials/_conversation.json.jbuilder (show, create, update, unread, update_last_seen, index items) */
function conversationJson(id: number, overrides: IDataObject = {}): IDataObject {
  return {
    meta: {
      sender: contactJson(9),
      channel: 'Channel::Api',
      assignee: agentJson(7),
      assignee_type: 'User',
      hmac_verified: false,
    },
    id,
    messages: [messageJson(1000 + id)],
    account_id: 1,
    uuid: `00000000-0000-0000-0000-${String(id).padStart(12, '0')}`,
    additional_attributes: {},
    agent_last_seen_at: 0,
    assignee_last_seen_at: 0,
    can_reply: true,
    contact_info_request: { available: false, reason: null, delivery_mode: null },
    contact_last_seen_at: 0,
    custom_attributes: {},
    inbox_id: 3,
    labels: [],
    muted: false,
    snoozed_until: null,
    status: 'open',
    created_at: 1_757_000_000,
    updated_at: 1_758_000_000.123,
    timestamp: 1_758_000_000,
    first_reply_created_at: 0,
    unread_count: 0,
    last_non_activity_message: null,
    last_activity_at: 1_758_000_000,
    priority: null,
    waiting_since: 0,
    sla_policy_id: null,
    ...overrides,
  };
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, k) => from + k);
const ids = (items: Array<{ json: IDataObject }>): unknown[] => items.map((item) => item.json.id);

/** accounts/conversations/index.json.jbuilder */
function conversationIndex(conversationIds: number[], allCount: number): IDataObject {
  return {
    data: {
      meta: { mine_count: 0, assigned_count: allCount, unassigned_count: 0, all_count: allCount },
      payload: conversationIds.map((id) => conversationJson(id)),
    },
  };
}

/** Simulates GET /conversations with 25 per page. */
function conversationPages(total: number) {
  return (call: RecordedCall) => {
    const page = Number(call.qs?.page ?? 1);
    const pageIds = range(1, total).slice((page - 1) * 25, page * 25);
    return { body: conversationIndex(pageIds, total) };
  };
}

// ============================================================================
// Conversation
// ============================================================================

describe('conversation', () => {
  it('get: GET /conversations/:id', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'get', conversationId: 42 },
      responses: [{ method: 'GET', url: '/conversations/42', body: conversationJson(42) }],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42`);
    expect(output[0][0].json).toMatchObject({ id: 42, status: 'open', inbox_id: 3 });
  });

  describe('getAll', () => {
    it('reads data.payload, sends status=all by default and walks every page (Return All)', async () => {
      const { output, calls } = await runChatwootNode({
        params: { resource: 'conversation', operation: 'getAll', returnAll: true },
        responses: [
          { method: 'GET', url: '/conversations', times: Infinity, reply: conversationPages(60) },
        ],
      });
      expect(ids(output[0])).toEqual(range(1, 60));
      expect(calls.map((c) => c.qs)).toEqual([
        { status: 'all', page: 1 },
        { status: 'all', page: 2 },
        { status: 'all', page: 3 },
      ]);
      expect(calls[0].url).toBe(`${APP}/conversations`);
    });

    it('Limit collects items across pages instead of returning only page 1', async () => {
      const { output, calls } = await runChatwootNode({
        params: { resource: 'conversation', operation: 'getAll', returnAll: false, limit: 30 },
        responses: [
          { method: 'GET', url: '/conversations', times: Infinity, reply: conversationPages(100) },
        ],
      });
      expect(ids(output[0])).toEqual(range(1, 30));
      expect(calls).toHaveLength(2);
    });

    it('sends every filter, labels as labels[] and omits assignee_type=all', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'getAll',
          returnAll: false,
          limit: 5,
          filters: {
            assignee_type: 'all',
            conversation_type: 'participating',
            inbox_id: 3,
            labels: 'vip, billing',
            q: 'refund',
            sort_by: 'priority_desc',
            source_id: ' 5215512345678@s.whatsapp.net ',
            status: 'pending',
            team_id: 2,
            updated_within: 3600,
          },
        },
        responses: [{ method: 'GET', url: '/conversations', body: conversationIndex([5, 6], 2) }],
      });
      expect(calls[0].qs).toEqual({
        status: 'pending',
        conversation_type: 'participating',
        inbox_id: 3,
        team_id: 2,
        labels: ['vip', 'billing'],
        q: 'refund',
        sort_by: 'priority_desc',
        source_id: '5215512345678@s.whatsapp.net',
        updated_within: 3600,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].queryString).toContain('labels[]=vip&labels[]=billing');
      expect(ids(output[0])).toEqual([5, 6]);
    });

    it('updated_within: one unpaginated request (no page param, no second full download)', async () => {
      // ConversationFinder skips pagination with updated_within; all_count ignores the window
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'getAll',
          returnAll: true,
          filters: { updated_within: 600 },
        },
        responses: [
          { method: 'GET', url: '/conversations', body: conversationIndex(range(1, 30), 500) },
        ],
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(`${APP}/conversations`);
      expect(calls[0].qs).toEqual({ status: 'all', updated_within: 600 });
      expect(ids(output[0])).toEqual(range(1, 30));
    });

    it('updated_within with Limit slices the single response', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'getAll',
          returnAll: false,
          limit: 4,
          filters: { updated_within: 600, status: 'open' },
        },
        responses: [
          { method: 'GET', url: '/conversations', body: conversationIndex(range(1, 30), 500) },
        ],
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].qs).toEqual({ status: 'open', updated_within: 600 });
      expect(ids(output[0])).toEqual([1, 2, 3, 4]);
    });
  });

  it('updateStatus: snoozed sends Unix seconds to toggle_status', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'updateStatus',
        conversationId: 42,
        status: 'snoozed',
        snoozed_until: '2026-10-01T10:00:00.000Z',
      },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/toggle_status',
          body: {
            meta: {},
            payload: {
              success: true,
              conversation_id: 42,
              current_status: 'snoozed',
              snoozed_until: '2026-10-01T10:00:00.000Z',
            },
          },
        },
      ],
    });
    expect(calls[0].body).toEqual({ status: 'snoozed', snoozed_until: 1_790_848_800 });
    expect(output[0][0].json).toMatchObject({ payload: { current_status: 'snoozed' } });
  });

  it('updateStatus: snoozed without a date snoozes until the next reply (no snoozed_until)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'updateStatus', conversationId: 42, status: 'snoozed' },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/toggle_status',
          body: {
            meta: {},
            payload: { success: true, conversation_id: 42, current_status: 'snoozed', snoozed_until: null },
          },
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/toggle_status`);
    expect(calls[0].body).toEqual({ status: 'snoozed' });
    expect(output[0][0].json).toMatchObject({ payload: { current_status: 'snoozed', snoozed_until: null } });
  });

  describe('assign', () => {
    it('agent: POST assignments with assignee_id and returns the agent', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'agent',
          assigneeId: 7,
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: agentJson(7) }],
      });
      expect(calls[0].url).toBe(`${APP}/conversations/42/assignments`);
      expect(calls[0].body).toEqual({ assignee_id: 7 });
      expect(output[0][0].json).toMatchObject({ id: 7, email: 'agent7@example.com' });
    });

    it('agentBot: sends assignee_type AgentBot and returns the bot (models/_agent_bot_slim)', async () => {
      const bot = {
        id: 4,
        name: 'Triage bot',
        description: '',
        thumbnail: '',
        outgoing_url: 'https://n8n.test/bot',
        bot_type: 'webhook',
      };
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'agentBot',
          agentBotId: 4,
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: bot }],
      });
      expect(calls[0].body).toEqual({ assignee_id: 4, assignee_type: 'AgentBot' });
      expect(output[0][0].json).toEqual(bot);
    });

    it('team and unassign team (team_id 0)', async () => {
      const team = {
        id: 2,
        name: 'Sales',
        description: '',
        allow_auto_assign: true,
        icon: null,
        icon_color: null,
        account_id: 1,
        is_member: false,
      };
      const assigned = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'team',
          teamId: 2,
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: team }],
      });
      expect(assigned.calls[0].body).toEqual({ team_id: 2 });
      expect(assigned.output[0][0].json).toEqual(team);

      const removed = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'unassignTeam',
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: 'null' }],
      });
      expect(removed.calls[0].body).toEqual({ team_id: 0 });
      expect(removed.output[0][0].json).toEqual({ success: true, id: 42, team: null });
    });

    it('unassign sends assignee_id null and emits a meaningful item for the `null` answer', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'unassign',
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: 'null' }],
      });
      expect(calls[0].body).toEqual({ assignee_id: null });
      expect(output[0][0].json).toEqual({ success: true, id: 42, assignee: null });
    });

    it('fails loudly when Chatwoot answers null for an unknown agent (it unassigned instead)', async () => {
      const { output } = await runChatwootNode({
        continueOnFail: true,
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'agent',
          assigneeId: 99,
        },
        responses: [{ method: 'POST', url: '/conversations/42/assignments', body: 'null' }],
      });
      expect(output[0][0].json.error).toBe(
        'Agent 99 is not a user of this account; Chatwoot removed the current assignee instead',
      );
    });

    it('captainAssistant on 4.18: checks the version and the inbox assistant, then assigns it', async () => {
      const assistant = { id: 11, name: 'Ava', description: 'Support assistant', thumbnail: '' };
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'captainAssistant',
        },
        responses: [
          {
            method: 'GET',
            url: `${BASE}/api`,
            body: {
              version: '4.18.0',
              timestamp: '2026-09-25 10:00:00',
              queue_services: 'ok',
              data_services: 'ok',
            },
          },
          {
            method: 'GET',
            url: '/conversations/42/inbox_assistant',
            body: { assistant: { id: 11, name: 'Ava' } },
          },
          { method: 'POST', url: '/conversations/42/assignments', body: assistant },
        ],
      });
      expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
        `GET ${BASE}/api`,
        `GET ${APP}/conversations/42/inbox_assistant`,
        `POST ${APP}/conversations/42/assignments`,
      ]);
      expect(calls[2].body).toEqual({ assignee_id: 11, assignee_type: 'Captain::Assistant' });
      expect(output[0][0].json).toEqual(assistant);
    });

    it('captainAssistant on 4.17.1: refuses before assigning (the server would assign a human)', async () => {
      const { output, calls } = await runChatwootNode({
        continueOnFail: true,
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'captainAssistant',
          captainAssistantId: 11,
        },
        responses: [{ method: 'GET', url: `${BASE}/api`, body: { version: '4.17.1' } }],
      });
      expect(calls).toHaveLength(1);
      expect(output[0][0].json.error).toBe(
        'Assigning a Captain assistant requires Chatwoot 4.18 or newer (server version: 4.17.1)',
      );
    });

    it('captainAssistant: rejects an assistant that is not connected to the inbox', async () => {
      const { output, calls } = await runChatwootNode({
        continueOnFail: true,
        params: {
          resource: 'conversation',
          operation: 'assign',
          conversationId: 42,
          assignmentType: 'captainAssistant',
          captainAssistantId: 5,
        },
        responses: [
          { method: 'GET', url: `${BASE}/api`, body: { version: '4.18.0' } },
          {
            method: 'GET',
            url: '/conversations/42/inbox_assistant',
            body: { assistant: { id: 11, name: 'Ava' } },
          },
        ],
      });
      expect(calls).toHaveLength(2);
      expect(output[0][0].json.error).toBe(
        'Captain assistant 5 is not connected to the inbox of conversation 42 (connected assistant: 11 "Ava")',
      );
    });
  });

  it('addLabels: POST labels with the label list', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'addLabels',
        conversationId: 42,
        labels: ['vip', 'billing'],
      },
      responses: [
        { method: 'POST', url: '/conversations/42/labels', body: { payload: ['vip', 'billing'] } },
      ],
    });
    expect(calls[0].body).toEqual({ labels: ['vip', 'billing'] });
    expect(output[0][0].json).toEqual({ payload: ['vip', 'billing'] });
  });

  describe('create', () => {
    it('with a contact and no source ID lets Chatwoot generate it; sends initial message and attributes', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'create',
          inboxId: 3,
          additionalFields: {
            contact_id: 9,
            status: 'snoozed',
            snoozed_until: '2026-10-01T10:00:00.000Z',
            additional_attributes: '{"mail_subject":"Order 123"}',
            message_content: 'Hello from n8n',
            message_template_params:
              '{"name":"order_update","category":"UTILITY","language":"en","processed_params":{"body":{"1":"123"}}}',
          },
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations',
            body: conversationJson(43, { status: 'snoozed' }),
          },
        ],
      });
      expect(calls[0].url).toBe(`${APP}/conversations`);
      expect(calls[0].body).toEqual({
        inbox_id: 3,
        contact_id: 9,
        status: 'snoozed',
        additional_attributes: { mail_subject: 'Order 123' },
        snoozed_until: '2026-10-01T10:00:00.000Z',
        message: {
          content: 'Hello from n8n',
          template_params: {
            name: 'order_update',
            category: 'UTILITY',
            language: 'en',
            processed_params: { body: { 1: '123' } },
          },
        },
      });
      expect(output[0][0].json).toMatchObject({ id: 43, status: 'snoozed' });
    });

    it('keeps the legacy source ID call shape', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'create',
          sourceId: '5215512345678',
          inboxId: 3,
        },
        responses: [{ method: 'POST', url: '/conversations', body: conversationJson(44) }],
      });
      expect(calls[0].body).toEqual({ inbox_id: 3, source_id: '5215512345678' });
    });

    it('requires a source ID or a contact ID before calling Chatwoot', async () => {
      const { output, calls } = await runChatwootNode({
        continueOnFail: true,
        params: { resource: 'conversation', operation: 'create', inboxId: 3 },
        responses: [],
      });
      expect(calls).toHaveLength(0);
      expect(output[0][0].json.error).toBe('Source ID is required unless Contact ID is set');
    });
  });

  it('togglePriority: None is sent as null and a meaningful item is emitted for head :ok', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'togglePriority', conversationId: 42 },
      responses: [{ method: 'POST', url: '/conversations/42/toggle_priority' }],
    });
    expect(calls[0].body).toEqual({ priority: null });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(output[0][0].json).toEqual({ success: true, id: 42, priority: null });
  });

  describe('update', () => {
    it('only sends what PATCH accepts: priority (None -> null) and sla_policy_id', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'update',
          conversationId: 42,
          updateFields: { priority: 'none', sla_policy_id: 3 },
        },
        responses: [
          {
            method: 'PATCH',
            url: '/conversations/42',
            body: conversationJson(42, { sla_policy_id: 3 }),
          },
        ],
      });
      expect(calls).toHaveLength(1);
      expect(calls[0].body).toEqual({ priority: null, sla_policy_id: 3 });
      expect(output[0][0].json).toMatchObject({ id: 42, priority: null, sla_policy_id: 3 });
    });

    it('routes Snoozed Until to toggle_status, then PATCHes to return the final conversation', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'update',
          conversationId: 42,
          updateFields: { priority: 'high', snoozed_until: '2026-10-01T10:00:00.000Z' },
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations/42/toggle_status',
            body: { meta: {}, payload: { success: true } },
          },
          {
            method: 'PATCH',
            url: '/conversations/42',
            body: conversationJson(42, { status: 'snoozed', priority: 'high' }),
          },
        ],
      });
      expect(calls[0].body).toEqual({ status: 'snoozed', snoozed_until: 1_790_848_800 });
      expect(calls[1].body).toEqual({ priority: 'high' });
      expect(output[0]).toHaveLength(1);
      expect(output[0][0].json).toMatchObject({ status: 'snoozed', priority: 'high' });
    });
  });

  describe('filter', () => {
    it('strips query_operator from the last condition, sends sort_by and paginates with Limit', async () => {
      const filterPage = (call: RecordedCall) => {
        const page = Number(call.qs?.page);
        const pageIds = range(1, 40).slice((page - 1) * 25, page * 25);
        return {
          body: {
            meta: { mine_count: 0, unassigned_count: 0, all_count: 40 },
            payload: pageIds.map((id) => conversationJson(id)),
          },
        };
      };
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'filter',
          returnAll: false,
          limit: 30,
          filterPayload: JSON.stringify([
            {
              attribute_key: 'status',
              filter_operator: 'equal_to',
              values: ['open'],
              query_operator: 'and',
            },
            {
              attribute_key: 'inbox_id',
              filter_operator: 'equal_to',
              values: 3,
              query_operator: 'AND',
            },
          ]),
          options: { sort_by: 'created_at_asc' },
        },
        responses: [
          { method: 'POST', url: '/conversations/filter', times: Infinity, reply: filterPage },
        ],
      });
      expect(calls).toHaveLength(2);
      expect(calls[0].qs).toEqual({ sort_by: 'created_at_asc', page: 1 });
      expect(calls[1].qs).toEqual({ sort_by: 'created_at_asc', page: 2 });
      expect(calls[0].body).toEqual({
        payload: [
          {
            attribute_key: 'status',
            filter_operator: 'equal_to',
            values: ['open'],
            query_operator: 'AND',
          },
          { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: [3] },
        ],
      });
      expect(ids(output[0])).toEqual(range(1, 30));
    });

    it.each<[unknown[], string]>([
      [
        [
          { attribute_key: 'status', filter_operator: 'equal_to', values: ['open'] },
          { attribute_key: 'priority', filter_operator: 'equal_to', values: ['high'] },
        ],
        'Condition 1 needs "query_operator": "AND" or "OR" to join it with condition 2',
      ],
      [
        [{ attribute_key: 'created_at', filter_operator: 'days_before', values: ['999'] }],
        'Condition 1: "days_before" needs a whole number of days between 1 and 998 (got "999")',
      ],
      [
        [{ attribute_key: 'status', filter_operator: 'equal_to', values: [0] }],
        'Condition 1: "status" values must be strings such as "open", "pending", "resolved" or "snoozed"',
      ],
      [[], 'Filter Payload must be a non-empty JSON array of conditions'],
      [
        // 4.18 validate_single_condition rejects values that respond to to_h, and nil does
        [{ attribute_key: 'team_id', filter_operator: 'equal_to', values: [null] }],
        'Condition 1 ("team_id") has an object, array or null in "values"; use plain strings or numbers',
      ],
      [
        [{ attribute_key: 'labels', filter_operator: 'equal_to', values: [['vip']] }],
        'Condition 1 ("labels") has an object, array or null in "values"; use plain strings or numbers',
      ],
    ])('rejects invalid payloads before calling Chatwoot (%#)', async (payload, message) => {
      const { output, calls } = await runChatwootNode({
        continueOnFail: true,
        params: {
          resource: 'conversation',
          operation: 'filter',
          returnAll: true,
          filterPayload: JSON.stringify(payload),
        },
        responses: [],
      });
      expect(calls).toHaveLength(0);
      expect(output[0][0].json.error).toBe(message);
    });

    it('sends contains/does_not_contain values as strings (Chatwoot strips each one)', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'filter',
          returnAll: true,
          filterPayload: JSON.stringify([
            { attribute_key: 'display_id', filter_operator: 'contains', values: [12], query_operator: 'OR' },
            { attribute_key: 'assignee_id', filter_operator: 'is_present' },
          ]),
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations/filter',
            body: {
              meta: { mine_count: 0, unassigned_count: 0, all_count: 1 },
              payload: [conversationJson(12)],
            },
          },
        ],
      });
      expect(calls[0].url).toBe(`${APP}/conversations/filter`);
      expect(calls[0].qs).toEqual({ page: 1 });
      expect(calls[0].body).toEqual({
        payload: [
          { attribute_key: 'display_id', filter_operator: 'contains', values: ['12'], query_operator: 'OR' },
          { attribute_key: 'assignee_id', filter_operator: 'is_present', values: [] },
        ],
      });
      expect(ids(output[0])).toEqual([12]);
    });
  });

  describe('custom attributes', () => {
    it('updateCustomAttributes replaces by default for saved workflows', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'updateCustomAttributes',
          conversationId: 42,
          customAttributes: '{"order_id":"123"}',
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations/42/custom_attributes',
            body: { custom_attributes: { order_id: '123' } },
          },
        ],
      });
      expect(calls[0].body).toEqual({ custom_attributes: { order_id: '123' } });
      expect(output[0][0].json).toEqual({ custom_attributes: { order_id: '123' } });
    });

    it('updateCustomAttributes with Merge off replaces the hash (no merge flag)', async () => {
      const { calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'updateCustomAttributes',
          conversationId: 42,
          customAttributes: '{"order_id":"123"}',
          merge: false,
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations/42/custom_attributes',
            body: { custom_attributes: { order_id: '123' } },
          },
        ],
      });
      expect(calls[0].body).toEqual({ custom_attributes: { order_id: '123' } });
    });

    it('deleteCustomAttributes posts the keys to destroy_custom_attributes', async () => {
      const { output, calls } = await runChatwootNode({
        params: {
          resource: 'conversation',
          operation: 'deleteCustomAttributes',
          conversationId: 42,
          attributeKeys: 'order_id, coupon',
        },
        responses: [
          {
            method: 'POST',
            url: '/conversations/42/destroy_custom_attributes',
            body: { custom_attributes: { plan: 'pro' } },
          },
        ],
      });
      expect(calls[0].url).toBe(`${APP}/conversations/42/destroy_custom_attributes`);
      expect(calls[0].body).toEqual({ custom_attributes: ['order_id', 'coupon'] });
      expect(output[0][0].json).toEqual({ custom_attributes: { plan: 'pro' } });
    });
  });

  it('listLabels: GET labels', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'listLabels', conversationId: 42 },
      responses: [{ method: 'GET', url: '/conversations/42/labels', body: { payload: ['vip'] } }],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/labels`);
    expect(output[0][0].json).toEqual({ payload: ['vip'] });
  });

  it('getMeta: sends team_id and labels (meta.json.jbuilder)', async () => {
    const meta = { meta: { mine_count: 1, assigned_count: 4, unassigned_count: 2, all_count: 6 } };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'getMeta',
        filters: { status: 'all', inbox_id: 3, team_id: 2, labels: 'vip' },
      },
      responses: [{ method: 'GET', url: '/conversations/meta', body: meta }],
    });
    expect(calls[0].qs).toEqual({ status: 'all', inbox_id: 3, team_id: 2, labels: ['vip'] });
    expect(output[0][0].json).toEqual(meta);
  });

  it('getUnreadCounts: returns the payload counts', async () => {
    const counts = { all_count: 5, inboxes: { 3: 5 }, labels: { vip: 2 }, teams: { 2: 1 } };
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversation', operation: 'getUnreadCounts' },
      responses: [
        { method: 'GET', url: '/conversations/unread_counts', body: { payload: counts } },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/unread_counts`);
    expect(output[0][0].json).toEqual(counts);
  });

  it('getAttachments: paginates payload (models/_attachment, 100 per page)', async () => {
    const attachment = (id: number): IDataObject => ({
      id,
      message_id: 1000 + id,
      thumb_url: '',
      data_url: `https://chatwoot.test/rails/active_storage/blobs/${id}/file.pdf`,
      file_size: 1024,
      file_type: 'file',
      extension: 'pdf',
      width: null,
      height: null,
      created_at: 1_758_000_000,
      sender: { id: 9, name: 'Contact 9', type: 'contact' },
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'getAttachments',
        conversationId: 42,
        returnAll: true,
      },
      responses: [
        {
          method: 'GET',
          url: '/conversations/42/attachments',
          body: { meta: { total_count: 2 }, payload: [attachment(1), attachment(2)] },
        },
      ],
    });
    expect(calls[0].qs).toEqual({ page: 1 });
    expect(ids(output[0])).toEqual([1, 2]);
  });

  it('markAsRead / markAsUnread: POST update_last_seen and unread', async () => {
    const read = await runChatwootNode({
      params: { resource: 'conversation', operation: 'markAsRead', conversationId: 42 },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/update_last_seen',
          body: conversationJson(42, { unread_count: 0 }),
        },
      ],
    });
    expect(read.calls[0].url).toBe(`${APP}/conversations/42/update_last_seen`);
    expect(read.calls[0].body).toBeUndefined();
    expect(read.output[0][0].json).toMatchObject({ id: 42, unread_count: 0 });

    const unread = await runChatwootNode({
      params: { resource: 'conversation', operation: 'markAsUnread', conversationId: 42 },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/unread',
          body: conversationJson(42, { unread_count: 1 }),
        },
      ],
    });
    expect(unread.calls[0].url).toBe(`${APP}/conversations/42/unread`);
    expect(unread.output[0][0].json).toMatchObject({ id: 42, unread_count: 1 });
  });

  it('mute / unmute / delete emit meaningful items for head :ok', async () => {
    const mute = await runChatwootNode({
      params: { resource: 'conversation', operation: 'mute', conversationId: 42 },
      responses: [{ method: 'POST', url: '/conversations/42/mute' }],
    });
    expect(mute.output[0][0].json).toEqual({ success: true, id: 42, muted: true });

    const unmute = await runChatwootNode({
      params: { resource: 'conversation', operation: 'unmute', conversationId: 42 },
      responses: [{ method: 'POST', url: '/conversations/42/unmute' }],
    });
    expect(unmute.output[0][0].json).toEqual({ success: true, id: 42, muted: false });

    const removed = await runChatwootNode({
      params: { resource: 'conversation', operation: 'delete', conversationId: 42 },
      responses: [{ method: 'DELETE', url: '/conversations/42' }],
    });
    expect(removed.calls[0].url).toBe(`${APP}/conversations/42`);
    expect(removed.output[0][0].json).toEqual({ success: true, id: 42 });
  });

  it('search: GET /conversations/search with Limit across pages (models/_conversation)', async () => {
    const searchResult = (id: number): IDataObject => ({
      id,
      uuid: `uuid-${id}`,
      created_at: 1_757_000_000,
      contact: { id: 9, name: 'Contact 9' },
      inbox: { id: 3, name: 'WhatsApp', channel_type: 'Channel::Api' },
      messages: [
        {
          content: 'refund please',
          id: 1000 + id,
          sender_name: 'Contact 9',
          message_type: 0,
          created_at: 1_758_000_000,
        },
      ],
      account_id: 1,
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'search',
        query: 'refund',
        returnAll: false,
        limit: 27,
      },
      responses: [
        {
          method: 'GET',
          url: '/conversations/search',
          times: Infinity,
          reply: (call) => ({
            body: {
              meta: { mine_count: 0, unassigned_count: 0, all_count: 30 },
              payload: range(1, 30)
                .slice((Number(call.qs?.page) - 1) * 25, Number(call.qs?.page) * 25)
                .map(searchResult),
            },
          }),
        },
      ],
    });
    expect(calls.map((c) => c.qs)).toEqual([
      { q: 'refund', page: 1 },
      { q: 'refund', page: 2 },
    ]);
    expect(ids(output[0])).toEqual(range(1, 27));
  });

  it('transcript: does not retry the email-quota 429 and emits an item on success', async () => {
    const limited = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'conversation',
        operation: 'transcript',
        conversationId: 42,
        email: 'boss@example.com',
      },
      responses: [{ method: 'POST', url: '/conversations/42/transcript', status: 429 }],
    });
    expect(limited.calls).toHaveLength(1);
    expect(limited.sleeps).toEqual([]);
    expect(limited.output[0][0].json.httpCode).toBe('429');

    const sent = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'transcript',
        conversationId: 42,
        email: 'boss@example.com',
      },
      responses: [{ method: 'POST', url: '/conversations/42/transcript' }],
    });
    expect(sent.calls[0].body).toEqual({ email: 'boss@example.com' });
    expect(sent.output[0][0].json).toEqual({ success: true, id: 42, email: 'boss@example.com' });
  });

  it('toggleTyping: sends typing_status (and is_private) and emits an item', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversation',
        operation: 'toggleTyping',
        conversationId: 42,
        typingStatus: 'off',
        isPrivate: true,
      },
      responses: [{ method: 'POST', url: '/conversations/42/toggle_typing_status' }],
    });
    expect(calls[0].body).toEqual({ typing_status: 'off', is_private: true });
    expect(output[0][0].json).toEqual({
      success: true,
      id: 42,
      typingStatus: 'off',
      isPrivate: true,
    });
  });
});

// ============================================================================
// Message
// ============================================================================

describe('message', () => {
  it('create (JSON): maps the options to MessageBuilder params', async () => {
    const created = messageJson(501, { content: 'Hi', source_id: 'wamid.123', echo_id: 'tmp-1' });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'create',
        conversationId: 42,
        content: 'Hi',
        options: {
          message_type: 'outgoing',
          private: false,
          content_attributes: '{"in_reply_to": 499}',
          source_id: 'wamid.123',
          echo_id: 'tmp-1',
          sender_agent_bot_id: 4,
          campaign_id: 8,
          external_created_at: '2026-09-25T12:00:00.000Z',
          cc_emails: 'a@example.com, b@example.com',
          template_params: '{}',
        },
      },
      responses: [{ method: 'POST', url: '/conversations/42/messages', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/messages`);
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({
      content: 'Hi',
      message_type: 'outgoing',
      source_id: 'wamid.123',
      echo_id: 'tmp-1',
      campaign_id: 8,
      sender_type: 'AgentBot',
      sender_id: 4,
      external_created_at: 1_790_337_600,
      cc_emails: 'a@example.com,b@example.com',
      content_attributes: { in_reply_to: 499 },
    });
    expect(output[0][0].json).toEqual(created);
  });

  it('create (multipart): uploads binary properties as attachments[] with an optional caption', async () => {
    const item = binaryItem({
      content: 'PDFDATA',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
    });
    item.binary!.voice = binaryItem({
      content: 'OGG',
      fileName: 'note.ogg',
      mimeType: 'audio/ogg',
    }).binary!.data;
    const created = messageJson(502, {
      content: null,
      attachments: [
        {
          id: 1,
          message_id: 502,
          file_type: 'file',
          data_url: 'https://chatwoot.test/f/invoice.pdf',
        },
      ],
    });
    const { output, calls } = await runChatwootNode({
      items: [item],
      params: {
        resource: 'message',
        operation: 'create',
        conversationId: 42,
        options: {
          binaryPropertyNames: 'data, voice',
          private: true,
          is_voice_message: true,
          content_attributes: '{"source":"n8n_bot"}',
        },
      },
      responses: [{ method: 'POST', url: '/conversations/42/messages', body: created }],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/messages`);
    expect(calls[0].headers['Content-Type']).toBeUndefined();
    expect(calls[0].formData).toEqual([
      { name: 'private', kind: 'field', value: 'true' },
      { name: 'is_voice_message', kind: 'field', value: 'true' },
      { name: 'content_attributes', kind: 'field', value: '{"source":"n8n_bot"}' },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 7,
        content: expect.any(Buffer),
      },
      {
        name: 'attachments[]',
        kind: 'file',
        fileName: 'note.ogg',
        mimeType: 'audio/ogg',
        size: 3,
        content: expect.any(Buffer),
      },
    ]);
    expect(output[0][0].json).toEqual(created);
  });

  it('create (multipart): sends the content as caption and message_type', async () => {
    const { calls } = await runChatwootNode({
      items: [binaryItem({ content: 'PNG', fileName: 'photo.png', mimeType: 'image/png' })],
      params: {
        resource: 'message',
        operation: 'create',
        conversationId: 42,
        content: 'Your photo',
        options: { binaryPropertyNames: 'data', message_type: 'incoming' },
      },
      responses: [{ method: 'POST', url: '/conversations/42/messages', body: messageJson(503) }],
    });
    expect(calls[0].formData?.slice(0, 2)).toEqual([
      { name: 'content', kind: 'field', value: 'Your photo' },
      { name: 'message_type', kind: 'field', value: 'incoming' },
    ]);
  });

  it.each<[IDataObject, string, string]>([
    [
      { binaryPropertyNames: 'data', template_params: '{"name":"hello"}' },
      'Hi',
      'Template Params cannot be combined with attachments',
    ],
    [
      {
        binaryPropertyNames: range(1, 16)
          .map((n) => `f${n}`)
          .join(','),
      },
      'Hi',
      'Chatwoot accepts at most 15 attachments per message (got 16)',
    ],
  ])(
    'create rejects invalid combinations before calling Chatwoot (%#)',
    async (options, content, message) => {
      const { output, calls } = await runChatwootNode({
        continueOnFail: true,
        params: { resource: 'message', operation: 'create', conversationId: 42, content, options },
        responses: [],
      });
      expect(calls).toHaveLength(0);
      expect(output[0][0].json.error).toBe(message);
    },
  );

  it('create allows an empty content for a template message', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'create',
        conversationId: 42,
        options: {
          template_params:
            '{"name":"order_update","language":"en","processed_params":{"body":{"1":"123"}}}',
        },
      },
      responses: [{ method: 'POST', url: '/conversations/42/messages', body: messageJson(504) }],
    });
    expect(calls[0].body).toEqual({
      content: '',
      template_params: {
        name: 'order_update',
        language: 'en',
        processed_params: { body: { 1: '123' } },
      },
    });
  });

  it('getAll: cursor pagination with before/after and filter_internal_messages', async () => {
    const all = range(1, 60).map((id) => messageJson(id));
    // message_finder.rb: after (without before) = ascending, id > after, limit 100
    const reply = (call: RecordedCall) => {
      const after = Number(call.qs?.after);
      return {
        body: {
          meta: { labels: [], additional_attributes: {}, contact: {} },
          payload: all.filter((m) => (m.id as number) > after).slice(0, 100),
        },
      };
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'getAll',
        conversationId: 42,
        returnAll: true,
        options: { before: 50, after: 25, filter_internal_messages: true },
      },
      responses: [{ method: 'GET', url: '/conversations/42/messages', times: Infinity, reply }],
    });
    // Forward read from the after cursor; the before bound is applied client-side
    expect(calls.map((c) => c.qs)).toEqual([{ filter_internal_messages: true, after: 25 }]);
    expect(ids(output[0])).toEqual(range(26, 49));
  });

  it('getAll: Limit returns the most recent messages, oldest first', async () => {
    const all = range(1, 45).map((id) => messageJson(id));
    const { output } = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'getAll',
        conversationId: 42,
        returnAll: false,
        limit: 3,
      },
      responses: [
        {
          method: 'GET',
          url: '/conversations/42/messages',
          times: Infinity,
          reply: () => ({ body: { meta: {}, payload: all.slice(-20) } }),
        },
      ],
    });
    expect(ids(output[0])).toEqual([43, 44, 45]);
  });

  it('update: PATCH the delivery status (and external_error for failed)', async () => {
    const failed = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'update',
        conversationId: 42,
        messageId: 501,
        deliveryStatus: 'failed',
        externalError: 'WhatsApp: number not on WhatsApp',
      },
      responses: [
        {
          method: 'PATCH',
          url: '/conversations/42/messages/501',
          body: messageJson(501, { status: 'failed' }),
        },
      ],
    });
    expect(failed.calls[0].url).toBe(`${APP}/conversations/42/messages/501`);
    expect(failed.calls[0].body).toEqual({
      status: 'failed',
      external_error: 'WhatsApp: number not on WhatsApp',
    });
    expect(failed.output[0][0].json).toMatchObject({ id: 501, status: 'failed' });

    const read = await runChatwootNode({
      params: {
        resource: 'message',
        operation: 'update',
        conversationId: 42,
        messageId: 501,
        deliveryStatus: 'read',
        externalError: 'ignored',
      },
      responses: [
        {
          method: 'PATCH',
          url: '/conversations/42/messages/501',
          body: messageJson(501, { status: 'read' }),
        },
      ],
    });
    expect(read.calls[0].body).toEqual({ status: 'read' });
  });

  it('update: a workflow saved with the former Content field fails without touching the message', async () => {
    // Regression: a preselected "Delivered" default silently marked these messages as delivered
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'message',
        operation: 'update',
        conversationId: 42,
        messageId: 501,
        content: 'legacy text',
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json).toMatchObject({
      error: 'Select the delivery status to set',
      description: expect.stringContaining('cannot edit the content of a message'),
    });
  });

  it('update: rejects a status Chatwoot does not know (e.g. from an expression)', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'message',
        operation: 'update',
        conversationId: 42,
        messageId: 501,
        deliveryStatus: 'seen',
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json.error).toBe('Status must be sent, delivered, read or failed (got "seen")');
  });

  it('retry: POST messages/:id/retry and returns the message (messages/retry.json.jbuilder)', async () => {
    const retried = messageJson(501, { status: 'sent', content_attributes: {} });
    const { output, calls } = await runChatwootNode({
      params: { resource: 'message', operation: 'retry', conversationId: 42, messageId: 501 },
      responses: [
        { method: 'POST', url: '/conversations/42/messages/501/retry', body: retried },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${APP}/conversations/42/messages/501/retry`);
    expect(calls[0].body).toBeUndefined();
    expect(output[0][0].json).toEqual(retried);
  });

  it('retry: does not re-send on 502 (POST is not idempotent)', async () => {
    const { output, calls, sleeps } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'message', operation: 'retry', conversationId: 42, messageId: 501 },
      responses: [{ method: 'POST', url: '/conversations/42/messages/501/retry', status: 502 }],
    });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
    expect(output[0][0].json.httpCode).toBe('502');
  });

  it('update: surfaces the 403 of non-API inboxes', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'message',
        operation: 'update',
        conversationId: 42,
        messageId: 501,
        deliveryStatus: 'read',
      },
      responses: [
        {
          method: 'PATCH',
          url: '/conversations/42/messages/501',
          status: 403,
          body: { error: 'Message status update is only allowed for API inboxes' },
        },
      ],
    });
    expect(output[0][0].json).toMatchObject({
      error:
        'Chatwoot API error 403 Forbidden: Message status update is only allowed for API inboxes',
      httpCode: '403',
    });
  });

  it('delete: DELETE the message', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'message', operation: 'delete', conversationId: 42, messageId: 501 },
      responses: [
        {
          method: 'DELETE',
          url: '/conversations/42/messages/501',
          body: messageJson(501, { content: 'This message was deleted' }),
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/messages/501`);
    expect(output[0][0].json).toEqual({ success: true, id: 501 });
  });
});

// ============================================================================
// Conversation Participant
// ============================================================================

describe('conversationParticipant', () => {
  it('getAll: GET participants (participants/show.json.jbuilder)', async () => {
    const { output, calls } = await runChatwootNode({
      params: { resource: 'conversationParticipant', operation: 'getAll', conversationId: 42 },
      responses: [
        {
          method: 'GET',
          url: '/conversations/42/participants',
          body: [agentJson(7), agentJson(8)],
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/conversations/42/participants`);
    expect(ids(output[0])).toEqual([7, 8]);
  });

  it('add: POST user_ids and returns the new participants', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversationParticipant',
        operation: 'add',
        conversationId: 42,
        userIds: '7, 8',
      },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/participants',
          body: [agentJson(7), agentJson(8)],
        },
      ],
    });
    expect(calls[0].body).toEqual({ user_ids: [7, 8] });
    expect(ids(output[0])).toEqual([7, 8]);
  });

  it('add: surfaces the 4.16.2+ 422 for agents outside the inbox', async () => {
    const { output } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'conversationParticipant',
        operation: 'add',
        conversationId: 42,
        userIds: '99',
      },
      responses: [
        {
          method: 'POST',
          url: '/conversations/42/participants',
          status: 422,
          body: { error: 'Invalid participant IDs' },
        },
      ],
    });
    expect(output[0][0].json).toMatchObject({
      error: 'Chatwoot API error 422 Unprocessable Entity: Invalid participant IDs',
      httpCode: '422',
    });
  });

  it('remove: DELETE with a JSON body and a meaningful item for head :ok', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'conversationParticipant',
        operation: 'remove',
        conversationId: 42,
        userIds: '7',
      },
      responses: [{ method: 'DELETE', url: '/conversations/42/participants' }],
    });
    expect(calls[0].body).toEqual({ user_ids: [7] });
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(output[0][0].json).toEqual({ success: true, conversationId: 42, userIds: [7] });
  });

  it('replace: PATCH the exact list (an empty list removes everyone)', async () => {
    const replaced = await runChatwootNode({
      params: {
        resource: 'conversationParticipant',
        operation: 'replace',
        conversationId: 42,
        userIds: '8',
      },
      responses: [{ method: 'PATCH', url: '/conversations/42/participants', body: [agentJson(8)] }],
    });
    expect(replaced.calls[0].body).toEqual({ user_ids: [8] });
    expect(ids(replaced.output[0])).toEqual([8]);

    const cleared = await runChatwootNode({
      params: { resource: 'conversationParticipant', operation: 'replace', conversationId: 42 },
      responses: [{ method: 'PATCH', url: '/conversations/42/participants', body: [] }],
    });
    expect(cleared.calls[0].body).toEqual({ user_ids: [] });
    expect(cleared.output[0]).toEqual([]);
  });

  it('rejects IDs that are not positive integers before calling Chatwoot', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'conversationParticipant',
        operation: 'remove',
        conversationId: 42,
        userIds: '7, abc',
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json.error).toBe('User IDs must contain positive integer IDs (got "abc")');
  });
});

// ============================================================================
// Search
// ============================================================================

describe('search', () => {
  /** search/_contact.json.jbuilder */
  const searchContact = (id: number): IDataObject => ({
    email: `contact${id}@example.com`,
    id,
    name: `Contact ${id}`,
    phone_number: `+5215500000${id}`,
    identifier: null,
    additional_attributes: {},
    last_activity_at: 1_758_000_000,
  });

  it('searchAll: returns the grouped payload as one item (search/index.json.jbuilder)', async () => {
    const body = {
      payload: { conversations: [], contacts: [searchContact(1)], messages: [], articles: [] },
    };
    const { output, calls } = await runChatwootNode({
      params: { resource: 'search', operation: 'searchAll', query: 'ana' },
      responses: [{ method: 'GET', url: '/search', body }],
    });
    expect(calls[0].url).toBe(`${APP}/search`);
    expect(calls[0].qs).toEqual({ q: 'ana' });
    expect(output[0][0].json).toEqual(body);
  });

  it('searchContacts: extracts payload.contacts and pages 15 at a time with Limit', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'search',
        operation: 'searchContacts',
        query: 'ana',
        returnAll: false,
        limit: 20,
      },
      responses: [
        {
          method: 'GET',
          url: '/search/contacts',
          times: Infinity,
          reply: (call) => ({
            body: {
              payload: {
                contacts: range(1, 40)
                  .slice((Number(call.qs?.page) - 1) * 15, Number(call.qs?.page) * 15)
                  .map(searchContact),
              },
            },
          }),
        },
      ],
    });
    expect(calls.map((c) => c.qs)).toEqual([
      { q: 'ana', page: 1 },
      { q: 'ana', page: 2 },
    ]);
    expect(ids(output[0])).toEqual(range(1, 20));
  });

  it('searchConversations: Return All stops on a short page (search/conversations.json.jbuilder)', async () => {
    const result = (id: number): IDataObject => ({
      id,
      account_id: 1,
      created_at: 1_757_000_000,
      message: messageJson(1000 + id),
      contact: searchContact(9),
      inbox: { id: 3, channel_id: 1, name: 'WhatsApp', channel_type: 'Channel::Api' },
      agent: {},
      additional_attributes: {},
    });
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'search',
        operation: 'searchConversations',
        query: '42',
        returnAll: true,
      },
      responses: [
        {
          method: 'GET',
          url: '/search/conversations',
          body: { payload: { conversations: range(1, 15).map(result) } },
        },
        {
          method: 'GET',
          url: '/search/conversations',
          body: { payload: { conversations: range(16, 18).map(result) } },
        },
      ],
    });
    expect(calls).toHaveLength(2);
    expect(ids(output[0])).toEqual(range(1, 18));
  });

  it('searchMessages: sends the advanced search filters (since/until as Unix seconds, from, inbox_id)', async () => {
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'search',
        operation: 'searchMessages',
        query: 'invoice',
        returnAll: true,
        filters: {
          since: '2026-09-01T00:00:00.000Z',
          until: '2026-09-25T00:00:00.000Z',
          from: 'contact:9',
          inbox_id: 3,
        },
      },
      responses: [
        {
          method: 'GET',
          url: '/search/messages',
          body: { payload: { messages: [messageJson(1), messageJson(2)] } },
        },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/search/messages`);
    expect(calls[0].qs).toEqual({
      q: 'invoice',
      since: 1_788_220_800,
      until: 1_790_294_400,
      from: 'contact:9',
      inbox_id: 3,
      page: 1,
    });
    expect(ids(output[0])).toEqual([1, 2]);
  });

  it('searchMessages: rejects an invalid From filter', async () => {
    const { output, calls } = await runChatwootNode({
      continueOnFail: true,
      params: {
        resource: 'search',
        operation: 'searchMessages',
        query: 'invoice',
        returnAll: true,
        filters: { from: 'user:9' },
      },
      responses: [],
    });
    expect(calls).toHaveLength(0);
    expect(output[0][0].json.error).toBe('From must be "contact:ID" or "agent:ID" (got "user:9")');
  });

  it('searchArticles: extracts payload.articles (search/_article.json.jbuilder)', async () => {
    const article = {
      id: 5,
      title: 'Refund policy',
      locale: 'en',
      content: 'We refund within 30 days',
      slug: 'refund-policy',
      portal_slug: 'help',
      account_id: 1,
      category_name: 'Billing',
      status: 'published',
      updated_at: 1_758_000_000,
    };
    const { output, calls } = await runChatwootNode({
      params: {
        resource: 'search',
        operation: 'searchArticles',
        query: 'refund',
        returnAll: false,
        limit: 5,
      },
      responses: [
        { method: 'GET', url: '/search/articles', body: { payload: { articles: [article] } } },
      ],
    });
    expect(calls[0].url).toBe(`${APP}/search/articles`);
    expect(calls[0].qs).toEqual({ q: 'refund', page: 1 });
    expect(output[0].map((item) => item.json)).toEqual([article]);
  });
});

// ============================================================================
// Descriptions of the owned resources
// ============================================================================

describe('owned resource descriptions', () => {
  const OWNED = ['conversation', 'message', 'conversationParticipant', 'search'];
  const properties = new Chatwoot().description.properties;
  const operationsOf = (resource: string): Array<{ name: string; value: string; description?: string; action?: string }> =>
    (properties.find(
      (p) => p.name === 'operation' && (p.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
    )?.options ?? []) as Array<{ name: string; value: string; description?: string; action?: string }>;

  it('message operations are complete and alphabetically sorted (not covered by Resources.test.ts)', () => {
    const operations = operationsOf('message');
    expect(operations.map((o) => o.value)).toEqual(['create', 'delete', 'getAll', 'retry', 'update']);
    expect(operations.map((o) => o.name)).toEqual([...operations.map((o) => o.name)].sort());
    for (const operation of operations) {
      expect(operation.description).toBeTruthy();
      expect(operation.action).toBeTruthy();
    }
  });

  it('every field targets an existing operation and collection options are sorted', () => {
    const problems: string[] = [];
    for (const property of properties) {
      const resources = property.displayOptions?.show?.resource as string[] | undefined;
      if (!resources?.some((r) => OWNED.includes(r)) || property.name === 'operation') continue;
      const operations = property.displayOptions?.show?.operation as string[] | undefined;
      for (const resource of resources) {
        const known = operationsOf(resource).map((o) => o.value);
        for (const operation of operations ?? []) {
          if (!known.includes(operation)) problems.push(`${resource}.${property.name}: unknown operation ${operation}`);
        }
      }
      if (property.type === 'collection') {
        const names = (property.options as Array<{ displayName: string }>).map((o) => o.displayName);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        if (names.join('|') !== sorted.join('|')) problems.push(`${property.name} (${operations}): ${names.join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('Message > Update has no preselected delivery status (saved workflows must choose one)', () => {
    const status = properties.find(
      (p) => p.name === 'deliveryStatus' && (p.displayOptions?.show?.operation as string[]).includes('update'),
    );
    expect(status?.default).toBe('');
    expect(status?.required).toBeFalsy();
  });
});
