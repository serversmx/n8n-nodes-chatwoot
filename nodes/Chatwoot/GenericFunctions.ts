import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  INodePropertyOptions,
  IWebhookFunctions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

// ============================================================================
// Types
// ============================================================================

export type ApiType = 'application' | 'platform' | 'public';

export interface ApiRequestOptions {
  apiType?: ApiType;
  inboxIdentifier?: string;
  contactIdentifier?: string;
}

/** Any n8n context that can make Chatwoot requests. */
export type ChatwootContext =
  | IExecuteFunctions
  | ILoadOptionsFunctions
  | IHookFunctions
  | IWebhookFunctions;

/**
 * Chatwoot API targeted by a request. Selects the credential, the base path and the auth header:
 * - application:   chatwootApi,         {baseUrl}/api/v1/accounts/{accountId}{endpoint}, api_access_token
 * - applicationV2: chatwootApi,         {baseUrl}/api/v2/accounts/{accountId}{endpoint}, api_access_token
 * - platform:      chatwootPlatformApi, {baseUrl}/platform/api/v1{endpoint},             api_access_token
 * - public:        chatwootPublicApi,   {baseUrl}/public/api/v1{endpoint},                no auth
 * - user:          chatwootApi,         {baseUrl}/api/v1{endpoint} (not account-scoped, e.g. /profile), api_access_token
 */
export type ChatwootApi = 'application' | 'applicationV2' | 'platform' | 'public' | 'user';

/** Query-string array serialization (same values as IHttpRequestOptions.arrayFormat). */
export type QueryArrayFormat = 'brackets' | 'indices' | 'repeat' | 'comma';

export interface RetryPolicy {
  /** Maximum number of retries after the first attempt. */
  maxRetries: number;
  /** Base delay for 502/503/504 retries (doubled on every retry, with jitter). */
  baseDelayMs: number;
  /** Base delay for 429 retries (doubled on every retry, with jitter). */
  rateLimitBaseDelayMs: number;
  /** Upper bound for any single wait, including a server-provided Retry-After. */
  maxDelayMs: number;
}

export interface ChatwootRequestOptions {
  /** Which Chatwoot API to call. The api-specific wrappers set this for you. Default: 'application'. */
  api?: ChatwootApi;
  /** Input item index: used to resolve credentials and added to the error context. */
  itemIndex?: number;
  /** How arrays in `qs` are serialized. Default: 'brackets' (labels[]=a&labels[]=b). */
  arrayFormat?: QueryArrayFormat;
  /** Extra request headers (merged last). */
  headers?: IDataObject;
  /** Resolve with { body, headers, statusCode, statusMessage } instead of the body. */
  returnFullResponse?: boolean;
  /** Response encoding, e.g. 'arraybuffer' for file downloads. */
  encoding?: IHttpRequestOptions['encoding'];
  /** Parse the response as JSON (sets Accept: application/json). Default: true. */
  json?: boolean;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Override the retry policy for this request, or `false` to disable retries. */
  retry?: Partial<RetryPolicy> | false;
}

/** JSON body (plain object) or a multipart body built with buildMultipartFormData(). */
export type ChatwootRequestBody = IDataObject | FormData;

// ============================================================================
// Constants
// ============================================================================

const API_CONFIG: Record<ChatwootApi, { credential: string; label: string; auth: boolean }> = {
  application: { credential: 'chatwootApi', label: 'Chatwoot API', auth: true },
  applicationV2: { credential: 'chatwootApi', label: 'Chatwoot API', auth: true },
  platform: { credential: 'chatwootPlatformApi', label: 'Chatwoot Platform API', auth: true },
  public: { credential: 'chatwootPublicApi', label: 'Chatwoot Public API', auth: false },
  user: { credential: 'chatwootApi', label: 'Chatwoot API', auth: true },
};

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
const RETRYABLE_GATEWAY_STATUSES = new Set([502, 503, 504]);

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  // Chatwoot throttles with rack-attack fixed windows (mostly 1 minute), so rate-limit
  // retries wait longer: ~2.5-5s, 5-10s, 10-20s.
  rateLimitBaseDelayMs: 5000,
  maxDelayMs: 60000,
};

/** Upper bound for RetryPolicy.maxRetries overrides. */
export const MAX_RETRIES_LIMIT = 10;

/** Default page cap for chatwootApiRequestAllItems / chatwootApiRequestAllMessages. */
export const DEFAULT_MAX_PAGES = 1000;

/** Chatwoot MessageFinder returns 20 messages per page. */
export const MESSAGES_PAGE_SIZE = 20;

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const MAX_SERVER_MESSAGE_LENGTH = 500;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Normalize and validate base URL.
 * Trims whitespace, removes trailing slashes, and validates protocol.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error(
      'Base URL must start with http:// or https:// (e.g., https://app.chatwoot.com)',
    );
  }
  return trimmed;
}

/**
 * Safely parse a JSON string, returning the parsed value or the original value if already an object.
 * Throws a descriptive error if the string is invalid JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonSafe(value: unknown, fieldName: string): any {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    // This is a pure parsing helper with no node/context of its own; every call site sits inside
    // Chatwoot.node.ts's execute() loop, whose outer catch (see the bottom of execute()) already
    // rewraps any plain Error into a NodeOperationError with the item's index before it reaches
    // continueOnFail() or the user.
    // eslint-disable-next-line
    throw new Error(`Invalid JSON in "${fieldName}": ${value.substring(0, 100)}`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/** Read a dotted path ('data.payload') from a value. */
export function getByPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[segment];
  }
  return current;
}

function isFormData(value: unknown): value is FormData {
  if (typeof FormData !== 'undefined' && value instanceof FormData) return true;
  const record = asRecord(value);
  return (
    !!record &&
    typeof record.append === 'function' &&
    typeof record.entries === 'function' &&
    Object.prototype.toString.call(value) === '[object FormData]'
  );
}

/**
 * Normalize query parameters for 'brackets' serialization.
 * Keys that already end in '[]' (e.g. qs['includes[]'] = ['read']) lose the suffix and their value
 * becomes an array, so n8n serializes `includes[]=read` instead of `includes[][]=read` (brackets)
 * or `includes[][0]=read` (n8n's default 'indices'). Undefined values are dropped.
 */
export function normalizeQueryParams(qs: IDataObject): IDataObject {
  const normalized: IDataObject = {};
  const append = (key: string, value: unknown) => {
    const values = Array.isArray(value) ? value : [value];
    const existing = normalized[key];
    const previous = existing === undefined ? [] : Array.isArray(existing) ? existing : [existing];
    normalized[key] = [...previous, ...values] as IDataObject[];
  };

  for (const [key, value] of Object.entries(qs)) {
    if (value === undefined) continue;
    if (key.length > 2 && key.endsWith('[]')) {
      append(key.slice(0, -2), value);
    } else if (normalized[key] !== undefined) {
      append(key, value);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

// ============================================================================
// Error handling
// ============================================================================

/** Follow error → error.cause (NodeApiError keeps the original AxiosError as `cause`). */
function errorChain(error: unknown): Array<Record<string, unknown>> {
  const chain: Array<Record<string, unknown>> = [];
  let current = asRecord(error);
  while (current && !chain.includes(current) && chain.length < 5) {
    chain.push(current);
    current = asRecord(current.cause);
  }
  return chain;
}

function toHttpStatus(value: unknown): number | undefined {
  const status = typeof value === 'string' && /^\d{3}$/.test(value.trim()) ? Number(value) : value;
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : undefined;
}

/**
 * HTTP status of an error thrown by this.helpers.httpRequest or by the Chatwoot helpers.
 * n8n 2.x throws a raw AxiosError (`status`, `response.status`, no `statusCode`); NodeApiError exposes
 * `httpCode` (string); legacy request-promise errors used `statusCode`. All are supported.
 */
export function getHttpStatus(error: unknown): number | undefined {
  for (const entry of errorChain(error)) {
    const response = asRecord(entry.response);
    const status =
      toHttpStatus(entry.httpCode) ??
      toHttpStatus(response?.status) ??
      toHttpStatus(response?.statusCode) ??
      toHttpStatus(entry.status) ??
      toHttpStatus(entry.statusCode);
    if (status !== undefined) return status;
  }
  return undefined;
}

function decodeBody(value: unknown): unknown {
  let decoded = value;
  if (Buffer.isBuffer(decoded)) decoded = decoded.toString('utf8');
  else if (decoded instanceof ArrayBuffer) decoded = Buffer.from(decoded).toString('utf8');
  if (typeof decoded !== 'string') return decoded;
  const trimmed = decoded.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return decoded;
  try {
    return JSON.parse(trimmed);
  } catch {
    return decoded;
  }
}

/** Parsed response body carried by an HTTP error (JSON object, or text such as 'Retry later'). */
export function getErrorResponseBody(error: unknown): unknown {
  for (const entry of errorChain(error)) {
    const response = asRecord(entry.response);
    if (response) {
      if (response.data !== undefined && response.data !== '') return decodeBody(response.data);
      if (response.body !== undefined && response.body !== '') return decodeBody(response.body);
    }
    // Legacy request-promise errors carry the body in `error`
    if (entry.error !== undefined && !(entry.error instanceof Error))
      return decodeBody(entry.error);
    const context = asRecord(entry.context);
    if (context?.data !== undefined) return context.data;
  }
  return undefined;
}

/** Retry-After of an HTTP error in milliseconds (seconds or HTTP-date), if the server sent one. */
export function getRetryAfterMs(error: unknown, now: number = Date.now()): number | undefined {
  for (const entry of errorChain(error)) {
    const headers = asRecord(asRecord(entry.response)?.headers);
    if (!headers) continue;
    let raw: unknown =
      typeof headers.get === 'function'
        ? (headers.get as (name: string) => unknown).call(headers, 'retry-after')
        : undefined;
    if (raw === undefined || raw === null) raw = headers['retry-after'] ?? headers['Retry-After'];
    if (Array.isArray(raw)) raw = raw[0];
    if (raw === undefined || raw === null || raw === '') continue;
    const value = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value) * 1000);
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  return undefined;
}

function truncate(text: string): string {
  return text.length > MAX_SERVER_MESSAGE_LENGTH
    ? `${text.substring(0, MAX_SERVER_MESSAGE_LENGTH)}…`
    : text;
}

function stringifyErrorValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => stringifyErrorValue(entry))
      .filter((entry): entry is string => !!entry);
    return parts.length ? parts.join('; ') : undefined;
  }
  const record = asRecord(value);
  if (!record) return undefined;
  const direct = stringifyErrorValue(record.message) ?? stringifyErrorValue(record.error);
  if (direct) return direct;
  // Rails errors hash: { name: ["can't be blank"] } -> "name can't be blank"
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(record)) {
    const text = stringifyErrorValue(messages);
    if (!text) continue;
    parts.push(Array.isArray(messages) ? `${field} ${text}` : `${field}: ${text}`);
  }
  return parts.length ? parts.join('; ') : undefined;
}

/**
 * Human-readable message from a Chatwoot error body. Handles `{ error }`, `{ message, attributes }`
 * (RecordInvalid), `{ errors: [...] }`, `{ description }` and plain-text bodies (rack-attack's
 * 'Retry later'). HTML error pages are ignored.
 */
export function extractChatwootErrorMessage(body: unknown): string | undefined {
  const parsed = decodeBody(body);
  if (typeof parsed === 'string') {
    const text = parsed.trim();
    if (!text || text.startsWith('<')) return undefined;
    return truncate(text);
  }
  if (Array.isArray(parsed)) {
    const joined = stringifyErrorValue(parsed);
    return joined ? truncate(joined) : undefined;
  }
  const record = asRecord(parsed);
  if (!record) return undefined;

  const parts: string[] = [];
  for (const key of ['error', 'message', 'errors']) {
    const text = stringifyErrorValue(record[key]);
    if (text && !parts.includes(text)) parts.push(text);
  }
  if (parts.length === 0) {
    const text = stringifyErrorValue(record.description) ?? stringifyErrorValue(record.detail);
    if (text) parts.push(text);
  }

  let message = parts.join('; ');
  const attributes = Array.isArray(record.attributes)
    ? record.attributes.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (attributes.length) {
    message = message
      ? `${message} (attributes: ${attributes.join(', ')})`
      : `Invalid attributes: ${attributes.join(', ')}`;
  }
  return message ? truncate(message) : undefined;
}

/**
 * Status-specific guidance shown as the NodeApiError description.
 * Note: since Chatwoot 4.14, 401 is used both for invalid tokens and for authorization failures.
 */
export function getChatwootErrorHint(
  status: number,
  serverMessage: string | undefined,
  api: ChatwootApi = 'application',
): string {
  const message = (serverMessage ?? '').toLowerCase();
  const hint = (...sentences: string[]) => sentences.join(' ');
  switch (status) {
    case 400:
      return 'Chatwoot could not process the request. Check the parameters sent by this operation.';
    case 401:
      if (message.includes('invalid user ids')) {
        return 'One or more User IDs are not agents of this account. Use Agent → Get Many to find valid IDs for this account.';
      }
      if (/invalid access[ _]token/.test(message)) {
        return hint(
          api === 'platform'
            ? 'The Platform API access token was rejected. Copy it again from Super Admin → Platform Apps'
            : 'The API access token was rejected. Copy it again from Chatwoot → Profile Settings → Access Token',
          'and check that the Base URL points to the right Chatwoot instance.',
        );
      }
      if (message.includes('not authorized to do this action')) {
        return hint(
          'The access token is valid, but its user is not allowed to perform this action.',
          'Since Chatwoot 4.14 many endpoints answer 401 for permission failures: e.g. managing custom',
          'attribute definitions or global macros requires an administrator, and SLA policies/applied',
          "SLAs require the SLA feature (Enterprise plan). Use an administrator's token or enable the feature.",
        );
      }
      if (message.includes('suspended')) {
        return 'The Chatwoot account is suspended. Reactivate it (Super Admin → Accounts) before using the API.';
      }
      if (/\bbots?\b/.test(message)) {
        return hint(
          'Agent bot tokens can only call a few endpoints (e.g. create messages, toggle conversation',
          'status, labels). Use the access token of a user (agent or administrator) instead.',
        );
      }
      if (message.includes('non permissible resource')) {
        return hint(
          'A Platform App token can only manage the accounts, users and agent bots created through',
          'that same Platform App.',
        );
      }
      return hint(
        'Chatwoot answers 401 both for an invalid or revoked access token and, since Chatwoot 4.14,',
        "for authorization failures (the token's user lacks the role or the account lacks the feature,",
        'e.g. custom attribute definitions and global macros require an administrator, SLA endpoints',
        "require the SLA feature). Check the token, the Account ID in the credential and the user's role.",
      );
    case 402:
      return hint(
        "Payment required: the account's plan does not include this feature or a plan limit was",
        'reached (e.g. agent seats or email transcripts).',
      );
    case 403:
      return hint(
        'Forbidden: the feature may be disabled for this account or plan (e.g. "API access is not',
        'enabled for this account" on Chatwoot Cloud, "Companies are not enabled"), a plan limit may',
        'have been reached (e.g. inbox limit), the account may be suspended, or the user has no access',
        'to this inbox/conversation. Some updates are only allowed on API channel inboxes.',
      );
    case 404:
      if (api === 'public') {
        return hint(
          'Not found: check the inbox identifier in the credential (the identifier of an API channel',
          'inbox, not its numeric ID), the contact identifier (source_id) and the conversation ID.',
        );
      }
      if (api === 'platform') {
        return 'Not found: check the ID and that the resource exists on this Chatwoot installation.';
      }
      return hint(
        'Not found: check that the ID exists in this account (Account ID in the credential) and that',
        'your Chatwoot version and plan support this endpoint (some endpoints are Enterprise-only or',
        'newer than your instance).',
      );
    case 405:
      return 'Method not allowed: this Chatwoot version does not support this operation on the endpoint.';
    case 409:
      return 'Conflict: the resource already exists or was modified concurrently.';
    case 413:
      return hint(
        'Payload too large: the file or request body exceeds the size Chatwoot (or its reverse proxy)',
        'accepts.',
      );
    case 422:
      return hint(
        'Chatwoot rejected the data (validation error). Check required fields, value formats and IDs',
        'referenced by this operation.',
      );
    case 429:
      return hint(
        'Rate limited by Chatwoot (rack-attack). Default limits in Chatwoot 4.18: 3000 requests/min per',
        'IP (RACK_ATTACK_LIMIT), contact search 100/min per account, conversation delete 60/min per',
        'account, agent create 100/day and agent delete 50/day per account, attachment uploads 60/hour',
        'per account, reports 100/min per user and 1000/min per account, conversation meta 30/min per',
        'user. Slow the workflow down (e.g. Loop Over Items + Wait). Self-hosted: add the n8n server IP',
        'to RACK_ATTACK_ALLOWED_IPS or raise the RATE_LIMIT_* variables.',
      );
    case 500:
      return hint(
        'Chatwoot hit an internal error. This is often caused by missing or malformed parameters that',
        'Chatwoot does not validate; check the Chatwoot server logs for details.',
      );
    case 502:
    case 503:
    case 504:
      return hint(
        'Chatwoot, or a proxy in front of it, is temporarily unavailable or timed out. Try again later;',
        'for self-hosted instances check the Chatwoot/Sidekiq containers and the reverse proxy.',
      );
    default:
      return status >= 500 ? 'Chatwoot returned a server error.' : 'Chatwoot rejected the request.';
  }
}

interface ErrorRequestInfo {
  api: ChatwootApi;
  method: string;
  path: string;
  itemIndex?: number;
  retries: number;
}

/**
 * Convert an httpRequest error into a NodeApiError that surfaces Chatwoot's own message.
 * - message:     "<API label> error <status> <status text>: <Chatwoot message>"
 * - description: status-specific hint, retry info and the request line
 * - httpCode, context.itemIndex, context.data (response body), legacy numeric `statusCode`
 */
export function buildChatwootApiError(
  node: INode,
  error: unknown,
  info: ErrorRequestInfo,
): NodeApiError | NodeOperationError {
  if (error instanceof NodeApiError || error instanceof NodeOperationError) {
    if (info.itemIndex !== undefined && error.context.itemIndex === undefined) {
      error.context.itemIndex = info.itemIndex;
    }
    return error;
  }

  const errorObject = (asRecord(error) ?? { message: String(error) }) as JsonObject;
  const requestLine = `Request: ${info.method} ${info.path}`;
  const status = getHttpStatus(error);

  if (status === undefined) {
    // Network-level failure: let NodeApiError map ECONNREFUSED/ENOTFOUND/ETIMEDOUT to its messages
    const code = typeof errorObject.code === 'string' ? ` (${errorObject.code})` : '';
    const apiError = new NodeApiError(node, errorObject, {
      description: `Could not reach Chatwoot${code}. Check the Base URL in the credential and that n8n can reach the Chatwoot server.\n${requestLine}`,
      itemIndex: info.itemIndex,
    });
    return apiError;
  }

  const body = getErrorResponseBody(error);
  const statusText = STATUS_TEXT[status];
  let serverMessage = extractChatwootErrorMessage(body);
  // Rails' default JSON errors ({"status":404,"error":"Not Found"}) only repeat the status text
  if (serverMessage && statusText && serverMessage.toLowerCase() === statusText.toLowerCase()) {
    serverMessage = undefined;
  }
  const label = API_CONFIG[info.api].label;
  const message = `${label} error ${status}${statusText ? ` ${statusText}` : ''}${
    serverMessage ? `: ${serverMessage}` : ''
  }`;

  const descriptionLines = [getChatwootErrorHint(status, serverMessage, info.api)];
  if (info.retries > 0) {
    descriptionLines.push(
      `Retried ${info.retries} time${info.retries === 1 ? '' : 's'} with exponential backoff before giving up.`,
    );
    if (info.method === 'DELETE' && status === 404) {
      descriptionLines.push(
        'An earlier attempt may have completed the deletion before the server returned an error. Verify the resource before retrying; a 404 can also refer to a missing parent resource.',
      );
    }
  } else if (RETRYABLE_GATEWAY_STATUSES.has(status) && !IDEMPOTENT_METHODS.has(info.method)) {
    descriptionLines.push(
      `Not retried automatically because ${info.method} requests are not idempotent.`,
    );
  }
  descriptionLines.push(requestLine);
  const description = descriptionLines.join('\n');

  const apiError = new NodeApiError(node, errorObject, {
    message,
    description,
    httpCode: String(status),
    itemIndex: info.itemIndex,
  });
  // NodeApiError replaces `description` with response.data.message when present: keep ours.
  apiError.message = message;
  apiError.description = description;
  apiError.httpCode = String(status);
  if (asRecord(body) && apiError.context.data === undefined) {
    apiError.context.data = body as IDataObject;
  }
  // Compatibility for callers that still read the legacy numeric `statusCode`
  (apiError as NodeApiError & { statusCode?: number }).statusCode = status;
  return apiError;
}

// ============================================================================
// Retries
// ============================================================================

export type RetrySleep = (ms: number) => Promise<void>;

let retrySleep: RetrySleep = sleep;

/**
 * Override the function used to wait between retries (tests use a no-op recorder).
 * Call without arguments to restore the default (n8n-workflow `sleep`).
 * Returns the previous function so callers can put it back.
 */
export function setRetrySleep(fn?: RetrySleep): RetrySleep {
  const previous = retrySleep;
  retrySleep = fn ?? sleep;
  return previous;
}

/** 429 is retried for every method (the request was rejected); 502/503/504 only for idempotent methods. */
export function isRetryableRequest(method: string, status: number | undefined): boolean {
  if (status === 429) return true;
  if (status !== undefined && RETRYABLE_GATEWAY_STATUSES.has(status)) {
    return IDEMPOTENT_METHODS.has(method.toUpperCase());
  }
  return false;
}

/**
 * Delay before retry number `retryNumber` (1-based). Honors Retry-After (capped at maxDelayMs),
 * otherwise exponential backoff with "equal jitter": half fixed, half random.
 */
export function computeRetryDelay(
  retryNumber: number,
  status: number | undefined,
  retryAfterMs: number | undefined,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) return Math.min(Math.max(0, retryAfterMs), policy.maxDelayMs);
  const base = status === 429 ? policy.rateLimitBaseDelayMs : policy.baseDelayMs;
  const exponential = Math.min(policy.maxDelayMs, base * 2 ** Math.max(0, retryNumber - 1));
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

/**
 * Merge per-request overrides into the default policy. Overrides that are not finite non-negative
 * numbers (e.g. an unset option passed as `undefined`, NaN) are ignored so retries always stay bounded;
 * maxRetries is capped at MAX_RETRIES_LIMIT.
 */
export function resolveRetryPolicy(retry: ChatwootRequestOptions['retry']): RetryPolicy | false {
  if (retry === false) return false;
  const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY };
  for (const key of Object.keys(policy) as Array<keyof RetryPolicy>) {
    const value = retry?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) policy[key] = value;
  }
  policy.maxRetries = Math.min(Math.floor(policy.maxRetries), MAX_RETRIES_LIMIT);
  return policy;
}

/**
 * Internal HTTP request helper: this.helpers.httpRequest with automatic retries.
 * `state.retries` reports how many retries were made (used in error descriptions).
 */
async function performRequest(
  ctx: ChatwootContext,
  requestOptions: IHttpRequestOptions,
  policy: RetryPolicy | false,
  state: { retries: number },
): Promise<unknown> {
  const method = (requestOptions.method ?? 'GET').toUpperCase();
  for (;;) {
    try {
      // httpRequest mutates its options (e.g. removes empty bodies), so pass a fresh copy per attempt
      return await ctx.helpers.httpRequest({
        ...requestOptions,
        headers: { ...requestOptions.headers },
      });
    } catch (error) {
      const status = getHttpStatus(error);
      if (!policy || state.retries >= policy.maxRetries || !isRetryableRequest(method, status)) {
        // `performRequest`'s only caller, chatwootRequest below, wraps every error it throws via
        // buildChatwootApiError before returning to its own callers; this just decides whether to
        // retry first.
        // eslint-disable-next-line
        throw error;
      }
      state.retries++;
      await retrySleep(computeRetryDelay(state.retries, status, getRetryAfterMs(error), policy));
    }
  }
}

// ============================================================================
// Request core (Application, Application v2, Platform and Public APIs)
// ============================================================================

function buildApiUrl(
  api: ChatwootApi,
  baseUrl: string,
  credentials: IDataObject,
  endpoint: string,
) {
  switch (api) {
    case 'applicationV2':
      return `${baseUrl}/api/v2/accounts/${credentials.accountId}${endpoint}`;
    case 'platform':
      return `${baseUrl}/platform/api/v1${endpoint}`;
    case 'public':
      return `${baseUrl}/public/api/v1${endpoint}`;
    case 'user':
      // Routes outside the account scope (e.g. /api/v1/profile) that use the same user token
      return `${baseUrl}/api/v1${endpoint}`;
    default:
      return `${baseUrl}/api/v1/accounts/${credentials.accountId}${endpoint}`;
  }
}

/**
 * Make a request to any Chatwoot API (see ChatwootApi). The JSON body is sent for every method except
 * GET/HEAD when it is non-empty (DELETE included); FormData bodies are sent as multipart/form-data.
 * Query arrays use 'brackets' by default. 429 and (idempotent) 502/503/504 are retried with backoff.
 * An empty JSON response (Chatwoot's `head :ok`) resolves to {}.
 * Errors are thrown as NodeApiError carrying Chatwoot's message (see buildChatwootApiError).
 */
export async function chatwootRequest(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: ChatwootRequestBody = {},
  qs: IDataObject = {},
  options: ChatwootRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  const api = options.api ?? 'application';
  const config = API_CONFIG[api];
  const credentials = await this.getCredentials(config.credential, options.itemIndex);

  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(String(credentials.baseUrl ?? ''));
  } catch (e) {
    throw new NodeOperationError(this.getNode(), (e as Error).message, {
      itemIndex: options.itemIndex,
    });
  }

  const url = buildApiUrl(api, baseUrl, credentials, endpoint);
  const multipart = isFormData(body);
  const sendBody =
    !BODYLESS_METHODS.has(method.toUpperCase()) &&
    (multipart || Object.keys(body as IDataObject).length > 0);

  const headers: IDataObject = {};
  if (config.auth) headers.api_access_token = credentials.apiAccessToken as string;
  // Multipart bodies must not get a JSON content type: axios sets the multipart boundary itself
  if (sendBody && !multipart) headers['Content-Type'] = 'application/json';
  Object.assign(headers, options.headers);
  if (multipart) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-type') delete headers[key];
    }
  }

  const requestOptions: IHttpRequestOptions = {
    method,
    url,
    headers,
    json: options.json ?? true,
  };
  if (sendBody) requestOptions.body = body;

  const arrayFormat = options.arrayFormat ?? 'brackets';
  const query = arrayFormat === 'brackets' ? normalizeQueryParams(qs) : { ...qs };
  for (const key of Object.keys(query)) {
    if (query[key] === undefined) delete query[key];
  }
  if (Object.keys(query).length > 0) {
    requestOptions.qs = query;
    requestOptions.arrayFormat = arrayFormat;
  }
  if (options.returnFullResponse) requestOptions.returnFullResponse = true;
  if (options.encoding) requestOptions.encoding = options.encoding;
  if (options.timeout) requestOptions.timeout = options.timeout;

  const state = { retries: 0 };
  try {
    const response = await performRequest(
      this,
      requestOptions,
      resolveRetryPolicy(options.retry),
      state,
    );
    // Many Chatwoot actions answer `head :ok` (empty body), which n8n resolves as ''. Return {} so
    // callers always get an object (returnJsonArray('') would emit an item whose json is a string).
    if (
      requestOptions.json &&
      !requestOptions.encoding &&
      !requestOptions.returnFullResponse &&
      (response === '' || response === undefined || response === null)
    ) {
      return {};
    }
    return response as IDataObject | IDataObject[];
  } catch (error) {
    throw buildChatwootApiError(this.getNode(), error, {
      api,
      method: method.toUpperCase(),
      path: url.substring(baseUrl.length) || '/',
      itemIndex: options.itemIndex,
      retries: state.retries,
    });
  }
}

// ============================================================================
// Application API (Account-level operations)
// ============================================================================

/**
 * Make an authenticated request to the Chatwoot Application API
 */
export async function chatwootApiRequest(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: ChatwootRequestBody = {},
  qs: IDataObject = {},
  options: ChatwootRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  return await chatwootRequest.call(this, method, endpoint, body, qs, {
    ...options,
    api: 'application',
  });
}

// ============================================================================
// Application API V2 (Reports — only available at /api/v2/)
// ============================================================================

/**
 * Make an authenticated request to the Chatwoot Application API v2.
 * Used for Reports endpoints (reports, summary_reports, live_reports) which
 * are only available under /api/v2/ — calling them under /api/v1/ returns 404.
 */
export async function chatwootApiV2Request(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: ChatwootRequestBody = {},
  qs: IDataObject = {},
  options: ChatwootRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  return await chatwootRequest.call(this, method, endpoint, body, qs, {
    ...options,
    api: 'applicationV2',
  });
}

// ============================================================================
// Platform API (Super Admin operations)
// ============================================================================

/**
 * Make an authenticated request to the Chatwoot Platform API
 * Platform API is used for super admin operations (creating accounts, users, etc.)
 */
export async function chatwootPlatformApiRequest(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: ChatwootRequestBody = {},
  qs: IDataObject = {},
  options: ChatwootRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  return await chatwootRequest.call(this, method, endpoint, body, qs, {
    ...options,
    api: 'platform',
  });
}

// ============================================================================
// Public API (Client/Widget operations)
// ============================================================================

/**
 * Make a request to the Chatwoot Public API
 * Public API is used for client-facing operations (website widgets, etc.)
 */
export async function chatwootPublicApiRequest(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: ChatwootRequestBody = {},
  qs: IDataObject = {},
  options: ChatwootRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  return await chatwootRequest.call(this, method, endpoint, body, qs, {
    ...options,
    api: 'public',
  });
}

// ============================================================================
// Multipart (file uploads)
// ============================================================================

export interface MultipartFileSpec {
  /** Multipart field name, e.g. 'attachments[]' (messages) or 'import_file' (contact import). */
  fieldName: string;
  /** Binary property of the input item holding the file (e.g. 'data'). */
  binaryPropertyName: string;
  /** Override the file name (default: the binary's fileName). */
  fileName?: string;
  /** Override the MIME type (default: the binary's mimeType, then application/octet-stream). */
  mimeType?: string;
}

export type MultipartFieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | IDataObject
  | Array<string | number | boolean>;

export interface MultipartSpec {
  /**
   * Text fields. Arrays become repeated fields named 'name[]' (the '[]' suffix is added when
   * missing, as Rails expects); objects are JSON-stringified; null/undefined are skipped.
   */
  fields?: Record<string, MultipartFieldValue>;
  /** Fields sent as a JSON string (e.g. content_attributes). JSON strings are validated first. */
  jsonFields?: Record<string, unknown>;
  /** Files taken from the input item's binary data, appended in order (repeat a fieldName for arrays). */
  files?: MultipartFileSpec[];
}

export interface MultipartRequestOptions extends ChatwootRequestOptions {
  /** Query parameters for the multipart request. */
  qs?: IDataObject;
}

/**
 * Build a multipart/form-data body (global FormData/Blob) from fields and n8n binary input data.
 */
export async function buildMultipartFormData(
  this: IExecuteFunctions,
  itemIndex: number,
  spec: MultipartSpec,
): Promise<FormData> {
  const form = new FormData();

  for (const [name, value] of Object.entries(spec.fields ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const fieldName = name.endsWith('[]') ? name : `${name}[]`;
      for (const entry of value) {
        if (entry !== undefined && entry !== null) form.append(fieldName, String(entry));
      }
    } else if (typeof value === 'object') {
      form.append(name, JSON.stringify(value));
    } else {
      form.append(name, String(value));
    }
  }

  for (const [name, value] of Object.entries(spec.jsonFields ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    let parsed: unknown;
    try {
      parsed = parseJsonSafe(value, name);
    } catch (e) {
      throw new NodeOperationError(this.getNode(), (e as Error).message, { itemIndex });
    }
    form.append(name, JSON.stringify(parsed));
  }

  for (const file of spec.files ?? []) {
    const binaryData = this.helpers.assertBinaryData(itemIndex, file.binaryPropertyName);
    const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, file.binaryPropertyName);
    const mimeType = file.mimeType || binaryData.mimeType || 'application/octet-stream';
    const extension = binaryData.fileExtension ? `.${binaryData.fileExtension}` : '';
    const fileName =
      file.fileName || binaryData.fileName || `${file.binaryPropertyName}${extension}`;
    form.append(file.fieldName, new Blob([buffer], { type: mimeType }), fileName);
  }

  return form;
}

/**
 * Send a multipart/form-data request built from `spec` (see buildMultipartFormData).
 * Defaults to the Application API; pass `{ api: 'public' }` for Public API uploads.
 */
export async function chatwootMultipartRequest(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  itemIndex: number,
  spec: MultipartSpec,
  options: MultipartRequestOptions = {},
): Promise<IDataObject | IDataObject[]> {
  const { qs, ...requestOptions } = options;
  const form = await buildMultipartFormData.call(this, itemIndex, spec);
  // The item that provides the files also provides the credentials and the error context
  return await chatwootRequest.call(this, method, endpoint, form, qs ?? {}, {
    ...requestOptions,
    itemIndex,
  });
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Where the items of a list response live: a dotted path ('payload', 'data.payload', 'audit_logs')
 * or a function returning the array.
 */
export type ItemExtractor = string | ((response: unknown) => unknown);

const AUTO_DETECT_ITEM_PATHS = ['payload', 'data.payload', 'data'];

/**
 * Extract the item array from a list response. A function extractor is used as-is. A path extractor
 * that does not resolve to an array falls back to auto-detection: root array, `payload`,
 * `data.payload` (conversations, notifications) and `data`.
 */
export function extractItems(response: unknown, extractor?: ItemExtractor): IDataObject[] {
  if (typeof extractor === 'function') {
    const items = extractor(response);
    return Array.isArray(items) ? (items as IDataObject[]) : [];
  }
  if (extractor) {
    const items = getByPath(response, extractor);
    if (Array.isArray(items)) return items as IDataObject[];
  }
  if (Array.isArray(response)) return response as IDataObject[];
  for (const path of AUTO_DETECT_ITEM_PATHS) {
    const items = getByPath(response, path);
    if (Array.isArray(items)) return items as IDataObject[];
  }
  return [];
}

export interface PaginationMeta {
  hasMore?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  perPage?: number;
}

/**
 * Pagination hints from `meta`, `data.meta` or top-level keys (audit logs):
 * has_more, current_page, total_pages, per_page and total counts (total_count, total_entries,
 * count, all_count).
 */
export function getPaginationMeta(response: unknown): PaginationMeta {
  const root = asRecord(response);
  if (!root || Array.isArray(response)) return {};
  const metaSources = [asRecord(root.meta), asRecord(asRecord(root.data)?.meta)].filter(
    (source): source is Record<string, unknown> => !!source,
  );
  const meta: PaginationMeta = {};
  for (const source of [...metaSources, root]) {
    if (meta.hasMore === undefined && typeof source.has_more === 'boolean') {
      meta.hasMore = source.has_more;
    }
    meta.currentPage ??= toNumber(source.current_page);
    meta.totalPages ??= toNumber(source.total_pages);
    meta.perPage ??= toNumber(source.per_page);
    meta.totalCount ??= toNumber(source.total_count) ?? toNumber(source.total_entries);
    if (source !== root) {
      meta.totalCount ??= toNumber(source.count) ?? toNumber(source.all_count);
    }
  }
  return meta;
}

export interface AllItemsOptions {
  /** Which Chatwoot API to call. Default: 'application'. */
  api?: ChatwootApi;
  /** Stop once this many items were collected and return the first `limit`. */
  limit?: number;
  /** Explicit hard cap. By default the 1000-page safety cap grows to cover server-reported totals. */
  maxPages?: number;
  /** Known page size (15 contacts, 25 conversations...) for early end detection. */
  pageSize?: number;
  /** First page number. Default: 1. */
  startPage?: number;
  /** Name of the page query parameter. Default: 'page'. */
  pageParam?: string;
  /** Input item index for credentials and error context. */
  itemIndex?: number;
  /** Extra request options (arrayFormat, headers, retry...). */
  requestOptions?: ChatwootRequestOptions;
}

function itemKey(item: IDataObject): string | undefined {
  const id = item?.id;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : undefined;
}

async function requestAllPages(
  ctx: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject,
  qs: IDataObject,
  extractor: ItemExtractor | undefined,
  options: AllItemsOptions,
): Promise<IDataObject[]> {
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;
  let maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pageParam = options.pageParam ?? 'page';
  const startPage = options.startPage ?? 1;
  const requestOptions: ChatwootRequestOptions = {
    itemIndex: options.itemIndex,
    ...options.requestOptions,
    api: options.api ?? options.requestOptions?.api ?? 'application',
  };

  const collected: IDataObject[] = [];
  const seen = new Set<string>();
  let previousPage: string | undefined;
  let pageSize = options.pageSize ?? 0;
  let page = startPage;
  let pagesFetched = 0;

  for (;;) {
    if (pagesFetched >= maxPages) {
      throw new NodeOperationError(
        ctx.getNode(),
        `Chatwoot pagination for ${method} ${endpoint} exceeded ${maxPages} pages (${collected.length} items so far)`,
        {
          itemIndex: options.itemIndex,
          description:
            'The node stops instead of silently returning a truncated list. Use "Limit" instead of "Return All" or narrow the filters.',
        },
      );
    }

    const response = await chatwootRequest.call(
      ctx,
      method,
      endpoint,
      body,
      { ...qs, [pageParam]: page },
      requestOptions,
    );
    pagesFetched++;

    const items = extractItems(response, extractor);
    if (items.length === 0) break;

    // Stop when a page repeats items already seen (endpoints that ignore the page parameter).
    // Items without an id cannot be deduplicated: compare the whole page with the previous one.
    const keys = items.map(itemKey);
    if (keys.every((key) => key !== undefined && seen.has(key))) break;
    if (keys.some((key) => key === undefined)) {
      const signature = JSON.stringify(items);
      if (signature === previousPage) break;
      previousPage = signature;
    }

    items.forEach((item, index) => {
      const key = keys[index];
      if (key === undefined) {
        collected.push(item);
      } else if (!seen.has(key)) {
        seen.add(key);
        collected.push(item);
      }
    });

    if (limit !== undefined && collected.length >= limit) break;
    if (!pageSize) pageSize = items.length;

    const meta = getPaginationMeta(response);
    // Fix the budget once, from the initial snapshot: continually growing totals must not
    // turn Return All into an unbounded poll. An explicit caller cap always takes precedence.
    if (pagesFetched === 1 && options.maxPages === undefined) {
      const expectedPages = meta.totalPages ?? (
        meta.totalCount !== undefined ? Math.ceil(meta.totalCount / (meta.perPage || pageSize)) : undefined
      );
      if (expectedPages !== undefined && Number.isFinite(expectedPages)) {
        maxPages = Math.max(maxPages, expectedPages - startPage + 2);
      }
    }
    if (meta.hasMore === false) break;
    if (meta.hasMore !== true) {
      if (
        meta.totalPages !== undefined &&
        meta.currentPage !== undefined &&
        meta.currentPage >= meta.totalPages
      ) {
        break;
      }
      if (meta.totalCount !== undefined && startPage === 1 && collected.length >= meta.totalCount) {
        break;
      }
      if (meta.perPage !== undefined && items.length < meta.perPage) break;
      if (items.length < pageSize) break;
    }

    page++;
  }

  return limit !== undefined ? collected.slice(0, limit) : collected;
}

/**
 * Page-based pagination for Application API list endpoints.
 * `extractor` accepts the legacy property name ('payload'), a dotted path ('data.payload',
 * 'audit_logs') or a function; `{ data: { payload } }` responses are detected automatically.
 * Ends on an empty/short/repeated page or on meta (has_more, current_page/total_pages, counts).
 * With `options.limit`, pages are fetched until `limit` items are collected (first N returned).
 * Exceeding `options.maxPages` throws instead of truncating. The default 1000-page safety cap
 * expands for a known server total; an explicit maxPages remains a hard cap.
 */
export async function chatwootApiRequestAllItems(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
  extractor: ItemExtractor = 'payload',
  options: AllItemsOptions = {},
): Promise<IDataObject[]> {
  return await requestAllPages(this, method, endpoint, body, qs, extractor, options);
}

/**
 * Page-based pagination for Platform API endpoints (same behavior as chatwootApiRequestAllItems).
 */
export async function chatwootPlatformApiRequestAllItems(
  this: ChatwootContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  qs: IDataObject = {},
  extractor: ItemExtractor = 'payload',
  options: AllItemsOptions = {},
): Promise<IDataObject[]> {
  return await requestAllPages(this, method, endpoint, body, qs, extractor, {
    ...options,
    api: 'platform',
  });
}

export interface MessagePaginationOptions {
  /** 'application' (default) or 'public' (requires `endpoint`). */
  api?: 'application' | 'public';
  /** Override the endpoint. Default: `/conversations/{conversationId}/messages`. */
  endpoint?: string;
  /** Start cursor: only messages with id < before. */
  before?: number;
  /** Lower bound: only messages with id > after; Limit returns the oldest matching messages. */
  after?: number;
  /**
   * Extra query parameters (e.g. { filter_internal_messages: true }). `before`/`after` found here are
   * used as the options above. The public API only accepts before, so after is filtered client-side there.
   */
  qs?: IDataObject;
  /** Maximum pages to fetch before failing with a NodeOperationError. Default: DEFAULT_MAX_PAGES. */
  maxPages?: number;
  /** Page size used to detect the first message. Default: 20. */
  pageSize?: number;
  /** Input item index for credentials and error context. */
  itemIndex?: number;
}

function sortMessagesChronologically(messages: IDataObject[]): IDataObject[] {
  const allHaveIds = messages.every((message) => toNumber(message.id) !== undefined);
  const allHaveTimestamps =
    allHaveIds && messages.every((message) => toNumber(message.created_at) !== undefined);
  if (!allHaveIds) return messages;
  return [...messages].sort((a, b) => {
    const byTime = allHaveTimestamps
      ? (toNumber(a.created_at) as number) - (toNumber(b.created_at) as number)
      : 0;
    return byTime || (toNumber(a.id) as number) - (toNumber(b.id) as number);
  });
}

/**
 * Cursor-based pagination for conversation messages.
 * Chatwoot returns each page (20 messages) in ascending order, so the next `before` cursor is the
 * smallest id of the page. Messages are deduplicated by id and returned in chronological ascending
 * order. With `limit`, the MOST RECENT messages are returned unless `after` is set: incremental
 * reads return the OLDEST matching messages so advancing the cursor never skips the backlog.
 * Application API after reads use its native 100-message forward pages. Public API only exposes
 * before, so it must walk back to the after bound before applying the limit.
 */
export async function chatwootApiRequestAllMessages(
  this: ChatwootContext,
  conversationId: number,
  limit?: number,
  options: MessagePaginationOptions = {},
): Promise<IDataObject[]> {
  if (options.api === 'public' && !options.endpoint) {
    throw new NodeOperationError(
      this.getNode(),
      'Public API message pagination needs the full endpoint (/inboxes/{inbox}/contacts/{contact}/conversations/{id}/messages)',
      { itemIndex: options.itemIndex },
    );
  }
  const endpoint = options.endpoint ?? `/conversations/${conversationId}/messages`;
  const maxLimit = limit && limit > 0 ? limit : undefined;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const extraQs: IDataObject = { ...options.qs };
  const after = options.after ?? toNumber(extraQs.after);
  let before = options.before ?? toNumber(extraQs.before);
  const forward = after !== undefined && options.api !== 'public';
  const pageSize = options.pageSize ?? (forward ? 100 : MESSAGES_PAGE_SIZE);
  let afterCursor = after;
  if (after !== undefined && before !== undefined && before <= after) return [];
  delete extraQs.after;
  delete extraQs.before;

  const pages: IDataObject[][] = [];
  const seen = new Set<string>();
  let uniqueCount = 0;
  let pagesFetched = 0;

  for (;;) {
    if (pagesFetched >= maxPages) {
      throw new NodeOperationError(
        this.getNode(),
        `Chatwoot message pagination for ${endpoint} exceeded ${maxPages} pages (${uniqueCount} messages so far)`,
        {
          itemIndex: options.itemIndex,
          description:
            'The node stops instead of silently returning a truncated history. Use "Limit" instead of "Return All".',
        },
      );
    }

    const qs: IDataObject = { ...extraQs };
    if (forward) qs.after = afterCursor;
    else if (before !== undefined) qs.before = before;
    const response = await chatwootRequest.call(this, 'GET', endpoint, {}, qs, {
      api: options.api ?? 'application',
      itemIndex: options.itemIndex,
    });
    pagesFetched++;

    const messages = extractItems(response, 'payload');
    if (messages.length === 0) break;

    let smallestId: number | undefined;
    let largestId: number | undefined;
    let reachedAfter = false;
    let reachedBefore = false;
    const fresh: IDataObject[] = [];
    for (const message of messages) {
      const id = toNumber(message.id);
      if (id !== undefined && (smallestId === undefined || id < smallestId)) smallestId = id;
      if (id !== undefined && (largestId === undefined || id > largestId)) largestId = id;
      if (forward && id !== undefined && before !== undefined && id >= before) {
        reachedBefore = true;
        continue;
      }
      if (id !== undefined && after !== undefined && id <= after) {
        reachedAfter = true;
        continue;
      }
      const key = id !== undefined ? String(id) : undefined;
      if (key !== undefined) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      fresh.push(message);
    }
    pages.push(fresh);
    uniqueCount += fresh.length;

    if (maxLimit !== undefined && uniqueCount >= maxLimit && (forward || after === undefined)) break;
    if (forward) {
      if (reachedBefore || messages.length < pageSize) break;
      if (largestId === undefined || (afterCursor !== undefined && largestId <= afterCursor)) break;
      afterCursor = largestId;
      continue;
    }
    if (reachedAfter || messages.length < pageSize) break;
    if (smallestId === undefined || (before !== undefined && smallestId >= before)) break;
    before = smallestId;
  }

  const ordered = sortMessagesChronologically((forward ? pages : pages.reverse()).flat());
  return maxLimit !== undefined
    ? after !== undefined ? ordered.slice(0, maxLimit) : ordered.slice(-maxLimit)
    : ordered;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Simplify the response by extracting only essential fields
 */
export function simplifyResponse(items: IDataObject[], fieldsToKeep: string[]): IDataObject[] {
  return items.map((item) => {
    const simplified: IDataObject = {};
    for (const field of fieldsToKeep) {
      if (item[field] !== undefined) {
        simplified[field] = item[field];
      }
    }
    return simplified;
  });
}

/**
 * Validate that a required number parameter is a positive integer
 */
export function validateId(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return num;
}

/**
 * Validate that a string is not empty
 */
export function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

// ============================================================================
// LoadOptions Methods
// ============================================================================

/**
 * Dropdowns show an empty list when the endpoint does not exist (404: older Chatwoot version,
 * feature not available); other errors (401/403, network) are shown to the user.
 */
function handleLoadOptionsError(error: unknown): INodePropertyOptions[] {
  if (getHttpStatus(error) === 404) return [];
  throw error;
}

/**
 * Load agents for dropdown selection
 */
export async function getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = await chatwootApiRequest.call(this, 'GET', '/agents');
    const agents = Array.isArray(response) ? response : [];

    for (const agent of agents) {
      returnData.push({
        name: `${agent.name} (${agent.email})`,
        value: agent.id as number,
      });
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load teams for dropdown selection
 */
export async function getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = await chatwootApiRequest.call(this, 'GET', '/teams');
    const teams = Array.isArray(response) ? response : [];

    for (const team of teams) {
      returnData.push({
        name: team.name as string,
        value: team.id as number,
      });
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load inboxes for dropdown selection
 */
export async function getInboxes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = (await chatwootApiRequest.call(this, 'GET', '/inboxes')) as IDataObject;
    const inboxes = (response.payload || response) as IDataObject[];

    if (Array.isArray(inboxes)) {
      for (const inbox of inboxes) {
        const channelType = inbox.channel_type as string;
        returnData.push({
          name: `${inbox.name} (${channelType})`,
          value: inbox.id as number,
        });
      }
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load labels for dropdown selection
 */
export async function getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = (await chatwootApiRequest.call(this, 'GET', '/labels')) as IDataObject;
    const labels = (response.payload || response) as IDataObject[];

    if (Array.isArray(labels)) {
      for (const label of labels) {
        returnData.push({
          name: label.title as string,
          value: label.title as string, // Chatwoot uses label titles, not IDs
        });
      }
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load portals for dropdown selection (Help Center)
 */
export async function getPortals(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = (await chatwootApiRequest.call(this, 'GET', '/portals')) as IDataObject;
    const portals = (response.payload || response) as IDataObject[];

    if (Array.isArray(portals)) {
      for (const portal of portals) {
        returnData.push({
          name: portal.name as string,
          value: portal.slug as string,
        });
      }
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load categories for dropdown selection (Help Center).
 * Requires portalSlug to be set in the current node parameters.
 */
export async function getCategories(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const currentParams = this.getCurrentNodeParameters() as IDataObject;
    const portalSlug = currentParams.portalSlug as string | undefined;

    if (!portalSlug) {
      return returnData;
    }

    const response = (await chatwootApiRequest.call(
      this,
      'GET',
      `/portals/${portalSlug}/categories`,
    )) as IDataObject;
    const categories = (response.payload || response) as IDataObject[];

    if (Array.isArray(categories)) {
      for (const category of categories) {
        const locale = category.locale as string;
        returnData.push({
          name: `${category.name}${locale ? ` (${locale})` : ''}`,
          value: category.id as number,
        });
      }
    }
  } catch (error) {
    // 404: the portal may not exist or have no categories
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load agent bots for dropdown selection
 */
export async function getAgentBots(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = await chatwootApiRequest.call(this, 'GET', '/agent_bots');
    const agentBots = Array.isArray(response) ? response : [];

    for (const bot of agentBots) {
      returnData.push({
        name: bot.name as string,
        value: bot.id as number,
      });
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}

/**
 * Load integrations for dropdown selection
 */
export async function getIntegrations(
  this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
  const returnData: INodePropertyOptions[] = [];

  try {
    const response = (await chatwootApiRequest.call(
      this,
      'GET',
      '/integrations/apps',
    )) as IDataObject;
    const integrations = (response.payload || response) as IDataObject[];

    if (Array.isArray(integrations)) {
      for (const integration of integrations) {
        returnData.push({
          name: integration.name as string,
          value: integration.id as string,
        });
      }
    }
  } catch (error) {
    return handleLoadOptionsError(error);
  }

  return returnData;
}
