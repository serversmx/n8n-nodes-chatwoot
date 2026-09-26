import type { IDataObject } from 'n8n-workflow';

import { parseJsonSafe, validateId } from '../../GenericFunctions';
import { toUnixSeconds } from '../notification/helpers';

/**
 * Builds Chatwoot's campaign audience ([{ type: 'Label', id }]) from the "Audience Label IDs"
 * (comma-separated) and the legacy "Audience (JSON)" field, which may hold either that exact
 * shape or a plain array of label IDs. Returns undefined when neither is set.
 */
export function buildCampaignAudience(
  labelIds: unknown,
  audienceJson: unknown,
): IDataObject[] | undefined {
  const audience: IDataObject[] = [];
  const seen = new Set<number>();
  const add = (id: unknown) => {
    const labelId = validateId(id, 'Audience label ID');
    if (seen.has(labelId)) return;
    seen.add(labelId);
    audience.push({ type: 'Label', id: labelId });
  };

  for (const raw of String(labelIds ?? '').split(',')) {
    if (raw.trim()) add(raw.trim());
  }

  if (audienceJson !== undefined && audienceJson !== null && audienceJson !== '') {
    const parsed = parseJsonSafe(audienceJson, 'audience');
    if (!Array.isArray(parsed)) {
      throw new Error('Audience (JSON) must be an array, e.g. [{"type":"Label","id":1}] or [1, 2]');
    }
    for (const entry of parsed as unknown[]) {
      if (entry && typeof entry === 'object') {
        const item = entry as IDataObject;
        if (item.type !== undefined && String(item.type).toLowerCase() !== 'label') {
          throw new Error(
            `Audience type "${String(item.type)}" is not supported: Chatwoot campaigns only target labels`,
          );
        }
        add(item.id);
      } else {
        add(entry);
      }
    }
  }

  return audience.length > 0 ? audience : undefined;
}

/**
 * Parses and checks WhatsApp template params ({ name, language, namespace?, category?, processed_params? }).
 * Chatwoot stores anything, but a campaign without name/language silently sends nothing.
 */
export function parseTemplateParams(value: unknown): IDataObject | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseJsonSafe(value, 'template_params');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'Template Params (JSON) must be an object like {"name":"...","language":"en","processed_params":{...}}',
    );
  }
  const params = parsed as IDataObject;
  if (!params.name || !params.language) {
    throw new Error(
      'Template Params (JSON) needs at least "name" and "language" of an approved template of the inbox',
    );
  }
  return params;
}

/**
 * Converts a date input to an ISO 8601 UTC timestamp (Chatwoot parses campaign scheduled_at with
 * Time.zone; a value without offset would be read as UTC). Same input rules as the notification
 * snooze: ISO strings (no offset = n8n server timezone), Date objects, Unix seconds or milliseconds.
 */
export function toIsoTimestamp(value: unknown, fieldName: string): string {
  return new Date(toUnixSeconds(value, fieldName) * 1000).toISOString();
}

/** Trigger URL as set by the user; an added-but-empty field counts as not set. */
function getTriggerUrl(fields: IDataObject): string | undefined {
  if (fields.trigger_url === undefined || fields.trigger_url === null) return undefined;
  const url = String(fields.trigger_url).trim();
  return url === '' ? undefined : url;
}

/**
 * Whether an Update changes only one of Trigger URL / Time on Page, so the current trigger
 * rules must be read first (Chatwoot replaces the whole hash).
 */
export function needsCurrentTriggerRules(fields: IDataObject): boolean {
  return (getTriggerUrl(fields) === undefined) !== (fields.time_on_page === undefined);
}

/**
 * Builds Website campaign trigger rules. On Update, Chatwoot replaces the whole hash, so the
 * caller passes the current rules to keep the value the user did not change. An empty Trigger
 * URL is ignored: Chatwoot rejects it for Website inboxes ("Url invalid").
 */
export function buildTriggerRules(
  fields: IDataObject,
  current: IDataObject = {},
): IDataObject | undefined {
  const url = getTriggerUrl(fields);
  const hasTime = fields.time_on_page !== undefined;
  if (url === undefined && !hasTime) return undefined;

  const rules: IDataObject = { ...current };
  if (url !== undefined) rules.url = url;
  if (hasTime) rules.time_on_page = fields.time_on_page;
  return rules;
}

/**
 * Maps the optional campaign fields (Create "Additional Fields" / Update "Update Fields") to the
 * body Chatwoot permits. `currentTriggerRules` is only needed on Update when just one of Trigger
 * URL / Time on Page changes.
 */
export function buildCampaignBody(
  fields: IDataObject,
  mode: 'create' | 'update',
  currentTriggerRules?: IDataObject,
): IDataObject {
  const body: IDataObject = {};

  if (fields.title) body.title = fields.title;
  if (fields.message) body.message = fields.message;
  // An explicitly added empty description clears it on Update
  if (fields.description || (mode === 'update' && fields.description !== undefined)) {
    body.description = fields.description;
  }
  if (fields.enabled !== undefined) body.enabled = fields.enabled;
  if (fields.trigger_only_during_business_hours !== undefined) {
    body.trigger_only_during_business_hours = fields.trigger_only_during_business_hours;
  }
  if (fields.sender_id !== undefined && fields.sender_id !== '') {
    body.sender_id = validateId(fields.sender_id, 'Sender');
  }
  if (fields.scheduled_at) body.scheduled_at = toIsoTimestamp(fields.scheduled_at, 'Scheduled At');

  const audience = buildCampaignAudience(fields.audienceLabelIds, fields.audience);
  if (audience) body.audience = audience;

  const templateParams = parseTemplateParams(fields.template_params);
  if (templateParams) body.template_params = templateParams;

  const triggerRules = buildTriggerRules(fields, currentTriggerRules);
  if (triggerRules) body.trigger_rules = triggerRules;

  return body;
}
