import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseJsonSafe } from '../../GenericFunctions';

/**
 * Normalize the query of a saved custom filter. Chatwoot permits `query: {}` (a hash) and
 * silently drops any other type, which saves the filter with an empty query. The dashboard
 * stores `{ "payload": [conditions] }`, so a bare array of conditions (the format of the
 * Conversation/Contact Filter operations) is wrapped. Like Chatwoot 4.17+ requires, the last
 * condition gets no query_operator.
 */
export function normalizeCustomFilterQuery(
  this: IExecuteFunctions,
  value: unknown,
  itemIndex: number,
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
  const payload = query.payload;
  if (Array.isArray(payload) && payload.length > 0) {
    const last = payload[payload.length - 1] as IDataObject | null;
    if (last && typeof last === 'object' && !Array.isArray(last) && last.query_operator) {
      query.payload = [...payload.slice(0, -1), { ...last, query_operator: null }];
    }
  }
  return query;
}
