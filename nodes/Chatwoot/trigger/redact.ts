import type { IDataObject } from 'n8n-workflow';

// ============================================================================
// Channel secret redaction for inbox_created / inbox_updated (TRIGGER-4)
//
// Inbox::EventDataPresenter#webhook_data sends `channel: channel`, the whole ActiveRecord channel serialized
// with to_json: every column, decrypted. Depending on the channel type that includes Channel::Api `secret`,
// `hmac_token`; Channel::Email `imap_password`, `smtp_password`, OAuth tokens in `provider_config`;
// Channel::Telegram `bot_token`; Channel::Whatsapp `provider_config.api_key`; Line/Facebook/Instagram/TikTok/
// Twitter access tokens; Channel::TwilioSms `auth_token`... n8n stores execution data, so these are replaced
// before the item is emitted.
// ============================================================================

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEY = /(secret|token|password|passwd|api_?key|private_?key|credential)/i;

/** Keys that match the pattern but hold no secret. */
const SAFE_KEYS = new Set([
  // Public web-widget token embedded in every page that loads the widget script
  'website_token',
]);

function isSensitiveKey(key: string): boolean {
  if (SAFE_KEYS.has(key)) return false;
  // Timestamps such as refresh_token_expires_at
  if (/_at$/i.test(key)) return false;
  return SENSITIVE_KEY.test(key);
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/** Deep copy of `value` with every sensitive key's non-empty value replaced by '[REDACTED]'. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactSecrets(entry));
  if (value === null || typeof value !== 'object') return value;
  const result: IDataObject = {};
  for (const [key, entry] of Object.entries(value as IDataObject)) {
    result[key] =
      isSensitiveKey(key) && !isEmpty(entry) ? REDACTED : (redactSecrets(entry) as IDataObject);
  }
  return result;
}

/** Copy of an inbox_* payload with the secrets inside `channel` (and `changed_attributes`) redacted. */
export function redactInboxEventSecrets(payload: IDataObject): IDataObject {
  const result: IDataObject = { ...payload };
  if (result.channel !== undefined) result.channel = redactSecrets(result.channel) as IDataObject;
  if (result.changed_attributes !== undefined) {
    result.changed_attributes = redactSecrets(result.changed_attributes) as IDataObject[];
  }
  return result;
}
