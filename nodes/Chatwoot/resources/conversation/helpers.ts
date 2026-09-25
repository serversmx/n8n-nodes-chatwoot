import type { IDataObject, IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { chatwootApiRequest, getHttpStatus, normalizeBaseUrl } from '../../GenericFunctions';

/**
 * Parse a list of positive integer IDs from a comma-separated string, a number or an array
 * (expressions can resolve to any of them). Throws on anything that is not a positive integer.
 */
export function parseIdList(value: unknown, fieldName: string): number[] {
  let parts: unknown[];
  if (Array.isArray(value)) {
    parts = value;
  } else if (typeof value === 'number') {
    parts = [value];
  } else if (typeof value === 'string') {
    parts = value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '');
  } else if (value === undefined || value === null) {
    parts = [];
  } else {
    throw new Error(`${fieldName} must be a comma-separated list of IDs`);
  }

  return parts.map((part) => {
    const id = typeof part === 'number' ? part : Number(String(part).trim());
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`${fieldName} must contain positive integer IDs (got "${String(part)}")`);
    }
    return id;
  });
}

/** Parse a comma-separated string (or an array) into trimmed, non-empty strings. */
export function parseStringList(value: unknown): string[] {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

/**
 * Convert an n8n dateTime (ISO string), a Date or a number into Unix seconds, the format Chatwoot
 * expects for snoozed_until, since/until and external_created_at. Numbers above 10^11 are treated
 * as milliseconds. Returns undefined for empty values and throws on unparseable ones.
 */
export function toUnixSeconds(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    return Math.floor(value > 1e11 ? value / 1000 : value);
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return toUnixSeconds(Number(text), fieldName);
  const time = value instanceof Date ? value.getTime() : new Date(text).getTime();
  if (Number.isNaN(time)) {
    throw new Error(`${fieldName} is not a valid date: "${text}"`);
  }
  return Math.floor(time / 1000);
}

/**
 * Chatwoot's priority enum is low/medium/high/urgent. "None" clears the priority, which Chatwoot only
 * accepts as null: 'none' returned 500 up to 4.17 and 422 since 4.18.
 */
export function mapPriority(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const priority = String(value).trim().toLowerCase();
  return priority === '' || priority === 'none' ? null : priority;
}

const QUERY_OPERATORS = ['AND', 'OR'];
const STRING_VALUE_ATTRIBUTES = ['status', 'priority'];
const OPERATORS_WITHOUT_VALUES = ['is_present', 'is_not_present'];
const ILIKE_OPERATORS = ['contains', 'does_not_contain'];

/**
 * Validate and normalize a Conversation Filter payload before it reaches Chatwoot, so the user gets a
 * precise error instead of Chatwoot's generic 422 ("Query operator must be either AND or OR") or a 500:
 * - the payload must be a non-empty array of conditions with attribute_key and filter_operator;
 * - scalar `values` are wrapped in an array; object, array and null values are rejected (4.18 rejects
 *   them) and contains/does_not_contain values are sent as strings (Chatwoot strips each one);
 * - every condition except the last one needs query_operator AND/OR (without it Chatwoot builds
 *   invalid SQL and answers 500); the last condition's query_operator is removed (4.17+ answer 422);
 * - days_before must be an integer between 1 and 998 (4.17+);
 * - status/priority values must be strings such as "open" or "high" (4.18+).
 */
export function normalizeConversationFilterPayload(
  node: INode,
  itemIndex: number,
  payload: unknown,
): IDataObject[] {
  const fail: (message: string) => never = (message) => {
    throw new NodeOperationError(node, message, {
      itemIndex,
      description:
        'Each condition is {"attribute_key": "status", "filter_operator": "equal_to", "values": ["open"], "query_operator": "AND"}. ' +
        'query_operator joins a condition with the NEXT one, so the last condition must not have it.',
    });
  };

  if (!Array.isArray(payload) || payload.length === 0) {
    fail('Filter Payload must be a non-empty JSON array of conditions');
  }
  const conditions = payload as unknown[];

  return conditions.map((raw, index) => {
    const position = `Condition ${index + 1}`;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      fail(`${position} of the Filter Payload must be an object`);
    }
    const condition: IDataObject = { ...(raw as IDataObject) };
    const attributeKey = condition.attribute_key;
    const filterOperator = condition.filter_operator;
    if (typeof attributeKey !== 'string' || attributeKey.trim() === '') {
      fail(
        `${position} needs an "attribute_key" (e.g. "status", "inbox_id", "labels" or a custom attribute key)`,
      );
    }
    if (typeof filterOperator !== 'string' || filterOperator.trim() === '') {
      fail(
        `${position} needs a "filter_operator" (e.g. "equal_to", "contains", "is_present", "days_before")`,
      );
    }

    let values = condition.values;
    if (values === undefined || values === null) {
      values = [];
    } else if (!Array.isArray(values)) {
      values = [values];
    }
    let valueList = values as unknown[];
    // 4.18 rejects any value that responds to to_h, which includes null as well as objects and arrays
    if (valueList.some((value) => value === null || typeof value === 'object')) {
      fail(
        `${position} ("${attributeKey as string}") has an object, array or null in "values"; use plain strings or numbers`,
      );
    }
    // contains/does_not_contain strip every value (a number answers 500): send them as strings
    if (ILIKE_OPERATORS.includes(filterOperator as string)) {
      valueList = valueList.map((value) => String(value));
    }
    if (valueList.length === 0 && !OPERATORS_WITHOUT_VALUES.includes(filterOperator as string)) {
      fail(`${position} ("${attributeKey as string}") needs at least one entry in "values"`);
    }
    if (
      STRING_VALUE_ATTRIBUTES.includes(attributeKey as string) &&
      valueList.some((value) => typeof value !== 'string')
    ) {
      fail(
        `${position}: "${attributeKey as string}" values must be strings such as ${
          attributeKey === 'status'
            ? '"open", "pending", "resolved" or "snoozed"'
            : '"low", "medium", "high" or "urgent"'
        }`,
      );
    }
    if (filterOperator === 'days_before') {
      // Same parsing as Chatwoot's Integer(value, 10): whole numbers only ("7.0" is rejected)
      const text = String(valueList[0] ?? '').trim();
      const days = /^[+-]?\d+$/.test(text) ? Number(text) : NaN;
      if (!Number.isInteger(days) || days < 1 || days > 998) {
        fail(
          `${position}: "days_before" needs a whole number of days between 1 and 998 (got "${String(valueList[0] ?? '')}")`,
        );
      }
    }
    condition.values = valueList;

    const isLast = index === conditions.length - 1;
    const operator = condition.query_operator;
    if (isLast) {
      delete condition.query_operator;
    } else if (
      typeof operator !== 'string' ||
      !QUERY_OPERATORS.includes(operator.trim().toUpperCase())
    ) {
      fail(
        `${position} needs "query_operator": "AND" or "OR" to join it with condition ${index + 2}`,
      );
    } else {
      condition.query_operator = operator.trim().toUpperCase();
    }
    return condition;
  });
}

/** Parse "4.18.0" (or "v4.18.0-ee") into [major, minor]. */
export function parseChatwootVersion(version: unknown): [number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

/**
 * Captain assistants can only be assigned on Chatwoot 4.18+ Enterprise (ai_assignee). Older servers,
 * including 4.17.1, and builds without Enterprise treat {assignee_type: 'Captain::Assistant',
 * assignee_id: N} as a HUMAN assignment: they assign the user whose id is N, or unassign the
 * conversation when there is none. The node therefore checks before calling the assignments endpoint:
 * 1. GET {baseUrl}/api -> { version } must be 4.18 or newer;
 * 2. GET /conversations/:id/inbox_assistant (Enterprise only) -> the assistant connected to the inbox,
 *    the only one Chatwoot accepts.
 * Returns the assistant id to assign (the connected one when `assistantId` is 0).
 */
export async function assertCaptainAssignmentSupported(
  this: IExecuteFunctions,
  conversationId: number,
  assistantId: number,
  itemIndex: number,
): Promise<number> {
  const node = this.getNode();
  const credentials = await this.getCredentials('chatwootApi', itemIndex);

  let rawVersion: unknown;
  try {
    const baseUrl = normalizeBaseUrl(String(credentials.baseUrl ?? ''));
    // GET {baseUrl}/api is Chatwoot's unauthenticated version endpoint; `getCredentials` above is only
    // used for baseUrl, and sending the api_access_token header here would be misleading (the request
    // needs no auth).
    // eslint-disable-next-line
    const info = (await this.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrl}/api`,
      json: true,
    })) as IDataObject;
    rawVersion = info?.version;
  } catch {
    rawVersion = undefined;
  }
  const version = parseChatwootVersion(rawVersion);
  if (!version || version[0] < 4 || (version[0] === 4 && version[1] < 18)) {
    throw new NodeOperationError(
      node,
      `Assigning a Captain assistant requires Chatwoot 4.18 or newer (server version: ${rawVersion ? String(rawVersion) : 'unknown'})`,
      {
        itemIndex,
        description:
          'Older Chatwoot versions would assign the human agent that has the same ID instead, so the node did not send the request. The version is read from GET {Base URL}/api.',
      },
    );
  }

  let assistant: IDataObject | null | undefined;
  try {
    const response = (await chatwootApiRequest.call(
      this,
      'GET',
      `/conversations/${conversationId}/inbox_assistant`,
      {},
      {},
      { itemIndex },
    )) as IDataObject;
    assistant = response?.assistant as IDataObject | null | undefined;
  } catch (error) {
    if (getHttpStatus(error) === 404) {
      throw new NodeOperationError(
        node,
        `Conversation ${conversationId} was not found, or this Chatwoot build has no Enterprise (Captain) features`,
        { itemIndex },
      );
    }
    // `error` is already a NodeApiError from chatwootApiRequest (see GenericFunctions.chatwootRequest).
    // eslint-disable-next-line
    throw error;
  }

  const connectedId = Number(assistant?.id);
  if (!assistant || !Number.isInteger(connectedId) || connectedId < 1) {
    throw new NodeOperationError(
      node,
      `The inbox of conversation ${conversationId} has no Captain assistant connected`,
      {
        itemIndex,
        description: 'Connect an assistant to the inbox in Captain > Assistants > Inboxes first.',
      },
    );
  }
  if (assistantId && assistantId !== connectedId) {
    throw new NodeOperationError(
      node,
      `Captain assistant ${assistantId} is not connected to the inbox of conversation ${conversationId} (connected assistant: ${connectedId}${
        assistant.name ? ` "${String(assistant.name)}"` : ''
      })`,
      {
        itemIndex,
        description:
          'Chatwoot only assigns the assistant connected to the conversation inbox. Leave the ID at 0 to use it.',
      },
    );
  }
  return connectedId;
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Reject a priority Chatwoot would refuse (422 on 4.18, 500 before) before calling it. */
export function assertValidPriority(node: INode, itemIndex: number, priority: string | null): void {
  if (priority === null || PRIORITIES.includes(priority)) return;
  throw new NodeOperationError(
    node,
    `Priority must be urgent, high, medium, low or none (got "${priority}")`,
    {
      itemIndex,
    },
  );
}
