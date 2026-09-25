import type { IDataObject, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { contactOperations } from '../nodes/Chatwoot/resources/contact';
import { conversationOperations } from '../nodes/Chatwoot/resources/conversation';
import { updateStatusOperation } from '../nodes/Chatwoot/resources/conversation/updateStatus.operation';
import { runChatwootNode } from './helpers/mockExecuteFunctions';

describe('review CW-CORE-1 / CW-COMPAT-6: label replacement compatibility', () => {
  it.each(['contact', 'conversation'])('%s saved addLabels still replaces, with normalized title expressions', async (resource) => {
    const endpoint = `/${resource}s/5/labels`;
    const { calls, output } = await runChatwootNode({
      params: { resource, operation: 'addLabels', contactId: 5, conversationId: 5, labels: ' vip, billing,VIP, ' },
      responses: [{ method: 'POST', url: endpoint, body: { payload: ['vip', 'billing'] } }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ labels: ['vip', 'billing'] });
    expect(output[0][0].json).toEqual({ payload: ['vip', 'billing'] });
  });

  it.each(['contact', 'conversation'])('%s explicit Set Labels can clear every label', async (resource) => {
    const { calls } = await runChatwootNode({
      params: { resource, operation: 'addLabels', contactId: 5, conversationId: 5, labels: [] },
      responses: [{ method: 'POST', url: `/${resource}s/5/labels`, body: { payload: [] } }],
    });
    expect(calls[0].body).toEqual({ labels: [] });
  });

  it.each([
    ['appendLabels', ['existing', 'VIP', 'billing']],
    ['removeLabels', ['existing']],
  ])('conversation %s reads the current list before updating', async (operation, expected) => {
    const { calls } = await runChatwootNode({
      params: { resource: 'conversation', operation, conversationId: 5, labels: ['vip', 'billing'] },
      responses: [
        { method: 'GET', url: '/conversations/5/labels', body: { payload: ['existing', 'VIP'] } },
        { method: 'POST', url: '/conversations/5/labels', body: { payload: expected } },
      ],
    });
    expect(calls[1].body).toEqual({ labels: expected });
  });

  it.each(['contact', 'conversation'])('%s append/remove rejects empty normalized lists before any request', async (resource) => {
    for (const operation of ['appendLabels', 'removeLabels']) {
      const { calls, output } = await runChatwootNode({
        continueOnFail: true,
        params: { resource, operation, contactId: 5, conversationId: 5, labels: ' , ' },
      });
      expect(calls).toHaveLength(0);
      expect(output[0][0].json.error).toBe('Labels must list at least one label title');
    }
  });

  it('operation labels and actions accurately distinguish replacement and append on both resources', () => {
    for (const operations of [contactOperations, conversationOperations]) {
      const options = operations.options as INodePropertyOptions[];
      expect(options.find(({ value }) => value === 'addLabels')).toMatchObject({ name: 'Set Labels' });
      expect(options.find(({ value }) => value === 'addLabels')?.action).toContain('Replace');
      expect(options.find(({ value }) => value === 'appendLabels')).toMatchObject({ name: 'Add Labels' });
      const names = options.map(({ name }) => name);
      expect(names).toEqual([...names].sort());
    }
  });
});

describe('review CW-CORE-3 / CW-COMPAT-3: opt-in custom attribute merge', () => {
  it.each([undefined, false, true])('merge=%s preserves the explicit opt-in', async (merge) => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'conversation', operation: 'updateCustomAttributes', conversationId: 5,
        customAttributes: '{"new":1}', ...(merge === undefined ? {} : { merge }),
      },
      responses: [{ method: 'POST', url: '/conversations/5/custom_attributes', body: { custom_attributes: { new: 1 } } }],
    });
    expect(calls[0].body).toEqual({ custom_attributes: { new: 1 }, ...(merge ? { merge: true } : {}) });
  });
});

it('CW-CORE-4: Open describes upstream assignment side effects in the status and operation selectors', () => {
  const status = updateStatusOperation.find(({ name }) => name === 'status') as INodeProperties;
  const open = (status.options as INodePropertyOptions[]).find(({ value }) => value === 'open');
  expect(open?.description).toMatch(/agent-role token.*token owner/);
  expect(open?.description).toMatch(/4\.17\.1 and later.*user token.*removes.*bot.*Captain/);
  const updateStatus = (conversationOperations.options as INodePropertyOptions[]).find(({ value }) => value === 'updateStatus');
  expect(updateStatus?.description).toMatch(/Open assigns.*token owner/);
  expect(updateStatus?.description).toMatch(/4\.17\.1 and later.*removes.*bot.*Captain/);
});

describe('review CW-CORE-5: stable default ordering across contact pages', () => {
  it.each(['getAll', 'search', 'filter'])('%s sends created_at on every page when sort is omitted', async (operation) => {
    const endpoint = operation === 'getAll' ? '/contacts' : `/contacts/${operation}`;
    const { calls, output } = await runChatwootNode({
      params: { resource: 'contact', operation, returnAll: true, query: 'a', filterPayload: '[]' },
      responses: [
        { method: operation === 'filter' ? 'POST' : 'GET', url: endpoint, body: { meta: { has_more: true }, payload: [{ id: 1 }, { id: 2 }] } },
        { method: operation === 'filter' ? 'POST' : 'GET', url: endpoint, body: { meta: { has_more: false }, payload: [{ id: 3 }] } },
      ],
    });
    expect(calls.map(({ qs }) => ({ sort: qs?.sort, page: qs?.page }))).toEqual([
      { sort: 'created_at', page: 1 }, { sort: 'created_at', page: 2 },
    ]);
    expect(output[0].map(({ json }) => json.id)).toEqual([1, 2, 3]);
  });
});

it('CW-CORE-7: idempotent participant Add emits a success item when all requested agents already participate', async () => {
  const { output } = await runChatwootNode({
    params: { resource: 'conversationParticipant', operation: 'add', conversationId: 5, userIds: '7' },
    responses: [{ method: 'POST', url: '/conversations/5/participants', body: [] }],
  });
  expect(output[0]).toEqual([{ json: { success: true, conversationId: 5, added: [] }, pairedItem: { item: 0 } }]);
});

describe('review CW-CORE-8: no empty update requests', () => {
  it.each<[string, IDataObject]>([
    ['label', { labelId: 5 }], ['customAttribute', { customAttributeId: 5 }], ['customFilter', { customFilterId: 5 }],
  ])('%s rejects an empty update locally with item context', async (resource, ids) => {
    const { calls, output } = await runChatwootNode({
      items: [{ json: {} }, { json: {} }],
      continueOnFail: true,
      params: { resource, operation: 'update', ...ids, updateFields: {} },
    });
    expect(calls).toHaveLength(0);
    expect(output[0]).toHaveLength(2);
    expect(output[0][1]).toMatchObject({ json: { error: 'Add at least one field to update' }, pairedItem: { item: 1 } });
  });
});

describe('review CW-CORE-9: validate saved contact and conversation filter queries', () => {
  it.each(['contact', 'conversation'])('%s create refuses empty and malformed conditions before saving', async (filterType) => {
    for (const query of [{}, { payload: [] }, { payload: [{ attribute_key: 'email', filter_operator: 'equal_to' }] }]) {
      const { calls, output } = await runChatwootNode({
        continueOnFail: true,
        params: { resource: 'customFilter', operation: 'create', name: 'Folder', filterType, query: JSON.stringify(query) },
      });
      expect(calls).toHaveLength(0);
      expect(output[0][0].json.error).toBeDefined();
    }
  });

  it('contact queries normalize scalar values and condition joins', async () => {
    const { calls } = await runChatwootNode({
      params: {
        resource: 'customFilter', operation: 'create', name: 'Folder', filterType: 'contact',
        query: JSON.stringify({ payload: [
          { attribute_key: 'phone_number', filter_operator: 'contains', values: 123 },
          { attribute_key: 'email', filter_operator: 'is_present', query_operator: 'AND' },
        ] }),
      },
      responses: [{ method: 'POST', url: '/custom_filters', body: { id: 3 } }],
    });
    expect((calls[0].body as IDataObject).query).toEqual({ payload: [
      { attribute_key: 'phone_number', filter_operator: 'contains', values: ['123'], query_operator: 'AND' },
      { attribute_key: 'email', filter_operator: 'is_present', values: [], query_operator: null },
    ] });
  });

  it('query updates use the saved filter type and reject an invalid join without PATCH', async () => {
    const { calls, output } = await runChatwootNode({
      continueOnFail: true,
      params: { resource: 'customFilter', operation: 'update', customFilterId: 3, updateFields: {
        query: JSON.stringify({ payload: [
          { attribute_key: 'status', filter_operator: 'equal_to', values: ['open'], query_operator: 'XOR' },
          { attribute_key: 'status', filter_operator: 'equal_to', values: ['pending'] },
        ] }),
      } },
      responses: [{ method: 'GET', url: '/custom_filters/3', body: { id: 3, filter_type: 'conversation' } }],
    });
    expect(calls).toHaveLength(1);
    expect(output[0][0].json.error).toContain('query_operator');
  });

  it('report query objects retain their distinct schema', async () => {
    const query = { inbox_id: 5, since: 100, until: 200 };
    const { calls } = await runChatwootNode({
      params: { resource: 'customFilter', operation: 'update', customFilterId: 3, updateFields: { query: JSON.stringify(query) } },
      responses: [
        { method: 'GET', url: '/custom_filters/3', body: { id: 3, filter_type: 'report' } },
        { method: 'PATCH', url: '/custom_filters/3', body: { id: 3 } },
      ],
    });
    expect(calls[1].body).toEqual({ query });
  });
});

describe('review CW-CORE-10: contact fields can be cleared explicitly', () => {
  it.each([0, ''])('empty text fields and company=%s reach the server', async (companyId) => {
    const { calls } = await runChatwootNode({
      params: { resource: 'contact', operation: 'update', contactId: 5, updateFields: { email: '', phone_number: '', identifier: '', company_id: companyId } },
      responses: [{ method: 'PUT', url: '/contacts/5', body: { id: 5 } }],
    });
    expect(calls[0].body).toEqual({ email: '', phone_number: '', identifier: '', company_id: null });
  });

  it('omitted fields stay omitted', async () => {
    const { calls } = await runChatwootNode({
      params: { resource: 'contact', operation: 'update', contactId: 5, updateFields: { name: 'Ada' } },
      responses: [{ method: 'PUT', url: '/contacts/5', body: { id: 5 } }],
    });
    expect(calls[0].body).toEqual({ name: 'Ada' });
  });
});

it('CW-COMPAT-9: saved empty-content messages still reach Chatwoot', async () => {
  const { calls, output } = await runChatwootNode({
    params: { resource: 'message', operation: 'create', conversationId: 5, content: '' },
    responses: [{ method: 'POST', url: '/conversations/5/messages', body: { id: 9, content: '' } }],
  });
  expect(calls[0].body).toMatchObject({ content: '' });
  expect(output[0][0].json).toEqual({ id: 9, content: '' });
});
