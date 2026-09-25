import { createHmac } from 'crypto';
import type { IDataObject } from 'n8n-workflow';

/**
 * identifier_hash expected by Chatwoot identity validation: the hex HMAC-SHA256 of the contact
 * identifier, keyed with the inbox HMAC token (Public::Api::V1::Inboxes::ContactsController#valid_hmac?).
 */
export function computeIdentifierHash(hmacToken: string, identifier: string): string {
  return createHmac('sha256', hmacToken).update(identifier).digest('hex');
}

/**
 * Fill `identifier_hash` from the credential's HMAC token when an identifier is sent without a hash.
 * Returns an error message when the parameters cannot pass Chatwoot's check (a hash with no identifier
 * is always compared against the hash of an empty string).
 */
export function applyIdentifierHash(target: IDataObject, hmacToken: string): string | undefined {
  const identifier = target.identifier === undefined ? '' : String(target.identifier);
  if (!target.identifier_hash && identifier && hmacToken) {
    target.identifier_hash = computeIdentifierHash(hmacToken, identifier);
  }
  if (target.identifier_hash && !identifier) {
    return 'Identifier Hash needs the Identifier it was computed from: Chatwoot checks the hash against the identifier sent in the same request';
  }
  return undefined;
}

/**
 * The contact source_id as a URL path segment. An empty value would call another route (or none) and
 * surface as a confusing 404, so it throws instead (a plain Error: execute wraps it with the item index).
 */
export function contactIdentifierPath(value: unknown): string {
  const identifier = value === undefined || value === null ? '' : String(value);
  if (!identifier.trim()) {
    throw new Error(
      'Contact Identifier must not be empty: use the source_id returned by Public Contact > Create',
    );
  }
  return encodeURIComponent(identifier);
}

/** Added to 500 errors of Public API contact calls: a failed HMAC check surfaces as a bare 500. */
export const IDENTITY_VALIDATION_HINT =
  'If the inbox enforces identity validation (HMAC), Chatwoot answers 500 when the identifier_hash is missing or does not match: send the contact Identifier and set the HMAC Token in the Chatwoot Public API credential (or pass Identifier Hash).';
