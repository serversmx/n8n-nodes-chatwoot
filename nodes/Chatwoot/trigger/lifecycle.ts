import type { IDataObject } from 'n8n-workflow';

import type { ChatwootContext, ChatwootRequestOptions } from '../GenericFunctions';
import { chatwootApiRequest, getHttpStatus } from '../GenericFunctions';
import type { IChatwootAccountWebhook, ITriggerStaticData } from './types';

// ============================================================================
// Account webhook lifecycle helpers (TRIGGER-1 / RELEASE-3)
//
// Chatwoot 4.x (same in 4.13, 4.17.1 and 4.18.0) wraps the webhooks API responses:
//   GET  /webhooks      -> { payload: { webhooks: [ {id, name, url, account_id, subscriptions, secret, inbox?} ] } }
//   POST /webhooks      -> { payload: { webhook: {...} } }
//   PATCH /webhooks/:id -> { payload: { webhook: {...} } }
//   DELETE /webhooks/:id -> head :ok (404 when it no longer exists)
// The URL is unique per account (422 "Url has already been taken" on a duplicate) and every endpoint is
// administrator-only (401 "You are not authorized to do this action" for agent tokens).
// ============================================================================

function asObject(value: unknown): IDataObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as IDataObject)
    : undefined;
}

function isWebhook(value: unknown): value is IChatwootAccountWebhook {
  const object = asObject(value);
  return object !== undefined && object.id !== undefined && object.id !== null;
}

/** Webhooks from GET /webhooks: payload.webhooks (4.x), with fallbacks for flat shapes. */
export function extractWebhookList(response: unknown): IChatwootAccountWebhook[] {
  const payload = asObject(response)?.payload;
  const candidates = [asObject(payload)?.webhooks, payload, response];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isWebhook);
  }
  return [];
}

/** Webhook from POST/PATCH /webhooks: payload.webhook (4.x), with fallbacks for flat shapes. */
export function extractWebhook(response: unknown): IChatwootAccountWebhook | undefined {
  const payload = asObject(response)?.payload;
  const candidates = [asObject(payload)?.webhook, payload, response];
  return candidates.find(isWebhook);
}

export async function listAccountWebhooks(
  this: ChatwootContext,
  options: ChatwootRequestOptions = {},
): Promise<IChatwootAccountWebhook[]> {
  return extractWebhookList(
    await chatwootApiRequest.call(this, 'GET', '/webhooks', {}, {}, options),
  );
}

/** DELETE /webhooks/:id; a 404 (already deleted in Chatwoot) is not an error. Other errors are thrown. */
export async function deleteAccountWebhook(this: ChatwootContext, id: number): Promise<void> {
  try {
    await chatwootApiRequest.call(this, 'DELETE', `/webhooks/${id}`);
  } catch (error) {
    if (getHttpStatus(error) !== 404) throw error;
  }
}

export function sameSubscriptions(current: unknown, wanted: readonly string[]): boolean {
  if (!Array.isArray(current)) return false;
  const a = [...new Set(current.map(String))].sort();
  const b = [...new Set(wanted)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function webhookPathTail(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split('/').filter((segment) => segment !== '');
    return segments.length >= 2 ? segments.slice(-2).join('/') : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether two n8n webhook URLs belong to the same trigger node. n8n builds them as
 * `<WEBHOOK_URL>/<endpoint>/<node webhookId>/webhook`: the last two segments survive a change of WEBHOOK_URL or of
 * the endpoint, while any other node or workflow has another webhookId. Test and production URLs of one node
 * share the same tail, so callers must not use this to tell them apart.
 */
export function isSameNodeWebhookPath(a: string, b: string): boolean {
  const tail = webhookPathTail(a);
  return tail !== undefined && tail === webhookPathTail(b);
}

/** Name shown in Chatwoot's webhook list, e.g. "n8n / Support bot / Chatwoot Trigger (test)". */
export function buildWebhookName(
  workflowName: string | undefined,
  nodeName: string | undefined,
  isTest: boolean,
): string {
  const parts = ['n8n', workflowName?.trim(), nodeName?.trim()].filter((part) => !!part);
  return `${parts.join(' / ')}${isTest ? ' (test)' : ''}`.slice(0, 255);
}

// ----------------------------------------------------------------------------
// Static data
// ----------------------------------------------------------------------------

export function rememberWebhook(
  staticData: ITriggerStaticData,
  webhook: IChatwootAccountWebhook,
  url: string,
): void {
  staticData.webhookId = Number(webhook.id);
  // No `secret` in the response = Chatwoot < 4.12, which does not sign deliveries
  staticData.webhookSecret = typeof webhook.secret === 'string' ? webhook.secret : '';
  staticData.webhookUrl = url;
}

export function forgetWebhook(staticData: ITriggerStaticData): void {
  delete staticData.webhookId;
  delete staticData.webhookSecret;
  delete staticData.webhookUrl;
}

// ----------------------------------------------------------------------------
// Secret recovery for workflows activated before the secret was stored (0.8.x never stored it)
// ----------------------------------------------------------------------------

export type RecoveryResult =
  | { status: 'found'; id: number; secret: string; fetchedAt: number }
  | { status: 'not_found'; fetchedAt: number }
  | { status: 'error'; message: string; fetchedAt: number };

/** At most one GET /webhooks per trigger URL per interval, whatever the request rate. */
export const RECOVERY_INTERVAL_MS = 60_000;

/**
 * The lookup runs while Chatwoot waits for the delivery's answer (WEBHOOK_TIMEOUT, 5 s by default), so it is
 * never retried (the default policy can wait ~35 s on a 429) and gives up after this many milliseconds.
 */
export const RECOVERY_TIMEOUT_MS = 3_000;

const recoveryCache = new Map<string, RecoveryResult>();

/** Tests only. */
export function clearWebhookRecoveryCache(): void {
  recoveryCache.clear();
}

export function getCachedRecovery(url: string, now = Date.now()): RecoveryResult | undefined {
  const cached = recoveryCache.get(url);
  return cached && now - cached.fetchedAt < RECOVERY_INTERVAL_MS ? cached : undefined;
}

/**
 * Look the webhook registered for `url` up in Chatwoot (rate limited per URL) and store its id/secret in the
 * node's static data. Never throws: API failures are returned as { status: 'error' }.
 */
export async function recoverWebhookSecret(
  this: ChatwootContext,
  url: string,
  staticData: ITriggerStaticData,
  now = Date.now(),
): Promise<RecoveryResult> {
  // A cached result is returned as-is and never written back: static data stored by a later activation wins
  const cached = getCachedRecovery(url, now);
  if (cached) return cached;

  let result: RecoveryResult;
  try {
    const webhooks = await listAccountWebhooks.call(this, {
      retry: false,
      timeout: RECOVERY_TIMEOUT_MS,
    });
    const webhook = webhooks.find((entry) => entry.url === url);
    if (webhook) {
      rememberWebhook(staticData, webhook, url);
      result = {
        status: 'found',
        id: Number(webhook.id),
        secret: staticData.webhookSecret ?? '',
        fetchedAt: now,
      };
    } else {
      result = { status: 'not_found', fetchedAt: now };
    }
  } catch (error) {
    result = { status: 'error', message: (error as Error).message, fetchedAt: now };
  }
  recoveryCache.set(url, result);
  return result;
}

/** Drop the cached lookup for `url` (called by checkExists/create/delete, which store fresh data). */
export function invalidateWebhookRecovery(url: string): void {
  recoveryCache.delete(url);
}

// ----------------------------------------------------------------------------
// Private network detection (TRIGGER-5 / RELEASE-10 / ADMIN-7 / EVOCW-1)
// ----------------------------------------------------------------------------

function isPrivateIPv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Heuristic: does this URL obviously point at a private network? Chatwoot 4.14+ sends webhooks through
 * SafeFetch/SsrfFilter and silently drops deliveries to private/loopback addresses unless the server sets
 * SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true. Public host names that resolve to private IPs cannot be detected here.
 */
export function isPrivateNetworkUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.includes(':')) {
    // IPv6: loopback, unique local (fc00::/7), link local (fe80::/10)
    return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIPv4(host);
  return (
    host === 'localhost' ||
    !host.includes('.') || // Docker service names such as "n8n"
    /\.(localhost|local|internal|lan|home|docker)$/.test(host)
  );
}
