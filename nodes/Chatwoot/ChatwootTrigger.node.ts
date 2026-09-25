import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { chatwootApiRequest, getHttpStatus } from './GenericFunctions';
import type { FilterResult } from './trigger/filters';
import { applyTriggerFilters, isInboxEvent, parseTriggerFilters } from './trigger/filters';
import {
  buildWebhookName,
  deleteAccountWebhook,
  extractWebhook,
  forgetWebhook,
  invalidateWebhookRecovery,
  isPrivateNetworkUrl,
  isSameNodeWebhookPath,
  listAccountWebhooks,
  recoverWebhookSecret,
  rememberWebhook,
  sameSubscriptions,
} from './trigger/lifecycle';
import { redactInboxEventSecrets } from './trigger/redact';
import {
  DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  DELIVERY_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  describeSignatureFailure,
  verifyChatwootSignature,
} from './trigger/signature';
import type { IChatwootAccountWebhook, ITriggerStaticData, TriggerSource } from './trigger/types';
import { ACCOUNT_WEBHOOK_EVENTS } from './trigger/types';

type TriggerContext = IHookFunctions | IWebhookFunctions;

function getSource(ctx: TriggerContext): TriggerSource {
  return ctx.getNodeParameter('source', 'accountWebhook') === 'manual'
    ? 'manual'
    : 'accountWebhook';
}

function getWebhookUrl(ctx: TriggerContext): string {
  const url = ctx.getNodeWebhookUrl('default');
  if (!url)
    throw new NodeOperationError(ctx.getNode(), 'n8n did not provide a webhook URL for this node');
  return url;
}

/** Events for the account webhook `subscriptions`; Chatwoot answers 422 for an empty or unknown list. */
function getAccountEvents(ctx: IHookFunctions): string[] {
  const events = ctx.getNodeParameter('events', []) as string[];
  if (!Array.isArray(events) || events.length === 0) {
    throw new NodeOperationError(ctx.getNode(), 'Select at least one event', {
      description: 'Chatwoot rejects account webhooks without subscriptions.',
    });
  }
  const unsupported = events.filter(
    (event) => !(ACCOUNT_WEBHOOK_EVENTS as readonly string[]).includes(event),
  );
  if (unsupported.length > 0) {
    throw new NodeOperationError(
      ctx.getNode(),
      `Account webhooks cannot subscribe to: ${unsupported.join(', ')}`,
      {
        description: 'Use the "Agent Bot / API Channel (Manual URL)" source for agent bot events.',
      },
    );
  }
  return events;
}

function getFilters(ctx: TriggerContext) {
  try {
    return parseTriggerFilters(ctx.getNodeParameter('filters', {}) as IDataObject);
  } catch (error) {
    throw new NodeOperationError(ctx.getNode(), (error as Error).message);
  }
}

/** Manual source secret; trimmed, as a copied secret often carries a trailing newline or space. */
function getSigningSecret(ctx: TriggerContext): string {
  const secret = ctx.getNodeParameter('signingSecret', '') as unknown;
  return typeof secret === 'string' ? secret.trim() : '';
}

function getWebhookName(ctx: IHookFunctions): string {
  // getWorkflow() is always there in n8n; guarded for hosts/tests that do not provide it
  const workflowName = typeof ctx.getWorkflow === 'function' ? ctx.getWorkflow()?.name : undefined;
  return buildWebhookName(workflowName, ctx.getNode().name, ctx.getMode() === 'manual');
}

/** Store an existing account webhook, first aligning its subscriptions (and empty name) with the node. */
async function adoptWebhook(
  ctx: IHookFunctions,
  webhook: IChatwootAccountWebhook,
  events: string[],
  url: string,
): Promise<void> {
  const patch: IDataObject = {};
  if (!sameSubscriptions(webhook.subscriptions, events)) patch.subscriptions = events;
  if (!webhook.name) patch.name = getWebhookName(ctx);
  let current = webhook;
  if (Object.keys(patch).length > 0) {
    const response = await chatwootApiRequest.call(ctx, 'PATCH', `/webhooks/${webhook.id}`, patch);
    current = extractWebhook(response) ?? { ...webhook, ...patch };
  }
  rememberWebhook(ctx.getWorkflowStaticData('node') as ITriggerStaticData, current, url);
}

function headerValue(headers: IDataObject, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** The exact bytes Chatwoot signed. n8n keeps them in req.rawBody when it parses the body. */
async function getRawBody(ctx: IWebhookFunctions, body: IDataObject): Promise<Buffer> {
  const req = ctx.getRequestObject();
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.readRawBody === 'function') {
    try {
      await req.readRawBody();
    } catch {
      // The stream was already consumed: fall back to the parsed body below
    }
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  }
  return Buffer.from(JSON.stringify(body ?? {}), 'utf8');
}

type AuthResult = { ok: true; verified: boolean } | { ok: false; reason: string };

/**
 * Authenticate a delivery with X-Chatwoot-Signature.
 * - Manual source: the Signing Secret parameter is required.
 * - Account webhook: the secret stored at activation, recovered from GET /webhooks (by URL) when the static
 *   data has none (workflows activated with 0.8.x). Chatwoot < 4.12 does not sign: unsigned deliveries are
 *   accepted only while no secret is known for the webhook.
 */
async function authenticateDelivery(
  ctx: IWebhookFunctions,
  source: TriggerSource,
  rawBody: Buffer,
  headers: IDataObject,
  toleranceSeconds: number,
): Promise<AuthResult> {
  const signature = headerValue(headers, SIGNATURE_HEADER);
  const timestamp = headerValue(headers, TIMESTAMP_HEADER);
  const verify = (secret: string) =>
    verifyChatwootSignature({ secret, signature, timestamp, rawBody, toleranceSeconds });

  if (source === 'manual') {
    const check = verify(getSigningSecret(ctx));
    return check.valid
      ? { ok: true, verified: true }
      : { ok: false, reason: describeSignatureFailure(check.reason) };
  }

  const url = getWebhookUrl(ctx);
  // n8n keeps test and production registrations in separate static data, so a stored secret always belongs
  // to this node's webhook (possibly registered under an older n8n URL: tried first, recovered on mismatch)
  const staticData = ctx.getWorkflowStaticData('node') as ITriggerStaticData;
  let secret = typeof staticData.webhookSecret === 'string' ? staticData.webhookSecret : undefined;
  let recovered = false;

  // Unknown secret, or an unsigned (pre-4.12) webhook that now sends signatures: ask Chatwoot
  if (secret === undefined || (secret === '' && signature)) {
    const result = await recoverWebhookSecret.call(ctx, url, staticData);
    recovered = true;
    if (result.status === 'found') {
      secret = result.secret;
    } else if (result.status === 'not_found') {
      return {
        ok: false,
        reason:
          'no Chatwoot account webhook is registered for this URL (reactivate the workflow, or use the "Agent Bot / API Channel (Manual URL)" source for agent bots and API channels)',
      };
    } else {
      // Could not reach the Chatwoot API: keep workflows activated before 0.9.0 working
      ctx.logger.warn(
        `Chatwoot Trigger: accepting an unverified delivery because the webhook secret could not be loaded (${result.message})`,
      );
      return { ok: true, verified: false };
    }
  }

  // Chatwoot < 4.12: the webhook has no secret and deliveries are not signed
  if (secret === '') return { ok: true, verified: false };

  let check = verify(secret);
  if (!check.valid && check.reason === 'signature_mismatch' && !recovered) {
    // The secret may have been reset in Chatwoot since activation (rate limited per URL)
    const result = await recoverWebhookSecret.call(ctx, url, staticData);
    if (result.status === 'found' && result.secret && result.secret !== secret) {
      check = verify(result.secret);
    } else if (result.status === 'error') {
      ctx.logger.warn(
        `Chatwoot Trigger: could not reload the webhook secret after a signature mismatch (${result.message})`,
      );
    }
  }
  return check.valid
    ? { ok: true, verified: true }
    : { ok: false, reason: describeSignatureFailure(check.reason) };
}

export class ChatwootTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Chatwoot Trigger',
    name: 'chatwootTrigger',
    icon: 'file:chatwoot.svg',
    group: ['trigger'],
    version: 1,
    subtitle:
      '={{$parameter["source"] === "manual" ? "Manual URL: " + (($parameter["manualEvents"] || []).join(", ") || "all events") : ($parameter["events"] || []).join(", ")}}',
    description: 'Starts the workflow when Chatwoot events occur',
    defaults: {
      name: 'Chatwoot Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'chatwootApi',
        required: true,
        displayOptions: {
          show: {
            source: ['accountWebhook'],
          },
        },
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName:
          'Chatwoot 4.14+ only delivers webhooks to public IP addresses. If Chatwoot reaches this n8n URL through a private address (Docker service name, localhost, 10.x, 172.16-31.x, 192.168.x), set SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true on the Chatwoot server (available since 4.14.1), otherwise every delivery is dropped silently (Chatwoot only logs "Invalid webhook URL").',
        name: 'privateNetworkNotice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Source',
        name: 'source',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Account Webhook (Automatic)',
            value: 'accountWebhook',
            description:
              'n8n creates a Chatwoot account webhook for this URL when the workflow is activated, stores its signing secret and deletes it on deactivation. Needs an administrator API access token (on Chatwoot Cloud, a plan with API and webhooks). Do not paste this URL into an agent bot or API channel: they sign with their own secret and are rejected with HTTP 401 (use the Manual URL source for them).',
          },
          {
            name: 'Agent Bot / API Channel (Manual URL)',
            value: 'manual',
            description:
              'You paste this URL into an agent bot, an API channel inbox or a webhook you manage in Chatwoot, and provide its signing secret. n8n registers nothing in Chatwoot.',
          },
        ],
        default: 'accountWebhook',
        description: 'How Chatwoot delivers events to this trigger',
      },
      {
        displayName:
          "Paste this node's Production URL (or the Test URL while testing) into Chatwoot: the agent bot's Webhook URL (Settings > Bots), the API channel inbox's Webhook URL (Settings > Inboxes > the inbox > Settings) or a webhook in Settings > Integrations > Webhooks. Then copy its Webhook Secret into Signing Secret. Agent bots: when n8n answers with an error (workflow inactive, invalid signature), Chatwoot moves pending conversations to Open unless the account keeps them pending on bot failure.",
        name: 'manualSetupNotice',
        type: 'notice',
        default: '',
        displayOptions: {
          show: {
            source: ['manual'],
          },
        },
      },
      {
        displayName: 'Signing Secret',
        name: 'signingSecret',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        displayOptions: {
          show: {
            source: ['manual'],
          },
        },
        description:
          'The Webhook Secret of the agent bot, API channel inbox or webhook that calls this URL (Chatwoot 4.13+; administrators can also read it as `secret` with Agent Bot > Get or Inbox > Get). Deliveries are verified with X-Chatwoot-Signature; required unless Verify Signature is turned off.',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: [],
        displayOptions: {
          show: {
            source: ['accountWebhook'],
          },
        },
        options: [
          {
            name: 'Contact Created',
            value: 'contact_created',
            description:
              'A contact is created. Payload: the contact (id, name, email, phone_number, identifier, custom_attributes, account).',
          },
          {
            name: 'Contact Updated',
            value: 'contact_updated',
            description: 'A contact changes. Payload: the contact plus changed_attributes.',
          },
          {
            name: 'Conversation Created',
            value: 'conversation_created',
            description:
              'A conversation is created. Payload: the conversation (id is the display ID, inbox_id, status, meta.sender, last message, account).',
          },
          {
            name: 'Conversation Status Changed',
            value: 'conversation_status_changed',
            description:
              'A conversation changes status (open, resolved, pending, snoozed). Includes changed_attributes.',
          },
          {
            name: 'Conversation Typing Off',
            value: 'conversation_typing_off',
            description:
              'Someone stops typing in a conversation. Payload: user, conversation, is_private.',
          },
          {
            name: 'Conversation Typing On',
            value: 'conversation_typing_on',
            description:
              'Someone starts typing in a conversation. Payload: user, conversation, is_private.',
          },
          {
            name: 'Conversation Updated',
            value: 'conversation_updated',
            description:
              'A conversation attribute changes (assignee, team, labels, custom attributes...). Includes changed_attributes.',
          },
          {
            name: 'Inbox Created',
            value: 'inbox_created',
            description:
              'An inbox is created. Only sent when the Chatwoot server sets ENABLE_INBOX_EVENTS. The payload has the inbox settings and channel but no inbox ID; channel secrets are redacted by default.',
          },
          {
            name: 'Inbox Updated',
            value: 'inbox_updated',
            description:
              'An inbox changes (includes changed_attributes). Only sent when the Chatwoot server sets ENABLE_INBOX_EVENTS; channel secrets are redacted by default.',
          },
          {
            name: 'Message Created',
            value: 'message_created',
            description:
              'A message is created: incoming, outgoing (including your own API replies), template and private notes. Use Filters to keep only what the workflow needs.',
          },
          {
            name: 'Message Updated',
            value: 'message_updated',
            description: 'A message changes (content edit, delivery status, attributes)',
          },
          {
            name: 'Webwidget Triggered',
            value: 'webwidget_triggered',
            description:
              'A visitor opens the website live-chat widget. Payload: contact, inbox, current_conversation, event_info.',
          },
        ],
        description:
          'Events the Chatwoot account webhook subscribes to. They are delivered for every inbox of the account; use Filters to narrow them.',
      },
      {
        displayName: 'Events',
        name: 'manualEvents',
        type: 'multiOptions',
        default: [],
        displayOptions: {
          show: {
            source: ['manual'],
          },
        },
        options: [
          {
            name: 'Contact Created',
            value: 'contact_created',
            description: 'Account webhooks only',
          },
          {
            name: 'Contact Updated',
            value: 'contact_updated',
            description: 'Account webhooks only',
          },
          {
            name: 'Conversation Created',
            value: 'conversation_created',
            description: 'API channels and account webhooks (not agent bots)',
          },
          {
            name: 'Conversation Opened',
            value: 'conversation_opened',
            description: 'Agent bots only: a conversation is (re)opened',
          },
          {
            name: 'Conversation Resolved',
            value: 'conversation_resolved',
            description: 'Agent bots only: a conversation is resolved',
          },
          {
            name: 'Conversation Status Changed',
            value: 'conversation_status_changed',
            description: 'All sources. Includes changed_attributes.',
          },
          {
            name: 'Conversation Typing Off',
            value: 'conversation_typing_off',
            description: 'API channels and account webhooks',
          },
          {
            name: 'Conversation Typing On',
            value: 'conversation_typing_on',
            description: 'API channels and account webhooks',
          },
          {
            name: 'Conversation Updated',
            value: 'conversation_updated',
            description: 'All sources. Includes changed_attributes.',
          },
          {
            name: 'Inbox Created',
            value: 'inbox_created',
            description: 'Account webhooks only, when the server sets ENABLE_INBOX_EVENTS',
          },
          {
            name: 'Inbox Updated',
            value: 'inbox_updated',
            description: 'Account webhooks only, when the server sets ENABLE_INBOX_EVENTS',
          },
          {
            name: 'Message Created',
            value: 'message_created',
            description:
              'All sources: incoming, outgoing and template messages and private notes of the inbox',
          },
          {
            name: 'Message Updated',
            value: 'message_updated',
            description: 'All sources',
          },
          {
            name: 'Webwidget Triggered',
            value: 'webwidget_triggered',
            description:
              'Agent bots and account webhooks (website inboxes only; API channels never receive it): a visitor opens the live-chat widget',
          },
        ],
        description:
          'Events that start the workflow. Leave empty to accept every event. Other events are answered with HTTP 200 and ignored (API channels and agent bots send all their events).',
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        description:
          'Skip events before a workflow execution starts. Skipped events are answered with HTTP 200.',
        options: [
          {
            displayName: 'Ignore Messages From User IDs',
            name: 'ignoreUserIds',
            type: 'string',
            default: '',
            placeholder: '3, 7',
            description:
              "Comma-separated Chatwoot user (agent) IDs whose messages are skipped, e.g. the user that owns the API access token your workflow replies with. Avoids loops while still receiving other agents' messages.",
          },
          {
            displayName: 'Ignore Outgoing WhatsApp Echoes (Evolution API)',
            name: 'ignoreWhatsAppEchoes',
            type: 'boolean',
            default: false,
            description:
              'Whether to skip outgoing messages (message_created and message_updated) whose source_id starts with "WAID:". Evolution API imports messages sent from the WhatsApp phone or through its own send endpoints that way, so a workflow replying through Evolution API does not trigger itself.',
          },
          {
            displayName: 'Inbox IDs',
            name: 'inboxIds',
            type: 'string',
            default: '',
            placeholder: '1, 4',
            description:
              'Comma-separated inbox IDs. Only events of these inboxes start the workflow (Chatwoot account webhooks are account-wide). Contact and inbox events carry no inbox ID and are not affected.',
          },
          {
            displayName: 'Message Types',
            name: 'messageTypes',
            type: 'multiOptions',
            default: [],
            options: [
              {
                name: 'Activity',
                value: 'activity',
                description: 'System messages; Chatwoot currently never sends them to webhooks',
              },
              {
                name: 'Incoming',
                value: 'incoming',
                description: 'Sent by the contact',
              },
              {
                name: 'Outgoing',
                value: 'outgoing',
                description:
                  'Sent by agents, bots, the API (including your own replies) or from the WhatsApp phone',
              },
              {
                name: 'Template',
                value: 'template',
                description: 'Template messages (e.g. CSAT, WhatsApp templates)',
              },
            ],
            description:
              'Message events (message_created, message_updated) whose message_type is not selected are skipped. Leave empty for all.',
          },
          {
            displayName: 'Private Notes',
            name: 'privateNotes',
            type: 'options',
            default: 'include',
            options: [
              {
                name: 'Include',
                value: 'include',
                description: 'Messages and private notes',
              },
              {
                name: 'Exclude',
                value: 'exclude',
                description: 'Skip private notes',
              },
              {
                name: 'Only Private Notes',
                value: 'only',
                description: 'Skip everything that is not a private note',
              },
            ],
            description:
              'How to treat private notes (message `private` = true) in message events; also applies to typing events of private notes (is_private)',
          },
          {
            displayName: 'Sender Types',
            name: 'senderTypes',
            type: 'multiOptions',
            default: [],
            options: [
              {
                name: 'Agent',
                value: 'user',
                description: 'A Chatwoot user (UI or a user API access token)',
              },
              {
                name: 'Agent Bot',
                value: 'agent_bot',
                description: 'An agent bot (agent bot access token)',
              },
              {
                name: 'Captain Assistant',
                value: 'captain_assistant',
                description: 'Captain AI assistant (Enterprise)',
              },
              {
                name: 'Contact',
                value: 'contact',
                description: 'The customer',
              },
            ],
            description:
              'Message events whose sender is not one of these types are skipped (messages without a sender too). Leave empty for all.',
          },
        ],
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Include Delivery Info',
            name: 'includeDeliveryInfo',
            type: 'boolean',
            default: false,
            description:
              'Whether to add `webhookDelivery` with the X-Chatwoot-Delivery ID (use it to deduplicate agent bot retries), the X-Chatwoot-Timestamp, the X-Chatwoot-Signature and whether the signature was verified',
          },
          {
            displayName: 'Include Raw Body',
            name: 'includeRawBody',
            type: 'boolean',
            default: false,
            description:
              'Whether to add `rawBody`: the exact JSON text Chatwoot sent (the bytes the signature covers). Not added to inbox events while Redact Channel Secrets is on.',
          },
          {
            displayName: 'Redact Channel Secrets',
            name: 'redactChannelSecrets',
            type: 'boolean',
            default: true,
            description:
              'Whether to replace secrets inside the `channel` object of inbox_created / inbox_updated (API channel secret and HMAC token, e-mail passwords, bot and access tokens, provider API keys) with "[REDACTED]" before n8n stores the execution',
          },
          {
            displayName: 'Signature Tolerance (Seconds)',
            name: 'signatureTolerance',
            type: 'number',
            typeOptions: {
              minValue: 0,
            },
            default: DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
            description:
              'Maximum age of X-Chatwoot-Timestamp, in seconds, to block replayed requests. 0 disables the timestamp check (the signature is still verified).',
          },
          {
            displayName: 'Verify Signature',
            name: 'verifySignature',
            type: 'boolean',
            default: true,
            description:
              'Whether to verify X-Chatwoot-Signature (HMAC-SHA256 of the timestamp and raw body) and answer HTTP 401 to invalid requests. On by default. Turn it off only for servers that do not sign: Chatwoot before 4.12 (account webhooks) or 4.13 (agent bots, API channels).',
          },
        ],
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        // Validate the filters on activation so a typo fails here instead of silently at delivery time
        getFilters(this);

        if (getSource(this) === 'manual') {
          const options = this.getNodeParameter('options', {}) as IDataObject;
          if (options.verifySignature !== false && !getSigningSecret(this)) {
            throw new NodeOperationError(this.getNode(), 'Signing Secret is required', {
              description:
                'Copy the Webhook Secret of the agent bot, API channel inbox or webhook that calls this URL, or turn off Options > Verify Signature (servers that do not sign).',
            });
          }
          // Nothing to register: the URL is configured in Chatwoot by hand
          return true;
        }

        const url = getWebhookUrl(this);
        const events = getAccountEvents(this);
        const staticData = this.getWorkflowStaticData('node') as ITriggerStaticData;
        invalidateWebhookRecovery(url);

        let webhooks: IChatwootAccountWebhook[];
        try {
          webhooks = await listAccountWebhooks.call(this);
        } catch (error) {
          // Only "not found" means there is nothing to reuse; auth/network errors are shown to the user
          if (getHttpStatus(error) !== 404) throw error;
          forgetWebhook(staticData);
          return false;
        }

        const current = webhooks.find((webhook) => webhook.url === url);

        // A webhook stored for an older URL of this node (WEBHOOK_URL changed) is deleted, but only when it is
        // provably ours: it still points at the stored URL (a webhook edited by hand in Chatwoot is kept), that
        // URL ends with this node's webhook path (static data copied from another node or workflow is ignored)
        // and this is a production registration ("Listen for test event" never deletes a webhook)
        if (staticData.webhookId !== undefined && current?.id !== staticData.webhookId) {
          const stored = webhooks.find((webhook) => webhook.id === staticData.webhookId);
          if (
            stored &&
            this.getMode() !== 'manual' &&
            staticData.webhookUrl &&
            stored.url === staticData.webhookUrl &&
            stored.url !== url &&
            isSameNodeWebhookPath(stored.url, url)
          ) {
            await deleteAccountWebhook.call(this, Number(stored.id));
          }
          forgetWebhook(staticData);
        }

        if (!current) return false;

        // Reuse it (also recovers id + secret for workflows activated with 0.8.x)
        await adoptWebhook(this, current, events, url);
        return true;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        if (getSource(this) === 'manual') return true;

        const url = getWebhookUrl(this);
        const events = getAccountEvents(this);
        const staticData = this.getWorkflowStaticData('node') as ITriggerStaticData;
        invalidateWebhookRecovery(url);

        if (isPrivateNetworkUrl(url)) {
          this.logger.warn(
            `Chatwoot Trigger: the webhook URL ${url} looks like a private address. Chatwoot 4.14+ drops deliveries to private networks unless SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true is set on the Chatwoot server.`,
          );
        }

        let response: IDataObject | IDataObject[];
        try {
          response = await chatwootApiRequest.call(this, 'POST', '/webhooks', {
            name: getWebhookName(this),
            url,
            subscriptions: events,
          });
        } catch (error) {
          if (getHttpStatus(error) !== 422) throw error;
          // 422 is usually "Url has already been taken": the webhook exists (created concurrently or
          // missed by checkExists), so reuse it. Any other validation error is rethrown as-is.
          const existing = (await listAccountWebhooks.call(this)).find(
            (webhook) => webhook.url === url,
          );
          if (!existing) throw error;
          await adoptWebhook(this, existing, events, url);
          return true;
        }

        const webhook = extractWebhook(response);
        if (!webhook) {
          throw new NodeOperationError(
            this.getNode(),
            'Chatwoot did not return the created webhook',
            {
              description: `Unexpected response from POST /webhooks: ${JSON.stringify(response).slice(0, 500)}`,
            },
          );
        }
        rememberWebhook(staticData, webhook, url);
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        if (getSource(this) === 'manual') return true;

        const url = getWebhookUrl(this);
        const staticData = this.getWorkflowStaticData('node') as ITriggerStaticData;
        invalidateWebhookRecovery(url);

        let id = staticData.webhookId;
        if (id === undefined) {
          // No stored id (e.g. activated with 0.8.x, which never stored it): find our webhook by URL
          try {
            id = (await listAccountWebhooks.call(this)).find((webhook) => webhook.url === url)?.id;
          } catch (error) {
            if (getHttpStatus(error) !== 404) throw error;
          }
        }
        if (id !== undefined) await deleteAccountWebhook.call(this, Number(id));

        forgetWebhook(staticData);
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const source = getSource(this);
    const options = this.getNodeParameter('options', {}) as IDataObject;
    const headers = this.getHeaderData() as IDataObject;
    const body = this.getBodyData() as IDataObject;
    const res = this.getResponseObject();
    const rawBody = await getRawBody(this, body);

    let signatureVerified = false;
    if (options.verifySignature !== false) {
      const tolerance =
        typeof options.signatureTolerance === 'number'
          ? options.signatureTolerance
          : DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
      const auth = await authenticateDelivery(this, source, rawBody, headers, tolerance);
      if (!auth.ok) {
        this.logger.warn(`Chatwoot Trigger: rejected a delivery with HTTP 401: ${auth.reason}`);
        res.status(401).json({ message: 'Unauthorized: invalid X-Chatwoot-Signature' });
        return { noWebhookResponse: true };
      }
      signatureVerified = auth.verified;
    }

    // Answer skipped events right away with 200 (an unanswered request makes Chatwoot wait for its
    // WEBHOOK_TIMEOUT and, for agent bots / API channels, treat the delivery as failed)
    const ignore = (reason: string): IWebhookResponseData => {
      this.logger.debug(`Chatwoot Trigger: ignored ${String(body.event)}: ${reason}`);
      res.status(200).json({ received: true, ignored: true });
      return { noWebhookResponse: true };
    };

    const eventType = body.event as string | undefined;
    const selected = (
      source === 'manual'
        ? this.getNodeParameter('manualEvents', [])
        : this.getNodeParameter('events', [])
    ) as string[];
    if (selected.length > 0 && !selected.includes(eventType ?? '')) {
      return ignore('event not selected');
    }

    const filterResult: FilterResult = applyTriggerFilters(body, getFilters(this));
    if (!filterResult.pass) return ignore(filterResult.reason);

    const redact = options.redactChannelSecrets !== false && isInboxEvent(eventType);
    let returnData: IDataObject = {
      event: eventType,
      ...body,
    };
    if (redact) returnData = redactInboxEventSecrets(returnData);

    // The exact JSON Chatwoot sent (not the parsed object); omitted when it would leak redacted secrets
    if (options.includeRawBody && !redact) {
      returnData.rawBody = rawBody.toString('utf8');
    }

    if (options.includeDeliveryInfo) {
      const timestamp = headerValue(headers, TIMESTAMP_HEADER);
      returnData.webhookDelivery = {
        id: headerValue(headers, DELIVERY_HEADER) ?? null,
        timestamp: timestamp && /^\d+$/.test(timestamp) ? Number(timestamp) : null,
        // The HMAC itself (not a secret), for workflows that verify it themselves with the raw body
        signature: headerValue(headers, SIGNATURE_HEADER) ?? null,
        signatureVerified,
        source,
      };
    }

    return {
      workflowData: [this.helpers.returnJsonArray([returnData])],
    };
  }
}
