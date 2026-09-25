import type { IDataObject } from 'n8n-workflow';

// ============================================================================
// Chatwoot Trigger types
//
// Shapes verified against Chatwoot 4.18.0 (identical in 4.17.1 unless noted):
//   lib/webhooks/trigger.rb, app/listeners/webhook_listener.rb, app/listeners/agent_bot_listener.rb,
//   app/models/webhook.rb, app/views/api/v1/accounts/webhooks/*.jbuilder and the *webhook_data presenters.
// Every payload change between 4.13 and 4.18 is additive (nothing was removed or renamed).
// ============================================================================

/** Where the trigger receives events from. */
export type TriggerSource =
  /** The node registers an account webhook (POST /webhooks) on activation and deletes it on deactivation. */
  | 'accountWebhook'
  /** The user pastes the n8n URL into an agent bot / API channel inbox (or a webhook they manage) by hand. */
  | 'manual';

/**
 * Events accepted by account webhooks (Webhook::ALLOWED_WEBHOOK_EVENTS, same list in 4.13-4.18).
 * Chatwoot answers 422 when a subscription is not in this list.
 */
export type AccountWebhookEvent =
  | 'contact_created'
  | 'contact_updated'
  | 'conversation_created'
  | 'conversation_status_changed'
  | 'conversation_typing_off'
  | 'conversation_typing_on'
  | 'conversation_updated'
  | 'inbox_created'
  | 'inbox_updated'
  | 'message_created'
  | 'message_updated'
  | 'webwidget_triggered';

/** Events that only agent bots receive (AgentBotListener); account webhooks cannot subscribe to them. */
export type AgentBotOnlyEvent = 'conversation_opened' | 'conversation_resolved';

export type ChatwootTriggerEvent = AccountWebhookEvent | AgentBotOnlyEvent;

export const ACCOUNT_WEBHOOK_EVENTS: readonly AccountWebhookEvent[] = [
  'contact_created',
  'contact_updated',
  'conversation_created',
  'conversation_status_changed',
  'conversation_typing_off',
  'conversation_typing_on',
  'conversation_updated',
  'inbox_created',
  'inbox_updated',
  'message_created',
  'message_updated',
  'webwidget_triggered',
];

/** Account webhook as rendered by webhooks/_webhook.json.jbuilder. */
export interface IChatwootAccountWebhook extends IDataObject {
  id: number;
  name?: string | null;
  url: string;
  account_id?: number;
  subscriptions?: string[];
  /** Signing secret (Chatwoot 4.12+). Absent on older servers, which do not sign deliveries. */
  secret?: string | null;
  inbox?: { id: number; name: string } | null;
}

/** What the trigger keeps in the node's workflow static data (account webhook mode). */
export interface ITriggerStaticData extends IDataObject {
  /** Chatwoot webhook id (legacy key, kept for compatibility). */
  webhookId?: number;
  /** Signing secret of that webhook. '' = the server returned no secret (Chatwoot < 4.12, unsigned). */
  webhookSecret?: string;
  /** n8n URL the webhook was registered for (production and test URLs differ). */
  webhookUrl?: string;
}

// ----------------------------------------------------------------------------
// Payloads (TRIGGER-8)
// ----------------------------------------------------------------------------

/** `{ id, name }` (Account#webhook_data). Added to conversation_* and inbox_* payloads in 4.14.2. */
export interface IChatwootAccountRef extends IDataObject {
  id: number;
  name: string;
}

/** `{ id, name }` (Inbox#webhook_data). */
export interface IChatwootInboxRef extends IDataObject {
  id: number;
  name: string;
}

/**
 * changed_attributes as sent for conversation_status_changed, conversation_updated, contact_updated and
 * inbox_updated: an ARRAY of one-key objects, e.g. [{ status: { previous_value: 'open', current_value: 'resolved' } }].
 */
export type ChatwootChangedAttributes = Array<
  Record<string, { previous_value: unknown; current_value: unknown }>
>;

/**
 * Message sender (`sender.try(:webhook_data)`):
 * - contact: Contact#webhook_data (no `type` field)
 * - user (agent): { id, name, email, type: 'user' }
 * - agent bot: { id, name, type: 'agent_bot' }
 * - Captain assistant (Enterprise): { id, name, avatar_url, description, created_at, type: 'captain_assistant' }
 * - null when the message has no sender.
 */
export type ChatwootSenderType = 'contact' | 'user' | 'agent_bot' | 'captain_assistant';

/** message_created / message_updated (Message#webhook_data). */
export interface IChatwootMessageEventPayload extends IDataObject {
  event: 'message_created' | 'message_updated';
  id: number;
  /**
   * Normalized for webhooks: hard-break backslashes are removed (4.13+); releases after 4.13 also unescape
   * markdown delimiters and strip trailing newlines.
   */
  content: string | null;
  content_type: string;
  content_attributes: IDataObject;
  additional_attributes: IDataObject;
  /** 'incoming' | 'outgoing' | 'template'. Activity messages are never delivered to webhooks. */
  message_type: 'incoming' | 'outgoing' | 'template' | 'activity';
  /** true for private notes. */
  private: boolean;
  /** External id, e.g. 'WAID:<id>' for messages imported by Evolution API. */
  source_id: string | null;
  created_at: string;
  account: IChatwootAccountRef;
  inbox: IChatwootInboxRef;
  sender: IDataObject | null;
  /** Conversation#webhook_data (see IChatwootConversationEventPayload). */
  conversation: IDataObject;
  attachments?: IDataObject[];
}

/**
 * conversation_* events (Conversation#webhook_data, a flat object). `id` is the conversation DISPLAY id.
 * conversation_opened / conversation_resolved are only sent to agent bots.
 */
export interface IChatwootConversationEventPayload extends IDataObject {
  event:
    | 'conversation_created'
    | 'conversation_opened'
    | 'conversation_resolved'
    | 'conversation_status_changed'
    | 'conversation_updated';
  id: number;
  inbox_id: number;
  status: string;
  /** Channel type of the inbox, e.g. 'Channel::Api'. */
  channel: string;
  can_reply: boolean;
  contact_inbox: IDataObject;
  /** meta.sender = Contact#push_event_data (+ company_id when the 'companies' feature is on, 4.15+). */
  meta: IDataObject;
  /** The last non-activity, non-private message (normalized content). */
  messages: IDataObject[];
  labels: string[];
  additional_attributes: IDataObject;
  custom_attributes: IDataObject;
  priority: string | null;
  /** Added in 4.14.2. */
  account?: IChatwootAccountRef;
  changed_attributes?: ChatwootChangedAttributes;
  /** Enterprise with the 'sla' feature: null / [] when no SLA applies. */
  applied_sla?: IDataObject | null;
  sla_events?: IDataObject[];
  sla_policy_id?: number | null;
}

/** contact_created / contact_updated (Contact#webhook_data). contact_updated also carries changed_attributes. */
export interface IChatwootContactEventPayload extends IDataObject {
  event: 'contact_created' | 'contact_updated';
  id: number;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  identifier: string | null;
  account: IChatwootAccountRef;
  changed_attributes?: ChatwootChangedAttributes;
}

/**
 * inbox_created / inbox_updated (Inbox::EventDataPresenter#webhook_data). The payload has NO inbox id or name:
 * only the inbox configuration, `account` (4.14.2+) and the full `channel` record, which includes channel
 * secrets (API channel secret/hmac_token, e-mail passwords, bot tokens...). The trigger redacts them by default.
 * Chatwoot only emits these events when the server sets ENABLE_INBOX_EVENTS.
 */
export interface IChatwootInboxEventPayload extends IDataObject {
  event: 'inbox_created' | 'inbox_updated';
  channel: IDataObject;
  account?: IChatwootAccountRef;
  changed_attributes?: ChatwootChangedAttributes;
}

/** conversation_typing_on / conversation_typing_off. */
export interface IChatwootTypingEventPayload extends IDataObject {
  event: 'conversation_typing_on' | 'conversation_typing_off';
  /** User#webhook_data of whoever is typing. */
  user: IDataObject;
  conversation: IDataObject;
  /** true while an agent types a private note. */
  is_private: boolean;
}

/** webwidget_triggered (ContactInbox#webhook_data + event_info). */
export interface IChatwootWebwidgetEventPayload extends IDataObject {
  event: 'webwidget_triggered';
  id: number;
  contact: IDataObject;
  inbox: IChatwootInboxRef;
  account: IChatwootAccountRef;
  current_conversation: IDataObject | null;
  source_id: string;
  event_info: IDataObject;
}

export type ChatwootTriggerPayload =
  | IChatwootMessageEventPayload
  | IChatwootConversationEventPayload
  | IChatwootContactEventPayload
  | IChatwootInboxEventPayload
  | IChatwootTypingEventPayload
  | IChatwootWebwidgetEventPayload;
