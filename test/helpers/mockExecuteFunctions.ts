/**
 * Test harness for EXECUTE-level tests of the Chatwoot nodes (no network, no n8n runtime).
 *
 * Quick start (runs the real Chatwoot node's execute()):
 *
 *   import { runChatwootNode, httpError } from './helpers/mockExecuteFunctions';
 *
 *   const { output, calls } = await runChatwootNode({
 *     params: { resource: 'team', operation: 'deleteAgent', teamId: 5, userIds: '1,2' },
 *     responses: [{ method: 'DELETE', url: '/teams/5/team_members', body: {} }],
 *   });
 *   expect(calls[0].method).toBe('DELETE');
 *   expect(calls[0].body).toEqual({ user_ids: [1, 2] });
 *   expect(output[0][0].json).toEqual({});
 *
 * - params: node parameters for every item (dotted paths such as 'options.limit' work). They are
 *   normalized like n8n does when it loads a workflow (NodeHelpers.getNodeParameters with the node
 *   description): defaults are applied (additionalFields = {}, returnAll = false...) and parameters the
 *   UI cannot produce for this resource/operation (unknown names, hidden by displayOptions, unknown
 *   collection options) are DROPPED, so reading them fails like in n8n. `keepUnknownParams: true`
 *   disables the dropping. `itemParams[i]` overrides params for item i (simulates expressions), or pass
 *   a function `(itemIndex) => params`.
 * - credentials: merged over DEFAULT_CREDENTIALS (chatwootApi / chatwootPlatformApi / chatwootPublicApi).
 * - items: input items (use binaryItem() for binary data). Default: one empty item.
 * - responses: queued HTTP responses matched in order by method + URL. A string matches the exact URL
 *   (no query), the exact path, or the exact endpoint relative to the API root (e.g. '/teams/5' for
 *   /api/v1/accounts/1/teams/5 or /platform/api/v1/teams/5: add `api: 'platform'` to disambiguate).
 *   A RegExp is tested against the URL without query. `status >= 400` throws an error shaped exactly
 *   like n8n's helpers.httpRequest error (AxiosError); `error` throws the given error; `reply(call)`
 *   computes the response dynamically; `times` (default 1, Infinity allowed) reuses it. Bodies are
 *   shaped like axios does: an omitted body is '', JSON text is parsed, `encoding: 'arraybuffer'`
 *   yields a Buffer. A request without a matching response fails the test with a descriptive error,
 *   and runChatwootNode fails when a queued (finite) response was never requested
 *   (`allowUnusedResponses: true` to opt out; `http.assertAllConsumed()` for the lower-level API).
 * - calls: every request made (method, url, path, api, endpoint, qs, queryString, arrayFormat, body,
 *   formData, headers), snapshotted when the request is made.
 * - sleeps: retry delays requested by the Chatwoot helpers. Importing this module installs a no-op
 *   retry sleep, so retries never really wait in any test that uses the harness.
 *
 * For errors thrown by execute() use the lower-level API to keep access to the calls:
 *
 *   const mock = createMockExecuteFunctions({ params, responses: [{ url: '/x', status: 404 }] });
 *   await expect(new Chatwoot().execute.call(mock.ctx)).rejects.toThrow('Not Found');
 *   expect(mock.calls).toHaveLength(1);
 *
 * Trigger node: createMockHookFunctions() (checkExists/create/delete) and
 * createMockWebhookFunctions() (webhook()) share the same HTTP mock and parameter handling.
 */
import type {
  IBinaryData,
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestOptions,
  INode,
  INodeExecutionData,
  INodeParameters,
  INodeTypeDescription,
  IPairedItemData,
  IWebhookFunctions,
} from 'n8n-workflow';
import { NodeHelpers, NodeOperationError } from 'n8n-workflow';

import { Chatwoot } from '../../nodes/Chatwoot/Chatwoot.node';
import type { ChatwootApi } from '../../nodes/Chatwoot/GenericFunctions';
import { setRetrySleep } from '../../nodes/Chatwoot/GenericFunctions';

// Retries must never really wait in tests: every test file importing the harness gets a no-op sleep
// (jest gives each test file its own module registry, so this does not leak into other files).
// mockRetrySleep() swaps in a fresh recorder and its restore() puts this one back, never the real sleep.
setRetrySleep(async () => {});

// ============================================================================
// Types
// ============================================================================

export type NodeParams = Record<string, unknown>;
export type ParamsInput = NodeParams | ((itemIndex: number) => NodeParams);

export interface MockReply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  error?: unknown;
}

export interface MockResponse extends MockReply {
  /** HTTP method to match (case-insensitive). Omit to match any method. */
  method?: string;
  /**
   * Exact URL (without query), exact path, exact endpoint relative to the API root ('/teams/5'),
   * or a RegExp tested on the URL.
   */
  url: string | RegExp;
  /** Only match requests to this Chatwoot API (the endpoint alone can be ambiguous, e.g. '/agent_bots'). */
  api?: ChatwootApi;
  /** How many requests this response answers. Default 1; Infinity keeps it forever. */
  times?: number;
  /** Compute the reply from the recorded call (e.g. simulate cursor pagination). */
  reply?: (call: RecordedCall) => MockReply | Promise<MockReply>;
}

export type RecordedFormDataEntry =
  | { name: string; kind: 'field'; value: string }
  | {
      name: string;
      kind: 'file';
      fileName: string;
      mimeType: string;
      size: number;
      content: Buffer;
    };

export interface RecordedCall {
  method: string;
  /** URL as passed to httpRequest (no query string). */
  url: string;
  /** URL path, e.g. /api/v1/accounts/1/teams/5/team_members */
  path: string;
  /** Chatwoot API detected from the path (undefined for other URLs). */
  api: ChatwootApi | undefined;
  /** Path relative to the API root, e.g. /teams/5/team_members (the full path for other URLs). */
  endpoint: string;
  /** qs object passed to httpRequest (deep copy taken when the request was made). */
  qs: IDataObject | undefined;
  /** qs serialized like n8n (qs.stringify with arrayFormat, default 'indices'), not percent-encoded. */
  queryString: string;
  arrayFormat: IHttpRequestOptions['arrayFormat'];
  /** Body (deep copy of a plain object when the request was made, or the FormData instance). */
  body: unknown;
  /** FormData entries when the body is multipart. */
  formData?: RecordedFormDataEntry[];
  headers: IDataObject;
  /** The full options object passed to httpRequest. */
  options: IHttpRequestOptions;
}

export interface MockNodeOptions {
  params?: ParamsInput;
  itemParams?: Array<NodeParams | undefined>;
  /** Merged over DEFAULT_CREDENTIALS; set a credential to undefined to remove it. */
  credentials?: Record<string, IDataObject | undefined>;
  responses?: MockResponse[];
  /** Share one HTTP mock between several contexts. */
  http?: MockHttp;
  node?: Partial<INode>;
  /** Node description used to normalize parameters (runChatwootNode passes the Chatwoot node). */
  description?: INodeTypeDescription;
  /** Normalize parameters with `description` like n8n. Default: true when description is set. */
  applyDescriptionDefaults?: boolean;
  /**
   * Keep parameters that n8n would drop (unknown, hidden by displayOptions, unknown collection
   * options). Default false: tests then fail like n8n does when the node reads such a parameter.
   */
  keepUnknownParams?: boolean;
  staticData?: Record<string, IDataObject>;
  webhookUrl?: string;
}

export interface MockExecuteOptions extends MockNodeOptions {
  items?: INodeExecutionData[];
  continueOnFail?: boolean;
}

export const DEFAULT_CREDENTIALS: Record<string, IDataObject> = {
  chatwootApi: { baseUrl: 'https://chatwoot.test', accountId: 1, apiAccessToken: 'test-token' },
  chatwootPlatformApi: { baseUrl: 'https://chatwoot.test', apiAccessToken: 'platform-token' },
  chatwootPublicApi: { baseUrl: 'https://chatwoot.test', inboxIdentifier: 'inbox-identifier' },
};

export const DEFAULT_WEBHOOK_URL = 'https://n8n.test/webhook/test-webhook-id/webhook';

// ============================================================================
// n8n httpRequest error shapes
// ============================================================================

const HTTP_REQUEST_ERROR = Symbol.for('n8n.backend-network.http-request-error');

type MockHeaders = Record<string, string> & { get?: (name: string) => string | undefined };

function createHeaders(headers: Record<string, string> = {}): MockHeaders {
  const result: MockHeaders = {};
  for (const [key, value] of Object.entries(headers)) result[key.toLowerCase()] = value;
  // AxiosHeaders exposes a case-insensitive get()
  Object.defineProperty(result, 'get', {
    value: (name: string) => result[name.toLowerCase()],
    enumerable: false,
  });
  return result;
}

/**
 * Same shape as the error n8n 2.x helpers.httpRequest throws (a raw AxiosError tagged by
 * @n8n/backend-network): `status`, `code`, `response.{status,statusText,headers,data}`, no `statusCode`.
 */
export class AxiosError extends Error {
  readonly isAxiosError = true;
  code?: string;
  status?: number;
  config: IDataObject;
  request?: unknown;
  response?: {
    status: number;
    statusText: string;
    headers: MockHeaders;
    data: unknown;
    config: IDataObject;
  };

  constructor(message: string, code: string | undefined, config: IDataObject) {
    super(message);
    this.name = 'AxiosError';
    this.code = code;
    this.config = config;
  }

  toJSON() {
    return { message: this.message, name: this.name, code: this.code, status: this.status };
  }
}

function markHttpRequestError<E extends object>(error: E): E {
  Object.defineProperty(error, HTTP_REQUEST_ERROR, {
    value: true,
    enumerable: false,
    configurable: true,
  });
  return error;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/** Error thrown by n8n's httpRequest for a non-2xx response. */
export function httpError(
  status: number,
  body?: unknown,
  options: { headers?: Record<string, string>; method?: string; url?: string } = {},
): AxiosError {
  const config: IDataObject = { method: options.method?.toLowerCase(), url: options.url };
  const error = new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
  );
  error.status = status;
  error.request = {};
  error.response = {
    status,
    statusText: STATUS_TEXT[status] ?? '',
    headers: createHeaders(options.headers),
    data: body === undefined ? '' : body,
    config,
  };
  return markHttpRequestError(error);
}

/** Error thrown by n8n's httpRequest when the server cannot be reached (no response). */
export function networkError(code = 'ECONNREFUSED', message?: string): AxiosError {
  const error = new AxiosError(message ?? `connect ${code} 127.0.0.1:443`, code, {});
  // axios copies the original error name for transport failures
  error.name = 'Error';
  error.request = {};
  return markHttpRequestError(error);
}

// ============================================================================
// Query-string serialization (mirrors qs.stringify, without percent-encoding)
// ============================================================================

function serializeValue(
  prefix: string,
  value: unknown,
  arrayFormat: string,
  parts: string[],
): void {
  if (value === undefined) return;
  if (value === null) {
    parts.push(`${prefix}=`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    if (arrayFormat === 'comma') {
      parts.push(`${prefix}=${value.map(String).join(',')}`);
      return;
    }
    value.forEach((entry, index) => {
      const key =
        arrayFormat === 'brackets'
          ? `${prefix}[]`
          : arrayFormat === 'repeat'
            ? prefix
            : `${prefix}[${index}]`;
      serializeValue(key, entry, arrayFormat, parts);
    });
    return;
  }
  if (value instanceof Date) {
    parts.push(`${prefix}=${value.toISOString()}`);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as IDataObject)) {
      serializeValue(`${prefix}[${key}]`, entry, arrayFormat, parts);
    }
    return;
  }
  parts.push(`${prefix}=${String(value)}`);
}

/** Serialize like n8n does (qs.stringify with arrayFormat; n8n's default is 'indices'). */
export function serializeQuery(qs: IDataObject | undefined, arrayFormat = 'indices'): string {
  if (!qs) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(qs)) serializeValue(key, value, arrayFormat, parts);
  return parts.join('&');
}

// ============================================================================
// HTTP mock
// ============================================================================

function isFormDataBody(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function recordFormData(form: FormData): Promise<RecordedFormDataEntry[]> {
  const entries: RecordedFormDataEntry[] = [];
  for (const [name, value] of form.entries()) {
    if (typeof value === 'string') {
      entries.push({ name, kind: 'field', value });
    } else {
      const file = value as Blob & { name?: string };
      const content = Buffer.from(await file.arrayBuffer());
      entries.push({
        name,
        kind: 'file',
        fileName: file.name ?? 'blob',
        mimeType: file.type,
        size: file.size,
        content,
      });
    }
  }
  return entries;
}

const API_ROOTS: Array<[ChatwootApi, RegExp]> = [
  ['applicationV2', /^\/api\/v2\/accounts\/[^/]+(?=\/|$)/],
  ['application', /^\/api\/v1\/accounts\/[^/]+(?=\/|$)/],
  ['platform', /^\/platform\/api\/v1(?=\/|$)/],
  ['public', /^\/public\/api\/v1(?=\/|$)/],
];

/** Split a URL path into the Chatwoot API and the endpoint relative to its root. */
export function splitApiPath(path: string): { api: ChatwootApi | undefined; endpoint: string } {
  for (const [api, root] of API_ROOTS) {
    const match = root.exec(path);
    if (match) return { api, endpoint: path.slice(match[0].length) || '/' };
  }
  return { api: undefined, endpoint: path };
}

function matchesUrl(matcher: string | RegExp, call: RecordedCall): boolean {
  if (matcher instanceof RegExp) return matcher.test(call.url);
  return (
    matcher === call.url ||
    matcher === call.path ||
    (call.api !== undefined && matcher === call.endpoint)
  );
}

function clone<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value) as unknown as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Shape a mocked body the way axios hands it to n8n for the request's `encoding` (axios responseType):
 * an empty body is '', JSON text is parsed when no encoding is set, 'arraybuffer' gives a Buffer and
 * 'text' a string. Applies to success bodies and to error bodies (AxiosError.response.data).
 */
function toWireBody(body: unknown, encoding: IHttpRequestOptions['encoding']): unknown {
  const value = body === undefined ? '' : body;
  if (encoding === 'arraybuffer') {
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  }
  if (encoding === 'text') {
    if (Buffer.isBuffer(value)) return value.toString('utf8');
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (typeof value === 'string' && value !== '' && encoding !== 'stream') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return clone(value);
}

interface QueuedResponse extends MockResponse {
  remaining: number;
}

export class MockHttp {
  readonly calls: RecordedCall[] = [];

  private readonly queue: QueuedResponse[] = [];

  constructor(responses: MockResponse[] = []) {
    this.add(...responses);
  }

  add(...responses: MockResponse[]): this {
    for (const response of responses) {
      this.queue.push({ ...response, remaining: response.times ?? 1 });
    }
    return this;
  }

  /** Responses that were never used (finite `times` only). */
  pending(): MockResponse[] {
    return this.queue.filter((entry) => entry.remaining > 0 && Number.isFinite(entry.remaining));
  }

  /** Throw when a queued (finite) response was never requested: the code made fewer calls than expected. */
  assertAllConsumed(): void {
    const pending = this.pending();
    if (pending.length === 0) return;
    const list = pending
      .map((entry) => `${entry.method?.toUpperCase() ?? '*'} ${String(entry.url)}`)
      .join(', ');
    throw new Error(`MockHttp: ${pending.length} queued response(s) never requested: ${list}`);
  }

  readonly httpRequest = async (options: IHttpRequestOptions): Promise<unknown> => {
    const method = (options.method ?? 'GET').toUpperCase();
    const url = options.url;
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch {
      // keep the raw URL
    }

    const call: RecordedCall = {
      method,
      url,
      path,
      ...splitApiPath(path),
      qs: clone(options.qs),
      queryString: serializeQuery(options.qs, options.arrayFormat ?? 'indices'),
      arrayFormat: options.arrayFormat,
      body: isFormDataBody(options.body) ? options.body : clone(options.body),
      headers: { ...(options.headers ?? {}) },
      options,
    };
    if (isFormDataBody(options.body)) call.formData = await recordFormData(options.body);
    this.calls.push(call);

    const entry = this.queue.find(
      (candidate) =>
        candidate.remaining > 0 &&
        (!candidate.method || candidate.method.toUpperCase() === method) &&
        (!candidate.api || candidate.api === call.api) &&
        matchesUrl(candidate.url, call),
    );
    if (!entry) {
      const query = call.queryString ? `?${call.queryString}` : '';
      throw new Error(`MockHttp: no response queued for ${method} ${url}${query}`);
    }
    entry.remaining--;

    const reply: MockReply = entry.reply ? await entry.reply(call) : entry;
    if (reply.error !== undefined) throw reply.error;
    const status = reply.status ?? 200;
    if (status >= 400) {
      throw httpError(status, toWireBody(reply.body, options.encoding), {
        headers: reply.headers,
        method,
        url,
      });
    }
    const body = toWireBody(reply.body, options.encoding);
    if (options.returnFullResponse) {
      return {
        body,
        headers: createHeaders(reply.headers),
        statusCode: status,
        statusMessage: STATUS_TEXT[status] ?? 'OK',
      };
    }
    return body;
  };
}

// ============================================================================
// Shared context pieces
// ============================================================================

function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function createParamResolver(options: MockNodeOptions) {
  const cache = new Map<number, NodeParams>();
  const useDefaults = options.applyDescriptionDefaults ?? !!options.description;

  const paramsFor = (itemIndex: number): NodeParams => {
    const cached = cache.get(itemIndex);
    if (cached) return cached;
    const base =
      typeof options.params === 'function' ? options.params(itemIndex) : (options.params ?? {});
    let resolved: NodeParams = { ...base, ...(options.itemParams?.[itemIndex] ?? {}) };
    if (useDefaults && options.description) {
      // Same normalization as n8n's Workflow constructor: defaults added, invisible/unknown dropped
      const normalized = (NodeHelpers.getNodeParameters(
        options.description.properties,
        resolved as INodeParameters,
        true,
        false,
        { typeVersion: 1 },
        options.description,
      ) ?? {}) as NodeParams;
      resolved = options.keepUnknownParams ? { ...normalized, ...resolved } : normalized;
    }
    cache.set(itemIndex, resolved);
    return resolved;
  };

  return (
    name: string,
    itemIndex: number,
    fallback?: unknown,
    getOptions?: { extractValue?: boolean },
  ): unknown => {
    let value = getPath(paramsFor(itemIndex), name);
    if (value === undefined) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Could not get parameter "${name}"`);
    }
    const locator = value as { __rl?: boolean; value?: unknown };
    if (getOptions?.extractValue && locator && typeof locator === 'object' && locator.__rl) {
      value = locator.value;
    }
    return clone(value);
  };
}

function createNode(options: MockNodeOptions, params: NodeParams): INode {
  return {
    id: 'test-node-id',
    name: 'Chatwoot',
    type: '@renatoascencio/n8n-nodes-chatwoot.chatwoot',
    typeVersion: 1,
    position: [0, 0],
    parameters: params as INodeParameters,
    ...options.node,
  };
}

function createCredentialGetter(options: MockNodeOptions) {
  const credentials: Record<string, IDataObject | undefined> = {
    ...DEFAULT_CREDENTIALS,
    ...(options.credentials ?? {}),
  };
  return async (name: string) => {
    const value = credentials[name];
    if (!value) throw new Error(`Node does not have credentials of type "${name}"`);
    return clone(value);
  };
}

function createStaticData(options: MockNodeOptions) {
  const store: Record<string, IDataObject> = options.staticData ?? {};
  const get = (type: string) => {
    store[type] ??= {};
    return store[type];
  };
  return { store, get };
}

function unsupported(name: string) {
  return () => {
    throw new Error(`${name} is not supported by the mock (the Chatwoot helpers must not use it)`);
  };
}

export function returnJsonArray(jsonData: IDataObject | IDataObject[]): INodeExecutionData[] {
  const list = Array.isArray(jsonData) ? jsonData : [jsonData];
  return list.map((data) => {
    const wrapped = data as IDataObject & { json?: IDataObject };
    return wrapped?.json
      ? ({ ...wrapped, json: wrapped.json } as INodeExecutionData)
      : { json: data };
  });
}

export function constructExecutionMetaData(
  inputData: INodeExecutionData[],
  options: { itemData: IPairedItemData | IPairedItemData[] },
): INodeExecutionData[] {
  return inputData.map(({ json, ...rest }) => ({ json, pairedItem: options.itemData, ...rest }));
}

// n8n guesses the MIME type from the file extension when none is given (mime-types lookup)
const MIME_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
  html: 'text/html',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function prepareBinaryData(
  binaryData: Buffer,
  filePath?: string,
  mimeType?: string,
): Promise<IBinaryData> {
  const fileName = filePath?.split('/').pop();
  const extension = fileName?.includes('.') ? fileName.split('.').pop() : undefined;
  return {
    data: binaryData.toString('base64'),
    mimeType:
      mimeType ??
      (extension && MIME_BY_EXTENSION[extension.toLowerCase()]) ??
      'application/octet-stream',
    fileName,
    fileExtension: extension,
    fileSize: `${binaryData.length} B`,
  };
}

/** Input item carrying binary data (base64-encoded like n8n's in-memory binary mode). */
export function binaryItem(options: {
  content: string | Buffer;
  fileName?: string;
  mimeType?: string;
  propertyName?: string;
  json?: IDataObject;
}): INodeExecutionData {
  const buffer = Buffer.isBuffer(options.content) ? options.content : Buffer.from(options.content);
  const fileName = options.fileName ?? 'file.bin';
  return {
    json: options.json ?? {},
    binary: {
      [options.propertyName ?? 'data']: {
        data: buffer.toString('base64'),
        mimeType: options.mimeType ?? 'application/octet-stream',
        fileName,
        fileExtension: fileName.includes('.') ? fileName.split('.').pop() : undefined,
        fileSize: `${buffer.length} B`,
      },
    },
  };
}

// ============================================================================
// IExecuteFunctions
// ============================================================================

export interface MockExecuteContext {
  ctx: IExecuteFunctions;
  http: MockHttp;
  calls: RecordedCall[];
  staticData: Record<string, IDataObject>;
}

export function createMockExecuteFunctions(options: MockExecuteOptions = {}): MockExecuteContext {
  const http = options.http ?? new MockHttp();
  if (options.responses) http.add(...options.responses);
  const items: INodeExecutionData[] = options.items ?? [{ json: {} }];
  const getParam = createParamResolver(options);
  const getCredentials = createCredentialGetter(options);
  const staticData = createStaticData(options);
  const rawParams =
    typeof options.params === 'function' ? options.params(0) : (options.params ?? {});
  const node = createNode(options, rawParams);

  const getBinary = (itemIndex: number, propertyName: string | IBinaryData): IBinaryData => {
    if (typeof propertyName !== 'string') return propertyName;
    const binary = items[itemIndex]?.binary;
    if (!binary) {
      throw new NodeOperationError(
        node,
        `This operation expects the node's input data to contain a binary file '${propertyName}', but none was found [item ${itemIndex}]`,
        { itemIndex },
      );
    }
    const data = binary[propertyName];
    if (!data) {
      throw new NodeOperationError(
        node,
        `The item has no binary field '${propertyName}' [item ${itemIndex}]`,
        { itemIndex },
      );
    }
    return data;
  };

  const ctx = {
    getInputData: () => items,
    getNodeParameter: (name: string, itemIndex: number, fallback?: unknown, opts?: IDataObject) =>
      getParam(name, itemIndex, fallback, opts),
    getCredentials: async (name: string) => await getCredentials(name),
    getNode: () => node,
    continueOnFail: () => options.continueOnFail ?? false,
    getWorkflowStaticData: (type: string) => staticData.get(type),
    getNodeWebhookUrl: () => options.webhookUrl ?? DEFAULT_WEBHOOK_URL,
    getExecutionCancelSignal: () => undefined,
    getMode: () => 'manual',
    getExecutionId: () => 'test-execution-id',
    getTimezone: () => 'UTC',
    getWorkflow: () => ({ id: 'test-workflow-id', name: 'Test Workflow', active: false }),
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    helpers: {
      httpRequest: http.httpRequest,
      request: unsupported('helpers.request'),
      httpRequestWithAuthentication: unsupported('helpers.httpRequestWithAuthentication'),
      requestWithAuthentication: unsupported('helpers.requestWithAuthentication'),
      returnJsonArray,
      constructExecutionMetaData,
      assertBinaryData: (itemIndex: number, propertyName: string | IBinaryData) =>
        getBinary(itemIndex, propertyName),
      getBinaryDataBuffer: async (itemIndex: number, propertyName: string | IBinaryData) =>
        Buffer.from(getBinary(itemIndex, propertyName).data, 'base64'),
      prepareBinaryData,
    },
  };

  return {
    ctx: ctx as unknown as IExecuteFunctions,
    http,
    calls: http.calls,
    staticData: staticData.store,
  };
}

// ============================================================================
// IHookFunctions / IWebhookFunctions (trigger node)
// ============================================================================

export interface MockHookContext {
  ctx: IHookFunctions;
  http: MockHttp;
  calls: RecordedCall[];
  staticData: Record<string, IDataObject>;
}

export function createMockHookFunctions(options: MockNodeOptions = {}): MockHookContext {
  const http = options.http ?? new MockHttp();
  if (options.responses) http.add(...options.responses);
  const getParam = createParamResolver(options);
  const getCredentials = createCredentialGetter(options);
  const staticData = createStaticData(options);
  const rawParams =
    typeof options.params === 'function' ? options.params(0) : (options.params ?? {});
  const node = createNode({ node: { name: 'Chatwoot Trigger', ...options.node } }, rawParams);

  const ctx = {
    getNodeParameter: (name: string, fallback?: unknown, opts?: IDataObject) =>
      getParam(name, 0, fallback, opts),
    getCredentials: async (name: string) => await getCredentials(name),
    getNode: () => node,
    getWorkflowStaticData: (type: string) => staticData.get(type),
    getNodeWebhookUrl: () => options.webhookUrl ?? DEFAULT_WEBHOOK_URL,
    getWebhookName: () => 'default',
    getWebhookDescription: () => undefined,
    getMode: () => 'trigger',
    getActivationMode: () => 'activate',
    getTimezone: () => 'UTC',
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    helpers: {
      httpRequest: http.httpRequest,
      request: unsupported('helpers.request'),
      httpRequestWithAuthentication: unsupported('helpers.httpRequestWithAuthentication'),
      requestWithAuthentication: unsupported('helpers.requestWithAuthentication'),
    },
  };

  return {
    ctx: ctx as unknown as IHookFunctions,
    http,
    calls: http.calls,
    staticData: staticData.store,
  };
}

export interface MockWebhookOptions extends MockNodeOptions {
  /** Parsed request body (getBodyData / getRequestObject().body). */
  body?: IDataObject;
  /** Request headers (lower-case names, like Node/Express). */
  headers?: Record<string, string>;
  query?: IDataObject;
  /** Raw body; defaults to JSON.stringify(body). */
  rawBody?: Buffer | string;
  method?: string;
}

/** Records what the webhook wrote to the Express response object. */
export interface MockResponseObject {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  ended: boolean;
  status(code: number): MockResponseObject;
  setHeader(name: string, value: string): MockResponseObject;
  set(name: string, value: string): MockResponseObject;
  header(name: string, value: string): MockResponseObject;
  json(body: unknown): MockResponseObject;
  send(body?: unknown): MockResponseObject;
  end(body?: unknown): MockResponseObject;
}

function createResponseObject(): MockResponseObject {
  const response: MockResponseObject = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    status(code) {
      response.statusCode = code;
      return response;
    },
    setHeader(name, value) {
      response.headers[name.toLowerCase()] = value;
      return response;
    },
    set(name, value) {
      return response.setHeader(name, value);
    },
    header(name, value) {
      return response.setHeader(name, value);
    },
    json(body) {
      response.body = body;
      response.ended = true;
      return response;
    },
    send(body) {
      response.body = body;
      response.ended = true;
      return response;
    },
    end(body) {
      if (body !== undefined) response.body = body;
      response.ended = true;
      return response;
    },
  };
  return response;
}

export interface MockWebhookContext {
  ctx: IWebhookFunctions;
  http: MockHttp;
  calls: RecordedCall[];
  response: MockResponseObject;
  staticData: Record<string, IDataObject>;
}

export function createMockWebhookFunctions(options: MockWebhookOptions = {}): MockWebhookContext {
  const http = options.http ?? new MockHttp();
  if (options.responses) http.add(...options.responses);
  const getParam = createParamResolver(options);
  const getCredentials = createCredentialGetter(options);
  const staticData = createStaticData(options);
  const rawParams =
    typeof options.params === 'function' ? options.params(0) : (options.params ?? {});
  const node = createNode({ node: { name: 'Chatwoot Trigger', ...options.node } }, rawParams);
  const body = options.body ?? {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.headers ?? {}))
    headers[key.toLowerCase()] = value;
  const rawBody =
    options.rawBody === undefined
      ? Buffer.from(JSON.stringify(body))
      : Buffer.isBuffer(options.rawBody)
        ? options.rawBody
        : Buffer.from(options.rawBody);
  const response = createResponseObject();
  const request = {
    method: options.method ?? 'POST',
    body,
    headers,
    query: options.query ?? {},
    params: {},
    rawBody,
    header: (name: string) => headers[name.toLowerCase()],
    get: (name: string) => headers[name.toLowerCase()],
  };

  const ctx = {
    getNodeParameter: (name: string, fallback?: unknown, opts?: IDataObject) =>
      getParam(name, 0, fallback, opts),
    getCredentials: async (name: string) => await getCredentials(name),
    getNode: () => node,
    getWorkflowStaticData: (type: string) => staticData.get(type),
    getNodeWebhookUrl: () => options.webhookUrl ?? DEFAULT_WEBHOOK_URL,
    getWebhookName: () => 'default',
    getMode: () => 'trigger',
    getBodyData: () => body,
    getHeaderData: () => headers,
    getQueryData: () => request.query,
    getParamsData: () => ({}),
    getRequestObject: () => request,
    getResponseObject: () => response,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    helpers: {
      httpRequest: http.httpRequest,
      request: unsupported('helpers.request'),
      httpRequestWithAuthentication: unsupported('helpers.httpRequestWithAuthentication'),
      returnJsonArray,
      prepareBinaryData,
    },
  };

  return {
    ctx: ctx as unknown as IWebhookFunctions,
    http,
    calls: http.calls,
    response,
    staticData: staticData.store,
  };
}

// ============================================================================
// Retry sleep + convenience runner
// ============================================================================

/**
 * Record retry delays in `delays` (nothing really waits); restore() puts back the previous recorder
 * (the harness no-op), never n8n's real sleep, so nesting (beforeEach + runChatwootNode) is safe.
 */
export function mockRetrySleep(): { delays: number[]; restore: () => void } {
  const delays: number[] = [];
  const previous = setRetrySleep(async (ms: number) => {
    delays.push(ms);
  });
  return { delays, restore: () => void setRetrySleep(previous) };
}

export interface RunChatwootNodeOptions extends MockExecuteOptions {
  /** Do not fail when queued (finite) responses were never requested. Default false. */
  allowUnusedResponses?: boolean;
}

export interface RunChatwootNodeResult {
  output: INodeExecutionData[][];
  calls: RecordedCall[];
  sleeps: number[];
  http: MockHttp;
}

/**
 * Run the real Chatwoot node's execute() against mocked HTTP responses.
 * Throws whatever execute() throws (use createMockExecuteFunctions to inspect calls on failure).
 * After a successful run, fails if a queued response was never requested (see allowUnusedResponses).
 */
export async function runChatwootNode(
  options: RunChatwootNodeOptions,
): Promise<RunChatwootNodeResult> {
  const node = new Chatwoot();
  const mock = createMockExecuteFunctions({ description: node.description, ...options });
  const sleep = mockRetrySleep();
  let output: INodeExecutionData[][];
  try {
    output = await node.execute.call(mock.ctx);
  } finally {
    sleep.restore();
  }
  if (!options.allowUnusedResponses) mock.http.assertAllConsumed();
  return { output, calls: mock.calls, sleeps: sleep.delays, http: mock.http };
}
