import type { IDataObject, IExecuteFunctions, INodePropertyOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
  chatwootApiRequest,
  chatwootMultipartRequest,
  parseJsonSafe,
} from '../../GenericFunctions';

// ============================================================================
// Shared field options
// ============================================================================

/**
 * Sort keys accepted by GET /contacts, GET /contacts/search and POST /contacts/filter (Sift
 * `sort_on` in contacts_controller.rb). Unknown keys are ignored by Chatwoot.
 */
export const CONTACT_SORT_OPTIONS: INodePropertyOptions[] = [
  { name: 'City (A-Z)', value: 'city' },
  { name: 'City (Z-A)', value: '-city' },
  { name: 'Company Name (A-Z)', value: 'company_name', description: 'Requires Chatwoot 4.14+' },
  { name: 'Company Name (Z-A)', value: '-company_name', description: 'Requires Chatwoot 4.14+' },
  { name: 'Country (A-Z)', value: 'country' },
  { name: 'Country (Z-A)', value: '-country' },
  { name: 'Created At (Newest)', value: '-created_at' },
  { name: 'Created At (Oldest)', value: 'created_at' },
  { name: 'Email (A-Z)', value: 'email' },
  { name: 'Email (Z-A)', value: '-email' },
  { name: 'Last Activity (Newest)', value: '-last_activity_at' },
  { name: 'Last Activity (Oldest)', value: 'last_activity_at' },
  { name: 'Name (A-Z)', value: 'name' },
  { name: 'Name (Z-A)', value: '-name' },
  { name: 'Phone Number (A-Z)', value: 'phone_number' },
  { name: 'Phone Number (Z-A)', value: '-phone_number' },
];

/**
 * Safety cap on the contacts read from GET /contacts/search (15 per page) by Find by WhatsApp
 * Number. The query is the digit run shared by every variant (at least 7 digits), which matches
 * very few contacts; exact matches are then picked client-side.
 */
export const WHATSAPP_SEARCH_LIMIT = 100;

/**
 * Query parameters shared by the contact list endpoints (index, search, filter).
 * `include_contact_inboxes` defaults to true on the server, so it is only sent when set.
 */
export function buildContactListQuery(options: IDataObject): IDataObject {
  const qs: IDataObject = {};
  if (options.sort) qs.sort = options.sort;
  if (options.include_contact_inboxes !== undefined) {
    qs.include_contact_inboxes = options.include_contact_inboxes ? 'true' : 'false';
  }
  return qs;
}

/** Parse a JSON field that must hold an object (custom_attributes, additional_attributes). */
export function parseJsonObjectField(
  this: IExecuteFunctions,
  value: unknown,
  fieldName: string,
  itemIndex: number,
): IDataObject {
  let parsed: unknown;
  try {
    parsed = parseJsonSafe(value, fieldName);
  } catch (error) {
    throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NodeOperationError(
      this.getNode(),
      `"${fieldName}" must be a JSON object, e.g. {"key": "value"}`,
      {
        itemIndex,
      },
    );
  }
  return parsed as IDataObject;
}

// ============================================================================
// Labels
// ============================================================================

/**
 * Normalize a label list from a multiOptions value, an expression array or a comma-separated
 * string. Trims, drops empties and removes case-insensitive duplicates (Chatwoot tags are
 * matched case-insensitively), keeping the first spelling.
 */
export function normalizeLabelList(value: unknown): string[] {
  let raw: unknown[];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === 'string') raw = value.split(',');
  else if (value === undefined || value === null) raw = [];
  else raw = [value];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (entry === undefined || entry === null) continue;
    const label = String(entry).trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

/** Union of the current labels and the labels to add (existing spelling and order first). */
export function mergeLabelLists(current: string[], toAdd: string[]): string[] {
  return normalizeLabelList([...current, ...toAdd]);
}

/** The current labels minus the labels to remove (case-insensitive). */
export function subtractLabelLists(current: string[], toRemove: string[]): string[] {
  const remove = new Set(toRemove.map((label) => label.toLowerCase()));
  return normalizeLabelList(current).filter((label) => !remove.has(label.toLowerCase()));
}

/** GET /contacts/:id/labels answers `{ payload: ['a', 'b'] }`. */
export async function fetchContactLabels(
  this: IExecuteFunctions,
  contactId: number,
  itemIndex: number,
): Promise<string[]> {
  const response = (await chatwootApiRequest.call(
    this,
    'GET',
    `/contacts/${contactId}/labels`,
    {},
    {},
    { itemIndex },
  )) as IDataObject;
  const payload = Array.isArray(response) ? response : response.payload;
  return normalizeLabelList(Array.isArray(payload) ? payload : []);
}

/**
 * POST /contacts/:id/labels REPLACES the contact's labels with `labels` (label_concern.rb calls
 * update_labels). An empty array clears them. The response is `{ payload: [labels] }`.
 */
export async function replaceContactLabels(
  this: IExecuteFunctions,
  contactId: number,
  labels: string[],
  itemIndex: number,
): Promise<IDataObject> {
  return (await chatwootApiRequest.call(
    this,
    'POST',
    `/contacts/${contactId}/labels`,
    { labels },
    {},
    { itemIndex },
  )) as IDataObject;
}

// ============================================================================
// Filter payload (POST /contacts/filter and the export filter)
// ============================================================================

/** Contact filter keys renamed by Chatwoot (4.14 renamed 'company' to 'company_name'). */
const CONTACT_FILTER_KEY_RENAMES: Record<string, string> = { company: 'company_name' };

const PRESENCE_OPERATORS = ['is_present', 'is_not_present'];

const TEXT_MATCH_OPERATORS = ['contains', 'does_not_contain'];

/**
 * Standard contact keys compared as text (plus labels, compared with tag names). Chatwoot calls
 * String methods on their values (phone_number `delete('+')`, country_code `downcase`, ILIKE
 * `strip`) or compares them with text columns, so a JSON number or boolean there fails with
 * a 500.
 */
const TEXT_VALUE_KEYS = [
  'name',
  'email',
  'phone_number',
  'identifier',
  'country_code',
  'city',
  'company_name',
  'labels',
];

/** Whole number of days for days_before, like Ruby `Integer(value.to_s, 10)`; else undefined. */
function parseDays(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isInteger(value) ? value : undefined;
  if (typeof value === 'string' && /^\s*\d+\s*$/.test(value)) return Number(value);
  return undefined;
}

/**
 * Validate and normalize a Chatwoot filter payload for Chatwoot 4.17+ (filter_service.rb):
 * - accepts a JSON string, an array of conditions or `{ "payload": [...] }`; an empty array is
 *   sent as-is (Chatwoot then matches every contact, as before this validation existed);
 * - renames legacy attribute keys ('company' -> 'company_name');
 * - wraps a scalar `values` into an array (Chatwoot reads `values[0]`);
 * - is_present / is_not_present get `values: []` (the labels filter reads `values[0]` and a
 *   missing array answers 500);
 * - numbers and booleans become strings for text keys and contains/does_not_contain (500
 *   otherwise);
 * - every condition except the last needs query_operator AND/OR: a missing one becomes 'AND'
 *   (without it Chatwoot builds invalid SQL and answers 500);
 * - the last condition must not carry a query_operator (4.17+ answers 422): it is set to null;
 * - days_before must be a whole number of days between 1 and 998 (4.17+ answers 422).
 * Throws a NodeOperationError with a precise message instead of sending an invalid payload.
 */
export function normalizeContactFilterPayload(
  this: IExecuteFunctions,
  value: unknown,
  itemIndex: number,
  fieldName = 'Filter Payload',
): IDataObject[] {
  const description =
    'Expected a JSON array of conditions, e.g. [{"attribute_key": "email", "filter_operator": "contains", "values": ["@example.com"]}]. ' +
    'Join conditions with "query_operator": "AND" or "OR"; the last condition must not have one.';
  const fail = (message: string): never => {
    throw new NodeOperationError(this.getNode(), `${fieldName}: ${message}`, {
      itemIndex,
      description,
    });
  };

  let parsed: unknown;
  try {
    parsed = parseJsonSafe(value, fieldName);
  } catch (error) {
    throw new NodeOperationError(this.getNode(), (error as Error).message, {
      itemIndex,
      description,
    });
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'payload' in parsed) {
    parsed = (parsed as IDataObject).payload;
  }
  if (!Array.isArray(parsed)) return fail('must be a JSON array of conditions');

  return parsed.map((entry, index) => {
    const position = `condition ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return fail(`${position} must be an object`);
    }
    const condition = { ...(entry as IDataObject) };

    if (typeof condition.attribute_key !== 'string' || !condition.attribute_key.trim()) {
      return fail(`${position} needs an "attribute_key"`);
    }
    const key = condition.attribute_key.trim();
    condition.attribute_key = CONTACT_FILTER_KEY_RENAMES[key] ?? key;

    if (typeof condition.filter_operator !== 'string' || !condition.filter_operator.trim()) {
      return fail(`${position} (${condition.attribute_key}) needs a "filter_operator"`);
    }
    condition.filter_operator = condition.filter_operator.trim();

    if (PRESENCE_OPERATORS.includes(condition.filter_operator)) {
      // Values are meaningless here, but Chatwoot still reads values[0] for labels
      condition.values = [];
    } else {
      const values = condition.values;
      const valueList: unknown[] =
        values === undefined || values === null ? [] : Array.isArray(values) ? values : [values];
      if (valueList.length === 0) {
        return fail(`${position} (${condition.attribute_key}) needs "values"`);
      }
      if (valueList.some((v) => v === null || typeof v === 'object')) {
        return fail(
          `${position} (${condition.attribute_key}): values must be plain strings, numbers or booleans`,
        );
      }
      const asText =
        TEXT_MATCH_OPERATORS.includes(condition.filter_operator) ||
        TEXT_VALUE_KEYS.includes(condition.attribute_key);
      condition.values = asText
        ? valueList.map((v) => (typeof v === 'string' ? v : String(v)))
        : valueList;

      if (condition.filter_operator === 'days_before') {
        const days = parseDays(valueList[0]);
        if (days === undefined || days < 1 || days > 998) {
          return fail(
            `${position} (${condition.attribute_key}): "days_before" needs a whole number of days between 1 and 998 (Chatwoot 4.17+ rejects other values)`,
          );
        }
        condition.values = [days];
      }
    }

    const isLast = index === parsed.length - 1;
    if (isLast) {
      condition.query_operator = null;
    } else {
      const operator =
        condition.query_operator === undefined || condition.query_operator === null
          ? ''
          : String(condition.query_operator).trim().toUpperCase();
      if (operator === '') {
        condition.query_operator = 'AND';
      } else if (operator === 'AND' || operator === 'OR') {
        condition.query_operator = operator;
      } else {
        return fail(
          `${position} (${condition.attribute_key}): query_operator must be "AND" or "OR"`,
        );
      }
    }

    return condition;
  });
}

/** True for an unset optional filter payload ('', '[]', [], null). */
export function isEmptyFilterPayload(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || /^\[\s*\]$/.test(trimmed);
  }
  return false;
}

// ============================================================================
// Conversations of a contact
// ============================================================================

/**
 * Sort conversations by last activity (newest first), then by id. Chatwoot <= 4.17 already
 * returns the 20 most recently active; 4.18.0 returns the 25 most recently CREATED ones.
 */
export function sortConversationsByActivity(conversations: IDataObject[]): IDataObject[] {
  const activity = (conversation: IDataObject): number => {
    const value = Number(conversation.last_activity_at ?? conversation.timestamp ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return [...conversations].sort(
    (a, b) => activity(b) - activity(a) || Number(b.id ?? 0) - Number(a.id ?? 0),
  );
}

// ============================================================================
// Import (multipart CSV)
// ============================================================================

/**
 * POST /contacts/import with the CSV as the multipart file `import_file` (ActiveStorage
 * attachment). Chatwoot answers `head :ok` and processes the file in the background.
 */
export async function importContactsCsv(
  this: IExecuteFunctions,
  itemIndex: number,
  binaryPropertyName: string,
): Promise<IDataObject> {
  const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
  const fileName = binaryData.fileName || 'contacts.csv';
  await chatwootMultipartRequest.call(this, 'POST', '/contacts/import', itemIndex, {
    files: [{ fieldName: 'import_file', binaryPropertyName, fileName, mimeType: 'text/csv' }],
  });
  return {
    success: true,
    fileName,
    message:
      'Chatwoot accepted the CSV and imports it in the background. Administrators receive an email with the result.',
  };
}

// ============================================================================
// Find by WhatsApp number
// ============================================================================

export interface WhatsAppLookup {
  /** Kind of input: a phone number / phone JID, a WhatsApp LID or a group JID. */
  kind: 'phone' | 'lid' | 'group';
  /** Text sent as `q` to GET /contacts/search (substring shared by every variant). */
  searchQuery: string;
  /** `phone_number` values that count as a match, preferred first. */
  phoneNumbers: string[];
  /** `identifier` values (JIDs) that count as a match, preferred first. */
  identifiers: string[];
}

const PHONE_JID_DOMAINS = ['s.whatsapp.net', 'c.us'];

function phoneVariants(digits: string): string[] {
  const variants = [digits];
  // Mexico (+52 / +521) and Argentina (+54 / +549): WhatsApp and Evolution use both forms
  if (digits.startsWith('52') || digits.startsWith('54')) {
    const mobileDigit = digits.startsWith('52') ? '1' : '9';
    if (digits.length === 13 && digits[2] === mobileDigit) {
      variants.push(digits.slice(0, 2) + digits.slice(3));
    } else if (digits.length === 12) {
      variants.push(digits.slice(0, 2) + mobileDigit + digits.slice(2));
    }
  }
  // Brazil (+55 DDD [9] XXXXXXXX): mobile numbers exist with and without the extra 9
  else if (digits.startsWith('55')) {
    if (digits.length === 13 && digits[4] === '9') {
      variants.push(digits.slice(0, 4) + digits.slice(5));
    } else if (digits.length === 12) {
      variants.push(digits.slice(0, 4) + '9' + digits.slice(4));
    }
  }
  return variants;
}

function commonSuffix(values: string[]): string {
  let suffix = values[0] ?? '';
  for (const value of values.slice(1)) {
    let length = 0;
    while (
      length < suffix.length &&
      length < value.length &&
      suffix[suffix.length - 1 - length] === value[value.length - 1 - length]
    ) {
      length++;
    }
    suffix = suffix.slice(suffix.length - length);
  }
  return suffix;
}

/**
 * Build the phone and JID variants for a WhatsApp number or JID. Accepts '+52 1 55 1234 5678',
 * '5215512345678', '5215512345678@s.whatsapp.net' (device suffixes like ':12' are dropped),
 * '123456789012345@lid' and '120363000000000000@g.us'. Throws a plain Error on invalid input.
 */
export function buildWhatsAppLookup(input: string): WhatsAppLookup {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('WhatsApp Number is empty');

  const at = raw.lastIndexOf('@');
  if (at !== -1) {
    const domain = raw.slice(at + 1).toLowerCase();
    const local = raw.slice(0, at).split(':')[0].trim();
    if (domain === 'lid') {
      const lid = local.replace(/\D/g, '');
      if (!lid) throw new Error(`"${raw}" is not a valid WhatsApp LID`);
      return {
        kind: 'lid',
        searchQuery: lid,
        // Evolution stores '+<lid digits>' as phone_number when it only knows the LID
        phoneNumbers: [`+${lid}`],
        identifiers: [`${lid}@lid`],
      };
    }
    if (domain === 'g.us') {
      const group = local.replace(/[^\d-]/g, '');
      if (!group) throw new Error(`"${raw}" is not a valid WhatsApp group JID`);
      return {
        kind: 'group',
        searchQuery: group,
        phoneNumbers: [],
        identifiers: [`${group}@g.us`],
      };
    }
    if (!PHONE_JID_DOMAINS.includes(domain)) {
      throw new Error(
        `"${raw}" is not a WhatsApp number or JID (expected <number>@s.whatsapp.net, <lid>@lid or <group>@g.us)`,
      );
    }
    return buildWhatsAppLookup(local);
  }

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) {
    throw new Error(
      `"${raw}" is not a valid WhatsApp number: use the international format with country code, e.g. +5215512345678`,
    );
  }

  const variants = phoneVariants(digits);
  return {
    kind: 'phone',
    searchQuery: commonSuffix(variants),
    phoneNumbers: variants.map((variant) => `+${variant}`),
    identifiers: variants.map((variant) => `${variant}@s.whatsapp.net`),
  };
}

interface RankedMatch {
  contact: IDataObject;
  matchedBy: 'identifier' | 'phone_number';
  matchedValue: string;
  rank: number;
}

/**
 * Pick the contacts whose identifier or phone_number equals one of the variants. Identifier
 * (JID) matches win over phone matches because Evolution routes messages by identifier; then
 * the variant order (the input's own form first), then the most recent activity.
 */
export function rankWhatsAppMatches(
  lookup: WhatsAppLookup,
  contacts: IDataObject[],
): RankedMatch[] {
  const matches: RankedMatch[] = [];
  for (const contact of contacts) {
    const identifier = String(contact.identifier ?? '')
      .trim()
      .toLowerCase();
    const phone = String(contact.phone_number ?? '').trim();
    const identifierIndex = identifier ? lookup.identifiers.indexOf(identifier) : -1;
    const phoneIndex = phone ? lookup.phoneNumbers.indexOf(phone) : -1;
    if (identifierIndex !== -1) {
      matches.push({
        contact,
        matchedBy: 'identifier',
        matchedValue: lookup.identifiers[identifierIndex],
        rank: identifierIndex,
      });
    } else if (phoneIndex !== -1) {
      matches.push({
        contact,
        matchedBy: 'phone_number',
        matchedValue: lookup.phoneNumbers[phoneIndex],
        rank: 100 + phoneIndex,
      });
    }
  }
  const activity = (contact: IDataObject) => Number(contact.last_activity_at ?? 0) || 0;
  return matches.sort(
    (a, b) =>
      a.rank - b.rank ||
      activity(b.contact) - activity(a.contact) ||
      Number(a.contact.id ?? 0) - Number(b.contact.id ?? 0),
  );
}

/** Output item of Contact > Find by WhatsApp Number. */
export function buildWhatsAppLookupResult(
  input: string,
  lookup: WhatsAppLookup,
  contacts: IDataObject[],
): IDataObject {
  const matches = rankWhatsAppMatches(lookup, contacts);
  const best = matches[0];
  const identifier = best ? String(best.contact.identifier ?? '') : '';
  return {
    found: Boolean(best),
    contact: best ? best.contact : null,
    matchedBy: best ? best.matchedBy : null,
    matchedValue: best ? best.matchedValue : null,
    isLid: best ? identifier.toLowerCase().endsWith('@lid') : lookup.kind === 'lid',
    otherMatches: matches.slice(1).map((match) => ({
      id: match.contact.id,
      name: match.contact.name,
      phone_number: match.contact.phone_number,
      identifier: match.contact.identifier,
      matchedBy: match.matchedBy,
    })),
    searched: {
      input,
      query: lookup.searchQuery,
      phoneNumbers: lookup.phoneNumbers,
      identifiers: lookup.identifiers,
    },
  };
}
