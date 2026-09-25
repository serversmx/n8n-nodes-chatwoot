import type { IDataObject } from 'n8n-workflow';

/** Chatwoot accepts only enabled locales (config/initializers/languages.rb); map legacy option values. */
const LEGACY_LOCALES: Record<string, string> = { zh: 'zh_CN' };
const DISABLED_LOCALES = ['hi'];

const ACCOUNT_ATTRIBUTES = ['name', 'locale', 'domain', 'support_email'];
const CUSTOM_ATTRIBUTES = ['industry', 'company_size', 'timezone', 'website'];
const SETTINGS = [
  'auto_resolve_message',
  'auto_resolve_ignore_waiting',
  'auto_resolve_label',
  'audio_transcriptions',
];

/**
 * Build the PATCH /api/v1/accounts/:id body. AccountsController#update reads name/locale/domain/
 * support_email, the custom attributes and the settings from the root of the request.
 */
export function buildAccountUpdateBody(updateFields: IDataObject): IDataObject {
  const body: IDataObject = {};

  for (const key of ACCOUNT_ATTRIBUTES) {
    if (updateFields[key]) body[key] = updateFields[key];
  }
  if (typeof body.locale === 'string') {
    if (DISABLED_LOCALES.includes(body.locale)) {
      throw new Error(`Chatwoot has disabled the "${body.locale}" locale. Choose another locale.`);
    }
    body.locale = LEGACY_LOCALES[body.locale] ?? body.locale;
  }

  for (const key of CUSTOM_ATTRIBUTES) {
    if (updateFields[key] !== undefined) body[key] = updateFields[key];
  }
  for (const key of SETTINGS) {
    if (updateFields[key] !== undefined) body[key] = updateFields[key];
  }

  // auto_resolve_after is in minutes (10..1439856); 0 (or empty) disables auto-resolve.
  // The legacy "Auto Resolve Duration (Days)" field is converted when the new one is not set.
  let autoResolveAfter: unknown = updateFields.auto_resolve_after;
  if (autoResolveAfter === undefined && updateFields.auto_resolve_duration !== undefined) {
    autoResolveAfter = Number(updateFields.auto_resolve_duration) * 1440;
  }
  if (autoResolveAfter !== undefined) {
    const minutes = Number(autoResolveAfter);
    if (!minutes) {
      body.auto_resolve_after = null;
    } else if (!Number.isInteger(minutes) || minutes < 10 || minutes > 1439856) {
      throw new Error(
        'Auto Resolve After must be 0 (disabled) or a whole number of minutes between 10 and 1439856',
      );
    } else {
      body.auto_resolve_after = minutes;
    }
  }

  return body;
}
