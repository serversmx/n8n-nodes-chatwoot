import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { ChatwootApi, ItemExtractor } from '../../GenericFunctions';
import {
  chatwootRequest,
  DEFAULT_MAX_PAGES,
  extractItems,
  getPaginationMeta,
} from '../../GenericFunctions';

// ============================================================================
// Shared helpers for the reporting / insight resources (report, csatSurvey, appliedSla,
// auditLog, company, helpCenter). Kept here so the execute branches stay short.
// ============================================================================

/**
 * Convert a date parameter to Unix seconds (integer), as Chatwoot's DateRangeHelper expects
 * (`DateTime.strptime(value, '%s')` rejects fractional values). Accepts ISO strings, Date/Luxon
 * objects and numeric epochs (seconds, or milliseconds when larger than 1e11).
 * Returns undefined for empty values; throws for values that are not a date.
 */
export function toUnixSeconds(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  let ms: number;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))) {
    const num = Number(value);
    ms = num > 1e11 ? num : num * 1000;
  } else {
    ms = new Date(value as string).getTime();
  }
  if (!Number.isFinite(ms)) {
    throw new Error(`${fieldName} is not a valid date: ${String(value)}`);
  }
  return Math.floor(ms / 1000);
}

/** Parse "1, 2,3" (or an array) into positive integer IDs. Invalid entries throw. */
export function parseIdList(value: unknown, fieldName: string): number[] {
  if (value === undefined || value === null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  const ids: number[] = [];
  for (const part of parts) {
    const text = String(part).trim();
    if (text === '') continue;
    const id = Number(text);
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`${fieldName} must be a comma-separated list of positive integer IDs`);
    }
    ids.push(id);
  }
  return ids;
}

/** Parse "a, b ,c" (or an array) into trimmed, non-empty strings. */
export function parseStringList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

/**
 * Parse a JSON-object parameter (string or object). Returns undefined for empty values and for an
 * empty object ('{}' is the UI default); throws when the value is not a JSON object.
 */
export function parseJsonObject(value: unknown, fieldName: string): IDataObject | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      // Pure parsing helper with no node/context of its own; both call sites sit inside
      // Chatwoot.node.ts's execute() loop, whose outer catch already rewraps any plain Error into a
      // NodeOperationError (see GenericFunctions.ts's parseJsonSafe for the same pattern).
      // eslint-disable-next-line
      throw new Error(`Invalid JSON in "${fieldName}": ${value.substring(0, 100)}`);
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`"${fieldName}" must be a JSON object`);
  }
  return Object.keys(parsed).length > 0 ? (parsed as IDataObject) : undefined;
}

/**
 * Rebuild a portal's writable config from a GET /portals/:slug response, so an update can send the
 * complete config (allowed_locales come back as [{ code, draft, ... }]).
 */
export function portalConfigFromResponse(portal: IDataObject): IDataObject {
  const config = (portal.config ?? {}) as IDataObject;
  const base: IDataObject = {};
  const locales = Array.isArray(config.allowed_locales)
    ? (config.allowed_locales as unknown[])
    : [];
  const codeOf = (locale: unknown): string | undefined =>
    typeof locale === 'string' ? locale : ((locale as IDataObject)?.code as string | undefined);
  const codes = locales.map(codeOf).filter((code): code is string => !!code);
  if (codes.length > 0) {
    base.allowed_locales = codes;
    base.draft_locales = locales
      .filter((locale) => typeof locale === 'object' && (locale as IDataObject).draft === true)
      .map(codeOf)
      .filter((code): code is string => !!code);
  }
  if (config.default_locale) base.default_locale = config.default_locale;
  if (config.layout) base.layout = config.layout;
  for (const key of ['social_profiles', 'locale_translations', 'popular_content']) {
    const value = config[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      base[key] = value;
    }
  }
  // PortalsController#validate_analytics_params rejects non-string values (422): keep only set IDs
  const analytics = config.analytics;
  if (analytics && typeof analytics === 'object' && !Array.isArray(analytics)) {
    const ids = Object.entries(analytics as IDataObject).filter(
      ([, value]) => typeof value === 'string' && value !== '',
    );
    if (ids.length > 0) base.analytics = Object.fromEntries(ids) as IDataObject;
  }
  return base;
}

// ============================================================================
// Client-side filtered pagination
// ============================================================================

export interface FilteredPagesOptions {
  api?: ChatwootApi;
  /** Stop as soon as this many matching items were collected. */
  limit?: number;
  /** Known page size, used to detect the last page when the response has no meta. */
  pageSize: number;
  itemIndex: number;
}

/**
 * Walk a paginated GET endpoint page by page and keep only the items matching `predicate`.
 * Used where Chatwoot has no server-side filter (CSAT by conversation, audit logs by user ID).
 * Stops on an empty or short page, on meta (total_pages / total count), once `limit` matches were
 * found, or fails with a NodeOperationError after DEFAULT_MAX_PAGES pages (never truncates silently).
 */
export async function requestFilteredPages(
  this: IExecuteFunctions,
  endpoint: string,
  qs: IDataObject,
  extractor: ItemExtractor | undefined,
  predicate: (item: IDataObject) => boolean,
  options: FilteredPagesOptions,
): Promise<IDataObject[]> {
  const matches: IDataObject[] = [];
  // Records created during a long scan shift the newest-first pages: skip ids already returned
  const seen = new Set<string>();
  let scanned = 0;
  for (let page = 1; ; page++) {
    if (page > DEFAULT_MAX_PAGES) {
      throw new NodeOperationError(
        this.getNode(),
        `Chatwoot pagination for GET ${endpoint} exceeded ${DEFAULT_MAX_PAGES} pages (${scanned} items scanned)`,
        {
          itemIndex: options.itemIndex,
          description: 'Narrow the search with a date range (Since/Until) or other filters.',
        },
      );
    }
    const response = await chatwootRequest.call(
      this,
      'GET',
      endpoint,
      {},
      { ...qs, page },
      { api: options.api ?? 'application', itemIndex: options.itemIndex },
    );
    const items = extractItems(response, extractor);
    if (items.length === 0) break;
    scanned += items.length;
    for (const item of items) {
      const id = item.id;
      const key = typeof id === 'number' || typeof id === 'string' ? String(id) : undefined;
      if (key !== undefined) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      if (predicate(item)) matches.push(item);
    }
    if (options.limit !== undefined && matches.length >= options.limit) break;

    const meta = getPaginationMeta(response);
    if (meta.totalPages !== undefined && page >= meta.totalPages) break;
    if (meta.totalCount !== undefined && scanned >= meta.totalCount) break;
    if (items.length < (meta.perPage ?? options.pageSize)) break;
  }
  return options.limit !== undefined ? matches.slice(0, options.limit) : matches;
}

// ============================================================================
// CSV downloads (reports, CSAT, SLA): binary file or parsed rows
// ============================================================================

/**
 * "Output" + "Put Output File in Field" parameters for operations that download a CSV.
 * `csvOutput` = 'binary' (default) gives one item with the file, 'rows' one item per CSV row.
 */
export function csvOutputFields(resource: string, operations: string[]): INodeProperties[] {
  return [
    {
      displayName: 'Output',
      name: 'csvOutput',
      type: 'options',
      options: [
        {
          name: 'Binary File',
          value: 'binary',
          description: 'One item with the CSV file in a binary field (to save, email or upload it)',
        },
        {
          name: 'Parsed Rows',
          value: 'rows',
          description:
            'One item per CSV data row, keyed by the column headers (best for further processing and AI agents)',
        },
      ],
      default: 'binary',
      displayOptions: { show: { resource: [resource], operation: operations } },
      description: 'Chatwoot returns this report as a CSV file. Choose how to output it.',
    },
    {
      displayName: 'Put Output File in Field',
      name: 'binaryPropertyName',
      type: 'string',
      default: 'data',
      displayOptions: {
        show: { resource: [resource], operation: operations, csvOutput: ['binary'] },
      },
      description: 'Name of the output binary field to put the CSV file in',
    },
  ];
}

/**
 * Minimal RFC 4180 parser: quoted fields, escaped quotes (""), commas and newlines inside quotes,
 * CRLF/LF line endings and a UTF-8 BOM. Unquoted fields are trimmed (Chatwoot's SLA template
 * indents its rows). Rows whose cells are all empty are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endField = () => {
    row.push(quoted ? field : field.trim());
    field = '';
    quoted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && !quoted && field.trim() === '') {
      inQuotes = true;
      quoted = true;
      field = '';
    } else if (char === ',') {
      endField();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r' && !quoted) {
      field += char;
    }
  }
  if (field !== '' || quoted || row.length > 0) endRow();
  return rows;
}

/**
 * Turn parsed CSV rows into objects keyed by the header row.
 * `headerRow` is the index (among non-empty rows) of the header; the rows above it are metadata
 * (Chatwoot writes the reporting period or the timezone first). Single-cell rows after the header
 * are metadata too (the CSAT export ends with the reporting period). Cells beyond the header get
 * `column_<n>` keys (Chatwoot's inbox report has more values than headers).
 */
export function csvRowsToObjects(rows: string[][], headerRow = 0): IDataObject[] {
  const header = rows[headerRow];
  if (!header) return [];
  const keys = header.map((name, index) => name || `column_${index + 1}`);
  return rows
    .slice(headerRow + 1)
    .filter((row) => !(row.length === 1 && keys.length > 1))
    .map((row) => {
      const record: IDataObject = {};
      row.forEach((value, index) => {
        record[index < keys.length ? keys[index] : `column_${index + 1}`] = value;
      });
      return record;
    });
}

/**
 * Undo the CSV-injection escaping of Chatwoot's CSVSafe writer, which prefixes a quote to cells
 * starting with =, +, -, @ (and a few control characters): "'+5215512345678" -> "+5215512345678".
 * Only for parsed rows (JSON cannot trigger spreadsheet formulas); the binary file is left as is.
 */
export function unescapeCsvSafeCell(value: string): string {
  return /^'[=+\-@%|\t\r]/.test(value) ? value.slice(1) : value;
}

export interface CsvOutputOptions {
  /** File name for the binary output (Chatwoot's Content-Disposition name). */
  fileName: string;
  /** Index of the header among the non-empty CSV rows (see csvRowsToObjects). */
  headerRow: number;
  /** The CSV was written with CSVSafe (reports, CSAT): unescape the cells of parsed rows. */
  csvSafe?: boolean;
}

/**
 * Build the output items for a CSV download according to the `csvOutput` parameter:
 * a binary file (default) or one JSON item per data row. Items carry pairedItem = itemIndex.
 */
export async function buildCsvOutput(
  this: IExecuteFunctions,
  itemIndex: number,
  csv: unknown,
  options: CsvOutputOptions,
): Promise<INodeExecutionData[]> {
  const text = typeof csv === 'string' ? csv : Buffer.isBuffer(csv) ? csv.toString('utf8') : '';
  const output = this.getNodeParameter('csvOutput', itemIndex, 'binary') as string;

  if (output === 'rows') {
    let rows = parseCsv(text);
    if (options.csvSafe) rows = rows.map((row) => row.map(unescapeCsvSafeCell));
    const records = csvRowsToObjects(rows, options.headerRow);
    return records.map((json) => ({ json, pairedItem: { item: itemIndex } }));
  }

  const binaryPropertyName = (
    this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string
  ).trim();
  if (!binaryPropertyName) {
    throw new NodeOperationError(this.getNode(), 'Put Output File in Field must not be empty', {
      itemIndex,
    });
  }
  const binaryData = await this.helpers.prepareBinaryData(
    Buffer.from(text, 'utf8'),
    options.fileName,
    'text/csv',
  );
  return [
    {
      json: { fileName: options.fileName, mimeType: 'text/csv', fileSize: Buffer.byteLength(text) },
      binary: { [binaryPropertyName]: binaryData },
      pairedItem: { item: itemIndex },
    },
  ];
}
