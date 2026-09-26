import type { IDataObject } from 'n8n-workflow';

// ============================================================================
// Event filters (TRIGGER-7 / EVOCW-8)
//
// Chatwoot account webhooks are account-wide: the webhook's inbox_id is stored but never used for delivery
// (webhook_listener.rb#deliver_account_webhooks), and message_created/message_updated fire for incoming,
// outgoing and template messages, private notes included. API channels and agent bots receive every event of
// their inbox. These filters run in n8n before a workflow execution is started.
// ============================================================================

export type PrivateNotesMode = 'include' | 'exclude' | 'only';

export interface TriggerFilters {
  inboxIds: number[];
  messageTypes: string[];
  privateNotes: PrivateNotesMode;
  senderTypes: string[];
  ignoreUserIds: number[];
  ignoreWhatsAppEchoes: boolean;
}

export type FilterResult = { pass: true } | { pass: false; reason: string };

/** message_type as an integer (push_event_data) or a string (webhook_data). */
const MESSAGE_TYPES_BY_INDEX = ['incoming', 'outgoing', 'activity', 'template'];

/** Evolution API imports WhatsApp messages with source_id 'WAID:<message id>'. */
export const WHATSAPP_SOURCE_ID_PREFIX = 'WAID:';

/**
 * Parse a comma/space separated list of positive integer IDs.
 * Throws a plain Error naming the invalid token (callers wrap it in NodeOperationError).
 */
export function parseIdList(value: unknown, fieldName: string): number[] {
  if (value === undefined || value === null || value === '') return [];
  const tokens = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : String(value).split(/[\s,]+/);
  const ids: number[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) {
      throw new Error(
        `${fieldName} must be a comma-separated list of numeric IDs (got "${trimmed}")`,
      );
    }
    ids.push(Number(trimmed));
  }
  return [...new Set(ids)];
}

/** Normalize the node's `filters` collection. Throws a plain Error on invalid ID lists. */
export function parseTriggerFilters(raw: IDataObject | undefined): TriggerFilters {
  const filters = raw ?? {};
  const privateNotes = filters.privateNotes;
  return {
    inboxIds: parseIdList(filters.inboxIds, 'Inbox IDs'),
    messageTypes: Array.isArray(filters.messageTypes) ? (filters.messageTypes as string[]) : [],
    privateNotes: privateNotes === 'exclude' || privateNotes === 'only' ? privateNotes : 'include',
    senderTypes: Array.isArray(filters.senderTypes) ? (filters.senderTypes as string[]) : [],
    ignoreUserIds: parseIdList(filters.ignoreUserIds, 'Ignore Messages From User IDs'),
    ignoreWhatsAppEchoes: filters.ignoreWhatsAppEchoes === true,
  };
}

function asObject(value: unknown): IDataObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as IDataObject)
    : undefined;
}

function toId(value: unknown): number | undefined {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === 'number' && Number.isFinite(id) ? id : undefined;
}

export function isMessageEvent(event: unknown): boolean {
  return event === 'message_created' || event === 'message_updated';
}

export function isTypingEvent(event: unknown): boolean {
  return event === 'conversation_typing_on' || event === 'conversation_typing_off';
}

export function isInboxEvent(event: unknown): boolean {
  return event === 'inbox_created' || event === 'inbox_updated';
}

/**
 * Inbox ID of an event payload:
 * - message_*, webwidget_triggered: `inbox.id`
 * - conversation_* (flat conversation object): `inbox_id`
 * - conversation_typing_*: `conversation.inbox_id`
 * - contact_*, inbox_*: none (these payloads carry no inbox ID)
 */
export function getEventInboxId(payload: IDataObject): number | undefined {
  return (
    toId(asObject(payload.inbox)?.id) ??
    toId(payload.inbox_id) ??
    toId(asObject(payload.conversation)?.inbox_id)
  );
}

export function getMessageType(payload: IDataObject): string | undefined {
  const type = payload.message_type;
  if (typeof type === 'number') return MESSAGE_TYPES_BY_INDEX[type];
  return typeof type === 'string' ? type : undefined;
}

/**
 * Sender type of a message payload. Contact#webhook_data has no `type`, so a sender object without one is a
 * contact; users, agent bots and Captain assistants carry 'user', 'agent_bot' and 'captain_assistant'.
 */
export function getSenderType(payload: IDataObject): string | undefined {
  const sender = asObject(payload.sender);
  if (!sender) return undefined;
  return typeof sender.type === 'string' && sender.type ? sender.type : 'contact';
}

/** Decide whether an (already authenticated) event should start the workflow. */
export function applyTriggerFilters(payload: IDataObject, filters: TriggerFilters): FilterResult {
  const event = payload.event;

  if (filters.inboxIds.length > 0) {
    const inboxId = getEventInboxId(payload);
    // Events that are not tied to an inbox (contact_*, inbox_*) are not affected by the inbox filter
    if (inboxId !== undefined && !filters.inboxIds.includes(inboxId)) {
      return { pass: false, reason: `inbox ${inboxId} is not in Inbox IDs` };
    }
  }

  if (filters.privateNotes !== 'include' && (isMessageEvent(event) || isTypingEvent(event))) {
    const isPrivate = isMessageEvent(event)
      ? payload.private === true
      : payload.is_private === true;
    if (filters.privateNotes === 'exclude' && isPrivate) {
      return { pass: false, reason: 'private note excluded' };
    }
    if (filters.privateNotes === 'only' && !isPrivate) {
      return { pass: false, reason: 'not a private note' };
    }
  }

  if (!isMessageEvent(event)) return { pass: true };

  const messageType = getMessageType(payload);
  if (filters.messageTypes.length > 0 && !filters.messageTypes.includes(messageType ?? '')) {
    return { pass: false, reason: `message type ${messageType ?? 'unknown'} not selected` };
  }

  const senderType = getSenderType(payload);
  if (filters.senderTypes.length > 0 && !filters.senderTypes.includes(senderType ?? '')) {
    return { pass: false, reason: `sender type ${senderType ?? 'none'} not selected` };
  }

  if (filters.ignoreUserIds.length > 0 && senderType === 'user') {
    const senderId = toId(asObject(payload.sender)?.id);
    if (senderId !== undefined && filters.ignoreUserIds.includes(senderId)) {
      return { pass: false, reason: `sent by ignored user ${senderId}` };
    }
  }

  if (
    filters.ignoreWhatsAppEchoes &&
    messageType === 'outgoing' &&
    typeof payload.source_id === 'string' &&
    payload.source_id.startsWith(WHATSAPP_SOURCE_ID_PREFIX)
  ) {
    return { pass: false, reason: 'outgoing WhatsApp echo (source_id WAID:)' };
  }

  return { pass: true };
}
