import { createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// X-Chatwoot-Signature verification
//
// Chatwoot (lib/webhooks/trigger.rb, 4.12+ for account webhooks, 4.13+ for agent bots and API channels)
// signs every delivery whose webhook / bot / channel has a secret:
//   X-Chatwoot-Timestamp: <unix seconds>
//   X-Chatwoot-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
//   X-Chatwoot-Delivery:  <uuid> (also sent for unsigned deliveries)
// The body is the exact JSON string Chatwoot sent, so the HMAC must be computed over the raw bytes.
// ============================================================================

export const SIGNATURE_HEADER = 'x-chatwoot-signature';
export const TIMESTAMP_HEADER = 'x-chatwoot-timestamp';
export const DELIVERY_HEADER = 'x-chatwoot-delivery';

/** Default accepted clock difference between Chatwoot and n8n (freshness, not deduplication). */
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300;

/** Hex HMAC-SHA256 over `${timestamp}.${rawBody}` (bytes of the raw body, not a re-serialization). */
export function computeChatwootSignature(
  secret: string,
  timestamp: string,
  rawBody: Buffer | string,
): string {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  return createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), body]))
    .digest('hex');
}

export type SignatureFailureReason =
  | 'missing_secret'
  | 'missing_signature'
  | 'malformed_signature'
  | 'missing_timestamp'
  | 'timestamp_out_of_tolerance'
  | 'signature_mismatch';

export type SignatureCheck = { valid: true } | { valid: false; reason: SignatureFailureReason };

export interface VerifySignatureInput {
  secret: string | undefined;
  /** Value of X-Chatwoot-Signature ('sha256=<hex>'). */
  signature: string | undefined;
  /** Value of X-Chatwoot-Timestamp (unix seconds). */
  timestamp: string | undefined;
  rawBody: Buffer | string;
  /** Max |now - timestamp| in seconds; 0 or less disables the check. */
  toleranceSeconds?: number;
  /** Current time in ms (tests). */
  now?: number;
}

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

/** Constant-time verification of a Chatwoot webhook signature, including the timestamp window. */
export function verifyChatwootSignature(input: VerifySignatureInput): SignatureCheck {
  if (!input.secret) return { valid: false, reason: 'missing_secret' };
  if (!input.signature) return { valid: false, reason: 'missing_signature' };

  const match = SIGNATURE_PATTERN.exec(input.signature.trim());
  if (!match) return { valid: false, reason: 'malformed_signature' };

  const timestamp = (input.timestamp ?? '').trim();
  if (!/^\d+$/.test(timestamp)) return { valid: false, reason: 'missing_timestamp' };

  const tolerance = input.toleranceSeconds ?? DEFAULT_SIGNATURE_TOLERANCE_SECONDS;
  if (tolerance > 0) {
    const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
    if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) {
      return { valid: false, reason: 'timestamp_out_of_tolerance' };
    }
  }

  const expected = Buffer.from(
    computeChatwootSignature(input.secret, timestamp, input.rawBody),
    'hex',
  );
  const actual = Buffer.from(match[1].toLowerCase(), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { valid: false, reason: 'signature_mismatch' };
  }
  return { valid: true };
}

/** Human-readable explanation for n8n logs (never sent back to the caller). */
export function describeSignatureFailure(reason: SignatureFailureReason): string {
  switch (reason) {
    case 'missing_secret':
      return 'no signing secret is configured for this trigger';
    case 'missing_signature':
      return 'the request has no X-Chatwoot-Signature header';
    case 'malformed_signature':
      return 'the X-Chatwoot-Signature header is not "sha256=<hex>"';
    case 'missing_timestamp':
      return 'the request has no valid X-Chatwoot-Timestamp header';
    case 'timestamp_out_of_tolerance':
      return 'X-Chatwoot-Timestamp is outside the allowed window (replayed request or clock skew)';
    case 'signature_mismatch':
      return 'X-Chatwoot-Signature does not match the signing secret';
  }
}
