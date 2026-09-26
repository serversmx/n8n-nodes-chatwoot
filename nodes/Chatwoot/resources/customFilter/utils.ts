import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseJsonSafe } from '../../GenericFunctions';
import { normalizeContactFilterPayload } from '../contact/utils';
import { normalizeConversationFilterPayload } from '../conversation/helpers';

/**
 * Normalize the query of a saved custom filter. Chatwoot permits `query: {}` (a hash) and
 * silently drops any other type, which saves the filter with an empty query. The dashboard
 * stores `{ "payload": [conditions] }`, so a bare array of conditions (the format of the
 * Conversation/Contact Filter operations) is wrapped and validated by the corresponding
 * filter validator. The report enum has no documented condition schema, so report hashes
 * remain unchanged.
 */
export function normalizeCustomFilterQuery(
  this: IExecuteFunctions,
  value: unknown,
  itemIndex: number,
  filterType = 'conversation',
): IDataObject {
  let parsed: unknown;
  try {
    parsed = parseJsonSafe(value, 'query');
  } catch (error) {
    throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex });
  }
  if (Array.isArray(parsed)) parsed = { payload: parsed };
  if (!parsed || typeof parsed !== 'object') {
    throw new NodeOperationError(
      this.getNode(),
      'Query must be a JSON object like {"payload": [{"attribute_key": "status", "filter_operator": "equal_to", "values": ["open"]}]}',
      { itemIndex },
    );
  }

  const query = { ...(parsed as IDataObject) };
  if (filterType === 'report') return query;
  if (filterType !== 'contact' && filterType !== 'conversation') {
    throw new NodeOperationError(this.getNode(), `Unknown custom filter type "${filterType}"`, { itemIndex });
  }
  const payload = query.payload;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new NodeOperationError(this.getNode(), 'Query payload must be a non-empty array of conditions', { itemIndex });
  }
  query.payload = filterType === 'contact'
    ? normalizeContactFilterPayload.call(this, payload, itemIndex, 'Query')
    : normalizeConversationFilterPayload(this.getNode(), itemIndex, payload);
  return query;
}
